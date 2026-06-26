import { describe, expect, it } from 'vitest';
import { matchPendingOnClose, pruneExpiredPending } from '../ai/trade-journal-match';
import { buildTradeEntrySnapshot } from '../ai/trade-snapshot';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { PendingJournalEntry } from '../ai/trade-journal-match';

function makePending(
  signal: 'HIGHER' | 'LOWER',
  placedAt: number,
  expirySec = 5,
): PendingJournalEntry {
  return {
    entry: buildTradeEntrySnapshot({
      placedAt,
      signal,
      symbol: 'EURUSD',
      stake: 200,
      progression: {
        profileId: 'D200',
        level: 1,
        stake: 200,
        stopped: false,
        lastWarning: null,
      },
      dryRun: false,
      settings: DEFAULT_SETTINGS,
      signalResult: null,
    }),
    expirySec,
    candlesAtEntry: [],
  };
}

describe('trade-journal-match', () => {
  it('matches pending entry on close within expiry window', () => {
    const placedAt = Date.now() - 6000;
    const pending = [makePending('HIGHER', placedAt)];
    const result = matchPendingOnClose(pending, {
      id: 'close-1',
      profit: 10,
      outcome: 'win',
      closedAt: placedAt + 5000,
      direction: 'HIGHER',
    });
    expect(result?.record.signal).toBe('HIGHER');
    expect(result?.remaining).toHaveLength(0);
  });

  it('survives reload when pending list is restored from session', () => {
    const placedAt = Date.now() - 6000;
    const restoredPending = [makePending('LOWER', placedAt)];
    const pruned = pruneExpiredPending(restoredPending, Date.now());
    expect(pruned).toHaveLength(1);

    const result = matchPendingOnClose(pruned, {
      id: 'close-reload',
      profit: -10,
      outcome: 'loss',
      closedAt: placedAt + 5000,
      direction: 'LOWER',
    });
    expect(result?.record.outcome).toBe('loss');
    expect(result?.remaining).toHaveLength(0);
  });

  it('rejects direction mismatch', () => {
    const placedAt = Date.now() - 6000;
    const pending = [makePending('HIGHER', placedAt)];
    const result = matchPendingOnClose(pending, {
      id: 'close-mismatch',
      profit: -10,
      outcome: 'loss',
      closedAt: placedAt + 5000,
      direction: 'LOWER',
    });
    expect(result).toBeNull();
  });
});
