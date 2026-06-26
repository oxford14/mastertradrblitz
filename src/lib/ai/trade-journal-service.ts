import type { AggregateLearningRun, TradeCloseEvent, TradeRecord } from '../../types';
import {
  appendAggregateRun,
  appendTradeRecord,
  countTradeRecords,
  updateTradeRecord,
} from './trade-journal-db';
import {
  clearJournalPendingFromSession,
  readJournalPendingFromSession,
  writeJournalPendingToSession,
} from './trade-journal-pending-storage';
import {
  matchPendingOnClose,
  pruneExpiredPending,
  type PendingJournalEntry,
} from './trade-journal-match';

export async function pushPendingJournalEntry(
  entry: PendingJournalEntry,
): Promise<void> {
  const data = await readJournalPendingFromSession();
  const now = Date.now();
  const pending = pruneExpiredPending(data.pending, now);
  pending.push(entry);
  await writeJournalPendingToSession({ pending });
}

export async function completeJournalOnClose(
  event: TradeCloseEvent,
): Promise<TradeRecord | null> {
  const data = await readJournalPendingFromSession();
  const result = matchPendingOnClose(data.pending, event);
  if (!result) return null;

  await writeJournalPendingToSession({ pending: result.remaining });
  await appendTradeRecord(result.record);
  return result.record;
}

export async function saveJournalRecord(record: TradeRecord): Promise<void> {
  await appendTradeRecord(record);
}

export async function updateJournalRecord(record: TradeRecord): Promise<void> {
  await updateTradeRecord(record);
}

export async function getJournalRecordCount(): Promise<number> {
  return countTradeRecords();
}

export async function saveAggregateRun(run: AggregateLearningRun): Promise<void> {
  await appendAggregateRun(run);
}

export async function clearJournalPending(): Promise<void> {
  await clearJournalPendingFromSession();
}
