import type { AggregateLearningRun, TradeCloseEvent, TradeRecord } from '../../types';
import type { PendingJournalEntry } from './trade-journal-match';
import {
  appendAggregateRun,
  appendTradeRecord,
  countTradeRecords,
  getTradeRecord,
  listTradeRecords,
  updateTradeRecord,
} from './trade-journal-db';

function isServiceWorkerContext(): boolean {
  return typeof window === 'undefined';
}

async function sendJournalMessage<T extends Record<string, unknown>>(
  message: T,
): Promise<Record<string, unknown>> {
  const response = (await chrome.runtime.sendMessage(message)) as
    | Record<string, unknown>
    | undefined;
  if (!response?.ok) {
    throw new Error(String(response?.message ?? 'Journal request failed'));
  }
  return response;
}

export async function clientAppendTradeRecord(record: TradeRecord): Promise<void> {
  if (isServiceWorkerContext()) {
    await appendTradeRecord(record);
    return;
  }
  await sendJournalMessage({ type: 'mtb-journal-append', record });
}

export async function clientUpdateTradeRecord(record: TradeRecord): Promise<void> {
  if (isServiceWorkerContext()) {
    await updateTradeRecord(record);
    return;
  }
  await sendJournalMessage({ type: 'mtb-journal-update', record });
}

export async function clientCountTradeRecords(): Promise<number> {
  if (isServiceWorkerContext()) {
    return countTradeRecords();
  }
  const response = await sendJournalMessage({ type: 'mtb-journal-count' });
  return Number(response.count) || 0;
}

export async function clientListTradeRecords(
  limit = 100,
  offset = 0,
  order: 'asc' | 'desc' = 'desc',
): Promise<TradeRecord[]> {
  if (isServiceWorkerContext()) {
    return listTradeRecords(limit, offset, order);
  }
  const response = await sendJournalMessage({
    type: 'mtb-journal-list',
    limit,
    offset,
    order,
  });
  return (response.records as TradeRecord[] | undefined) ?? [];
}

export async function clientGetTradeRecord(id: string): Promise<TradeRecord | null> {
  if (isServiceWorkerContext()) {
    return getTradeRecord(id);
  }
  const response = await sendJournalMessage({ type: 'mtb-journal-get', id });
  return (response.record as TradeRecord | undefined) ?? null;
}

export async function clientPushPendingJournalEntry(
  entry: PendingJournalEntry,
): Promise<void> {
  if (isServiceWorkerContext()) {
    const { pushPendingJournalEntry } = await import('./trade-journal-service');
    await pushPendingJournalEntry(entry);
    return;
  }
  await sendJournalMessage({ type: 'mtb-journal-pending-push', entry });
}

export async function clientCompleteJournalOnClose(
  event: TradeCloseEvent,
): Promise<TradeRecord | null> {
  if (isServiceWorkerContext()) {
    const { completeJournalOnClose } = await import('./trade-journal-service');
    return completeJournalOnClose(event);
  }
  const response = await sendJournalMessage({
    type: 'mtb-journal-complete-close',
    event,
  });
  return (response.record as TradeRecord | undefined) ?? null;
}

export async function clientAppendAggregateRun(run: AggregateLearningRun): Promise<void> {
  if (isServiceWorkerContext()) {
    await appendAggregateRun(run);
    return;
  }
  await sendJournalMessage({ type: 'mtb-journal-aggregate-run', run });
}
