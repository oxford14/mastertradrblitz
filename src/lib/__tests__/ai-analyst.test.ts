import { describe, expect, it } from 'vitest';
import { parseAggregateResponse, parseAnalysisResponse } from '../ai/analysis-prompt';
import { candidateBeatsCurrent, splitHoldout } from '../ai/backtest-runner';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { TradeRecord } from '../../types';

describe('analysis-prompt parsers', () => {
  it('parses trade analysis JSON', () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        verdict: 'bad_entry',
        summary: 'Weak edge',
        lessons: ['Raise threshold'],
        settingsPatch: { 'market.minimumSignalEdge': 10 },
      }),
    );
    expect(parsed?.verdict).toBe('bad_entry');
    expect(parsed?.settingsPatch['market.minimumSignalEdge']).toBe(10);
  });

  it('parses aggregate JSON without verdict', () => {
    const parsed = parseAggregateResponse(
      JSON.stringify({
        lessons: ['Loss cluster on marginal RSI'],
        settingsPatch: { 'market.minimumSignalConfidence': 80 },
      }),
    );
    expect(parsed?.lessons).toHaveLength(1);
    expect(parsed?.settingsPatch['market.minimumSignalConfidence']).toBe(80);
  });
});

describe('backtest-runner', () => {
  it('splits holdout slice', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const { train, holdout } = splitHoldout(items, 20);
    expect(train.length).toBe(8);
    expect(holdout.length).toBe(2);
  });

  it('scores candidate vs current on empty holdout as applicable', () => {
    const records: TradeRecord[] = [];
    const result = candidateBeatsCurrent(records, DEFAULT_SETTINGS, DEFAULT_SETTINGS, 20);
    expect(result.applies).toBe(true);
  });
});
