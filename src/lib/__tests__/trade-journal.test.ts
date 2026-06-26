/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { TradeJournal } from '../ai/trade-journal';
import { buildTradeEntrySnapshot } from '../ai/trade-snapshot';
import { DEFAULT_SETTINGS } from '../settings/defaults';

function makeEntry(signal: 'HIGHER' | 'LOWER', placedAt: number) {
  return buildTradeEntrySnapshot({
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
  });
}

describe('TradeJournal', () => {
  it('matches pending entry on attributed close', () => {
    const journal = new TradeJournal();
    const placedAt = Date.now() - 6000;
    journal.recordEntry({
      entry: makeEntry('HIGHER', placedAt),
      expirySec: 5,
      candlesAtEntry: [],
    });

    const record = journal.completeOnClose({
      id: 'close-1',
      profit: 10,
      outcome: 'win',
      closedAt: placedAt + 5000,
      direction: 'HIGHER',
    });

    expect(record).not.toBeNull();
    expect(record?.signal).toBe('HIGHER');
    expect(record?.outcome).toBe('win');
    expect(journal.getPendingCount()).toBe(0);
  });

  it('returns null when no pending match', () => {
    const journal = new TradeJournal();
    const record = journal.completeOnClose({
      id: 'close-2',
      profit: -10,
      outcome: 'loss',
      closedAt: Date.now(),
      direction: 'LOWER',
    });
    expect(record).toBeNull();
  });

  it('rejects direction mismatch', () => {
    const journal = new TradeJournal();
    const placedAt = Date.now() - 6000;
    journal.recordEntry({
      entry: makeEntry('HIGHER', placedAt),
      expirySec: 5,
      candlesAtEntry: [],
    });

    const record = journal.completeOnClose({
      id: 'close-3',
      profit: -10,
      outcome: 'loss',
      closedAt: placedAt + 5000,
      direction: 'LOWER',
    });
    expect(record).toBeNull();
    expect(journal.getPendingCount()).toBe(1);
  });
});
