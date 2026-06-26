import type { TradeCloseEvent, TradeEntrySnapshot, TradeRecord } from '../../types';
import {
  matchPendingOnClose,
  pruneExpiredPending,
  type PendingJournalEntry,
} from './trade-journal-match';

export type { PendingJournalEntry } from './trade-journal-match';

/** In-memory journal for unit tests; production uses background session storage. */
export class TradeJournal {
  private pending: PendingJournalEntry[] = [];

  recordEntry(input: {
    entry: TradeEntrySnapshot;
    expirySec: number;
    candlesAtEntry: TradeRecord['candlesAtEntry'];
  }): void {
    const now = Date.now();
    this.pending = pruneExpiredPending(this.pending, now);
    this.pending.push({
      entry: input.entry,
      expirySec: input.expirySec,
      candlesAtEntry: input.candlesAtEntry,
    });
  }

  completeOnClose(event: TradeCloseEvent): TradeRecord | null {
    const result = matchPendingOnClose(this.pending, event);
    if (!result) return null;
    this.pending = result.remaining;
    return result.record;
  }

  getPendingCount(): number {
    return this.pending.length;
  }

  clear(): void {
    this.pending = [];
  }
}
