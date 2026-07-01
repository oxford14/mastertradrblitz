import { describe, expect, it } from 'vitest';
import { computeJournalInsights } from '../ai/journal-insights';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { TradeRecord } from '../../types';

function makeRecord(
  overrides: Partial<TradeRecord> & Pick<TradeRecord, 'outcome' | 'signal'>,
): TradeRecord {
  return {
    id: overrides.id ?? `id-${Math.random()}`,
    placedAt: overrides.placedAt ?? 1,
    closedAt: overrides.closedAt ?? 2,
    signal: overrides.signal,
    outcome: overrides.outcome,
    profit: overrides.profit ?? (overrides.outcome === 'win' ? 546 : 0),
    symbol: '79',
    stake: overrides.stake ?? 100,
    progressionLevel: overrides.progressionLevel ?? 1,
    entry: {
      placedAt: 1,
      signal: overrides.signal,
      symbol: '79',
      stake: overrides.stake ?? 100,
      progressionLevel: overrides.progressionLevel ?? 1,
      dryRun: false,
      settingsAtEntry: DEFAULT_SETTINGS,
      signalResult: overrides.entry?.signalResult ?? {
        signal: overrides.signal,
        tradeDirection: overrides.signal,
        confidence: { total: 90 } as never,
        dualConfidence: {} as never,
        activeCheck: {} as never,
        debug: {} as never,
        indicators: {
          maTrend: overrides.entry?.signalResult?.indicators?.maTrend ?? 'up',
        } as never,
        pattern: {} as never,
      },
      ...overrides.entry,
    },
    candlesAtEntry: overrides.candlesAtEntry ?? [],
    analysis: overrides.analysis,
  };
}

describe('computeJournalInsights', () => {
  it('computes win rate and streaks', () => {
    const records = [
      makeRecord({ id: '1', signal: 'HIGHER', outcome: 'win', closedAt: 1 }),
      makeRecord({ id: '2', signal: 'HIGHER', outcome: 'win', closedAt: 2 }),
      makeRecord({ id: '3', signal: 'LOWER', outcome: 'loss', closedAt: 3 }),
    ];
    const insights = computeJournalInsights(records);
    expect(insights.total).toBe(3);
    expect(insights.wins).toBe(2);
    expect(insights.losses).toBe(1);
    expect(insights.maxWinStreak).toBe(2);
    expect(insights.maxLossStreak).toBe(1);
  });

  it('counts counter-trend losses from maTrend at entry', () => {
    const records = [
      makeRecord({
        id: '1',
        signal: 'HIGHER',
        outcome: 'loss',
        entry: {
          signalResult: { indicators: { maTrend: 'down' } } as never,
        } as never,
      }),
      makeRecord({
        id: '2',
        signal: 'LOWER',
        outcome: 'loss',
        entry: {
          signalResult: { indicators: { maTrend: 'up' } } as never,
        } as never,
      }),
      makeRecord({
        id: '3',
        signal: 'HIGHER',
        outcome: 'win',
        entry: {
          signalResult: { indicators: { maTrend: 'down' } } as never,
        } as never,
      }),
    ];
    const insights = computeJournalInsights(records);
    expect(insights.counterTrendLosses).toBe(2);
  });
});
