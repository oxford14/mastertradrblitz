import type { AggregateLearningRun, TradeRecord } from '../../types';

const DB_NAME = 'mtb-trade-journal';
const DB_VERSION = 1;
const TRADES_STORE = 'trades';
const RUNS_STORE = 'aggregate_runs';
const MAX_TRADES = 5000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRADES_STORE)) {
        const store = db.createObjectStore(TRADES_STORE, { keyPath: 'id' });
        store.createIndex('closedAt', 'closedAt', { unique: false });
        store.createIndex('outcome', 'outcome', { unique: false });
        store.createIndex('signal', 'signal', { unique: false });
      }
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        const runs = db.createObjectStore(RUNS_STORE, { keyPath: 'id' });
        runs.createIndex('runAt', 'runAt', { unique: false });
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  storeName: string,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      }),
  );
}

export async function appendTradeRecord(record: TradeRecord): Promise<void> {
  await runTransaction('readwrite', TRADES_STORE, (store) => store.put(record));
  const count = await countTradeRecords();
  if (count > MAX_TRADES) {
    const excess = count - MAX_TRADES;
    const oldest = await listTradeRecords(excess, 0, 'asc');
    for (const row of oldest) {
      await deleteTradeRecord(row.id);
    }
  }
}

export async function updateTradeRecord(record: TradeRecord): Promise<void> {
  await runTransaction('readwrite', TRADES_STORE, (store) => store.put(record));
}

export async function deleteTradeRecord(id: string): Promise<void> {
  await runTransaction('readwrite', TRADES_STORE, (store) => store.delete(id));
}

export async function getTradeRecord(id: string): Promise<TradeRecord | null> {
  return runTransaction('readonly', TRADES_STORE, (store) => store.get(id));
}

export async function countTradeRecords(): Promise<number> {
  return runTransaction('readonly', TRADES_STORE, (store) => store.count());
}

export async function listTradeRecords(
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'desc',
): Promise<TradeRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRADES_STORE, 'readonly');
    const store = tx.objectStore(TRADES_STORE);
    const index = store.index('closedAt');
    const direction = order === 'desc' ? 'prev' : 'next';
    const results: TradeRecord[] = [];
    let skipped = 0;
    const cursorReq = index.openCursor(null, direction);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        db.close();
        resolve(results);
        return;
      }
      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }
      results.push(cursor.value as TradeRecord);
      if (results.length >= limit) {
        db.close();
        resolve(results);
        return;
      }
      cursor.continue();
    };
    cursorReq.onerror = () => {
      db.close();
      reject(cursorReq.error ?? new Error('Cursor failed'));
    };
  });
}

export async function getRecentTradeRecords(count: number): Promise<TradeRecord[]> {
  return listTradeRecords(count, 0, 'desc');
}

export async function clearTradeJournal(): Promise<void> {
  await runTransaction('readwrite', TRADES_STORE, (store) => store.clear());
}

export async function appendAggregateRun(run: AggregateLearningRun): Promise<void> {
  await runTransaction('readwrite', RUNS_STORE, (store) => store.put(run));
}

export async function listAggregateRuns(
  limit = 10,
  offset = 0,
  order: 'asc' | 'desc' = 'desc',
): Promise<AggregateLearningRun[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RUNS_STORE, 'readonly');
    const store = tx.objectStore(RUNS_STORE);
    const index = store.index('runAt');
    const direction = order === 'desc' ? 'prev' : 'next';
    const results: AggregateLearningRun[] = [];
    let skipped = 0;
    const cursorReq = index.openCursor(null, direction);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        db.close();
        resolve(results);
        return;
      }
      if (skipped < offset) {
        skipped += 1;
        cursor.continue();
        return;
      }
      results.push(cursor.value as AggregateLearningRun);
      if (results.length >= limit) {
        db.close();
        resolve(results);
        return;
      }
      cursor.continue();
    };
    cursorReq.onerror = () => {
      db.close();
      reject(cursorReq.error ?? new Error('Cursor failed'));
    };
  });
}

export async function exportTradeRecordsJson(): Promise<string> {
  const all: TradeRecord[] = [];
  let offset = 0;
  const pageSize = 200;
  while (true) {
    const page = await listTradeRecords(pageSize, offset, 'asc');
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }
  return JSON.stringify(all, null, 2);
}

export function tradeRecordsToCsv(records: TradeRecord[]): string {
  const header =
    'id,closedAt,signal,outcome,profit,stake,symbol,verdict,summary';
  const rows = records.map((r) => {
    const cols = [
      r.id,
      String(r.closedAt),
      r.signal,
      r.outcome,
      String(r.profit),
      String(r.stake),
      r.symbol,
      r.analysis?.verdict ?? '',
      (r.analysis?.summary ?? '').replace(/"/g, '""'),
    ];
    return cols.map((c) => `"${c}"`).join(',');
  });
  return [header, ...rows].join('\n');
}
