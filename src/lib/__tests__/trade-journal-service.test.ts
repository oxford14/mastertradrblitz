/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingJournalEntry } from '../ai/trade-journal-match';
import { buildTradeEntrySnapshot } from '../ai/trade-snapshot';
import { DEFAULT_SETTINGS } from '../settings/defaults';

const appendTradeRecord = vi.fn(async () => undefined);
let sessionPending: PendingJournalEntry[] = [];

vi.mock('../ai/trade-journal-db', () => ({
  appendTradeRecord: (...args: unknown[]) => appendTradeRecord(...args),
}));

vi.mock('../ai/trade-journal-pending-storage', () => ({
  readJournalPendingFromSession: async () => ({ pending: sessionPending }),
  writeJournalPendingToSession: async (data: { pending: PendingJournalEntry[] }) => {
    sessionPending = data.pending;
  },
  clearJournalPendingFromSession: async () => {
    sessionPending = [];
  },
}));

import {
  completeJournalOnClose,
  pushPendingJournalEntry,
} from '../ai/trade-journal-service';

function makePending(placedAt: number): PendingJournalEntry {
  return {
    entry: buildTradeEntrySnapshot({
      placedAt,
      signal: 'HIGHER',
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
    expirySec: 5,
    candlesAtEntry: [],
  };
}

describe('trade-journal-service', () => {
  beforeEach(() => {
    sessionPending = [];
    appendTradeRecord.mockClear();
  });

  it('place → close persists record via background storage', async () => {
    const placedAt = Date.now() - 6000;
    await pushPendingJournalEntry(makePending(placedAt));

    const record = await completeJournalOnClose({
      id: 'pos-99',
      profit: 82,
      outcome: 'win',
      closedAt: placedAt + 5000,
      direction: 'HIGHER',
    });

    expect(record?.id).toBe('pos-99');
    expect(appendTradeRecord).toHaveBeenCalledTimes(1);
    expect(sessionPending).toHaveLength(0);
  });

  it('returns null when no pending entry exists after reload gap', async () => {
    const record = await completeJournalOnClose({
      id: 'pos-orphan',
      profit: 0,
      outcome: 'loss',
      closedAt: Date.now(),
      direction: 'HIGHER',
    });
    expect(record).toBeNull();
    expect(appendTradeRecord).not.toHaveBeenCalled();
  });
});
