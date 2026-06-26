import type {
  Candle,
  PendingAutoTrade,
  TradeCloseEvent,
  TradeDirection,
  TradeEntrySnapshot,
  TradeRecord,
} from '../../types';
import { buildTradeRecord } from './trade-snapshot';

export const CLOSE_BUFFER_MS = 5000;

export interface PendingJournalEntry {
  entry: TradeEntrySnapshot;
  expirySec: number;
  candlesAtEntry: Candle[];
}

function directionsMatch(pending: PendingAutoTrade, closeDirection: TradeDirection): boolean {
  if (!closeDirection) return true;
  return pending.signal === closeDirection;
}

function isWithinWindow(pending: PendingAutoTrade, closedAt: number): boolean {
  const elapsed = closedAt - pending.placedAt;
  const maxMs = pending.expirySec * 1000 + CLOSE_BUFFER_MS;
  return elapsed >= 0 && elapsed <= maxMs;
}

export function pruneExpiredPending(
  pending: PendingJournalEntry[],
  now: number,
): PendingJournalEntry[] {
  return pending.filter(
    (p) =>
      now - p.entry.placedAt <=
      p.expirySec * 1000 + CLOSE_BUFFER_MS + 30_000,
  );
}

export function matchPendingOnClose(
  pending: PendingJournalEntry[],
  event: TradeCloseEvent,
  now = Date.now(),
): { record: TradeRecord; remaining: PendingJournalEntry[] } | null {
  const pruned = pruneExpiredPending(pending, now);

  const candidates = pruned.filter((p) => {
    const pendingTrade: PendingAutoTrade = {
      placedAt: p.entry.placedAt,
      signal: p.entry.signal,
      expirySec: p.expirySec,
    };
    return (
      isWithinWindow(pendingTrade, event.closedAt) &&
      directionsMatch(pendingTrade, event.direction)
    );
  });

  if (candidates.length === 0) return null;

  const matched =
    candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, cur) =>
          Math.abs(event.closedAt - cur.entry.placedAt) <
          Math.abs(event.closedAt - best.entry.placedAt)
            ? cur
            : best,
        );

  const remaining = pruned.filter((p) => p !== matched);

  return {
    record: buildTradeRecord({
      entry: matched.entry,
      close: event,
      candlesAtEntry: matched.candlesAtEntry,
    }),
    remaining,
  };
}
