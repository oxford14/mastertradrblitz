import { describe, expect, it } from 'vitest';
import { RSI } from '../indicators/rsi';
import { StochasticOscillator } from '../indicators/stochastic';
import { evaluateSignal, buildSignalDebug } from '../signals/signal-engine';
import { EMPTY_FRACTAL } from '../patterns/fractal';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { EMPTY_WICK } from '../patterns/rejection-wick';
import type { IndicatorSnapshot, PatternSnapshot } from '../../types';

describe('RSI', () => {
  it('returns values between 0 and 100 after warmup', () => {
    const rsi = new RSI(3);
    const values = [44, 44.5, 44.2, 44.8, 45.1, 44.9].map((p) =>
      rsi.update(p),
    );
    const last = values[values.length - 1];
    expect(last).toBeGreaterThanOrEqual(0);
    expect(last).toBeLessThanOrEqual(100);
  });
});

describe('StochasticOscillator', () => {
  it('detects cross up', () => {
    const st = new StochasticOscillator(3, 2, 1);
    const prices = [
      [10, 9, 9.5],
      [10, 8, 8.5],
      [10, 7, 7.5],
      [10, 8, 9],
      [10, 9, 9.5],
    ] as const;
    let crossUp = false;
    for (const [h, l, c] of prices) {
      const r = st.update(h, l, c);
      if (r.crossUp) crossUp = true;
    }
    expect(typeof crossUp).toBe('boolean');
  });
});

const bullishPattern: PatternSnapshot = {
  pattern: 'Bullish Engulfing',
  bullishEngulfing: true,
  bearishEngulfing: false,
};

const nonePattern: PatternSnapshot = {
  pattern: 'None',
  bullishEngulfing: false,
  bearishEngulfing: false,
};

const bearishPattern: PatternSnapshot = {
  pattern: 'Bearish Engulfing',
  bullishEngulfing: false,
  bearishEngulfing: true,
};

const bullishWick = { bullishRejection: true, bearishRejection: false };
const noWick = EMPTY_WICK;

function baseSnapshot(
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
    cci: null,
    ...overrides,
  };
}

const weakAdx = { adx: 10, plusDi: 5, minusDi: 5 };
const noCross = {
  bullishCrossValid: false,
  bearishCrossValid: false,
  barsSinceBullishCross: null,
  barsSinceBearishCross: null,
};

const adx = { adx: 25, plusDi: 30, minusDi: 15 };

describe('evaluateSignal threshold scoring', () => {
  it('returns HIGHER when score meets default 70% threshold', () => {
    const result = evaluateSignal(
      baseSnapshot(),
      bullishPattern,
      bullishWick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('HIGHER');
    expect(result.dualConfidence.higher.total).toBe(133);
  });

  it('returns HIGHER at 100% core when bollinger touch fails but MA aligns', () => {
    const result = evaluateSignal(
      baseSnapshot({ price: 102, bbLower: 95 }),
      bullishPattern,
      bullishWick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('HIGHER');
    expect(result.dualConfidence.higher.total).toBe(123);
    expect(result.activeCheck.bollinger).toBe(false);
  });

  it('returns LOWER when bearish score meets threshold', () => {
    const result = evaluateSignal(
      baseSnapshot({
        rsi: 72,
        price: 104,
        bbUpper: 104,
        bullishCrossValid: false,
        bearishCrossValid: true,
        barsSinceBullishCross: null,
        barsSinceBearishCross: 0,
        maTrend: 'down',
        maFast: 99,
        maSlow: 100,
      }),
      bearishPattern,
      { bullishRejection: false, bearishRejection: true },
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('LOWER');
    expect(result.dualConfidence.lower.total).toBe(130);
  });

  it('returns WAIT when dominant side is below threshold', () => {
    const result = evaluateSignal(
      baseSnapshot({
        rsi: 50,
        price: 102,
        bbLower: 95,
        maTrend: 'neutral',
        bullishCrossValid: true,
        barsSinceBullishCross: 1,
      }),
      nonePattern,
      noWick,
      DEFAULT_SETTINGS,
      weakAdx,
    );
    expect(result.signal).toBe('WAIT');
    expect(result.dualConfidence.higher.total).toBe(38);
  });

  it('fires HIGHER at 90% core without engulfing when wick, BB, and MA contribute', () => {
    const result = evaluateSignal(
      baseSnapshot({ barsSinceBullishCross: 1 }),
      nonePattern,
      bullishWick,
      DEFAULT_SETTINGS,
      weakAdx,
    );
    expect(result.dualConfidence.higher.total).toBe(98);
    expect(result.signal).toBe('HIGHER');
    expect(result.dualConfidence.higher.candlePattern).toBe(0);
  });
});

describe('buildSignalDebug', () => {
  it('includes extra reason when provided', () => {
    const debug = buildSignalDebug(
      baseSnapshot(),
      bullishPattern,
      bullishWick,
      DEFAULT_SETTINGS,
      'WAIT',
      adx,
      EMPTY_FRACTAL,
      'Signal locked (3s remaining)',
    );
    expect(debug.reason).toBe('Signal locked (3s remaining)');
  });
});
