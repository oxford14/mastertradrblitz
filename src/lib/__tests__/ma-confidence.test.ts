import { describe, expect, it } from 'vitest';
import {
  displayConfidence,
  evaluateSignal,
  MAX_RAW_CONFIDENCE,
} from '../signals/signal-engine';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { EMPTY_WICK } from '../patterns/rejection-wick';
import type { IndicatorSnapshot, PatternSnapshot } from '../../types';

function snapshot(
  overrides: Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  return {
    rsi: 28,
    stochK: 18,
    stochD: 15,
    price: 97,
    bbUpper: 105,
    bbLower: 97,
    bbMiddle: 101,
    stochCrossUp: false,
    stochCrossDown: false,
    crossUpOnThisBar: false,
    crossDownOnThisBar: false,
    bullishCrossValid: true,
    bearishCrossValid: false,
    barsSinceBullishCross: 1,
    barsSinceBearishCross: null,
    warmedUp: true,
    warmupRequired: 21,
    warmupCurrent: 25,
    maFast: 100,
    maSlow: 99,
    maTrend: 'up',
    ...overrides,
  };
}

const nonePattern: PatternSnapshot = {
  pattern: 'None',
  bullishEngulfing: false,
  bearishEngulfing: false,
};

const adx = { adx: 22, plusDi: 28, minusDi: 12 };

describe('moving average confidence', () => {
  it('adds +10 for HIGHER when fast MA is above slow MA', () => {
    const withoutMa = evaluateSignal(
      snapshot({ maTrend: 'neutral', maFast: 100, maSlow: 100 }),
      nonePattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    const withMa = evaluateSignal(
      snapshot({ maTrend: 'up', maFast: 101, maSlow: 100 }),
      nonePattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(withoutMa.dualConfidence.higher.total).toBe(70);
    expect(withMa.dualConfidence.higher.total).toBe(80);
    expect(withMa.signal).toBe('HIGHER');
  });

  it('does not block signals when MA trend is neutral', () => {
    const result = evaluateSignal(
      snapshot({ maTrend: 'neutral', maFast: 100, maSlow: 100 }),
      nonePattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.dualConfidence.higher.movingAverage).toBe(0);
    expect(result.signal).toBe('HIGHER');
  });

  it('caps display confidence at 100 while raw can reach 110', () => {
    const bullishPattern: PatternSnapshot = {
      pattern: 'Bullish Engulfing',
      bullishEngulfing: true,
      bearishEngulfing: false,
    };
    const wick = { bullishRejection: true, bearishRejection: false };
    const result = evaluateSignal(
      snapshot(),
      bullishPattern,
      wick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.dualConfidence.higher.total).toBe(MAX_RAW_CONFIDENCE);
    expect(displayConfidence(result.dualConfidence.higher.total)).toBe(100);
  });
});
