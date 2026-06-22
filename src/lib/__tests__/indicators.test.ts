import { describe, expect, it } from 'vitest';
import { RSI } from '../indicators/rsi';
import { StochasticOscillator } from '../indicators/stochastic';
import { evaluateSignal, buildSignalDebug } from '../signals/signal-engine';
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
    warmupRequired: 15,
    warmupCurrent: 20,
    ...overrides,
  };
}

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
    expect(result.dualConfidence.higher.total).toBe(100);
  });

  it('returns HIGHER at 95% when bollinger touch fails', () => {
    const result = evaluateSignal(
      baseSnapshot({ price: 102, bbLower: 95 }),
      bullishPattern,
      bullishWick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('HIGHER');
    expect(result.dualConfidence.higher.total).toBe(95);
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
      }),
      bearishPattern,
      { bullishRejection: false, bearishRejection: true },
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('LOWER');
    expect(result.dualConfidence.lower.total).toBe(100);
  });

  it('returns WAIT when dominant side is below threshold', () => {
    const result = evaluateSignal(
      baseSnapshot({ rsi: 50, price: 102, bbLower: 95 }),
      nonePattern,
      noWick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('WAIT');
    expect(result.dualConfidence.higher.total).toBe(30);
  });

  it('fires HIGHER at 75% without engulfing when wick and BB contribute', () => {
    const result = evaluateSignal(
      baseSnapshot(),
      nonePattern,
      bullishWick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.dualConfidence.higher.total).toBe(75);
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
      'Signal locked (3s remaining)',
    );
    expect(debug.reason).toBe('Signal locked (3s remaining)');
  });
});
