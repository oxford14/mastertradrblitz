import { describe, expect, it } from 'vitest';
import { computeEnhancers } from '../signals/confidence-enhancers';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { IndicatorSnapshot } from '../../types';

function snapshot(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
  return {
    rsi: 50,
    stochK: 50,
    stochD: 50,
    price: 100,
    bbUpper: 105,
    bbLower: 95,
    bbMiddle: 100,
    stochCrossUp: false,
    stochCrossDown: false,
    crossUpOnThisBar: false,
    crossDownOnThisBar: false,
    bullishCrossValid: true,
    bearishCrossValid: false,
    barsSinceBullishCross: 0,
    barsSinceBearishCross: null,
    warmedUp: true,
    warmupRequired: 21,
    warmupCurrent: 25,
    maFast: 100,
    maSlow: 99,
    maTrend: 'up',
    cci: -120,
    ...overrides,
  };
}

describe('computeEnhancers', () => {
  it('awards CCI, fractal, ADX tier, DI, and cross freshness for HIGHER', () => {
    const { score, flags } = computeEnhancers('HIGHER', {
      indicators: snapshot(),
      adx: { adx: 26, plusDi: 30, minusDi: 10 },
      fractal: { bullish: true, bearish: false },
      settings: DEFAULT_SETTINGS,
    });
    expect(score).toEqual({
      cci: 5,
      fractal: 5,
      adxStrength: 10,
      diConfirmation: 5,
      crossFreshness: 10,
      total: 35,
    });
    expect(flags).toEqual({
      cci: true,
      fractal: true,
      adxStrength: true,
      diConfirmation: true,
      crossFreshness: true,
    });
  });

  it('uses ADX +5 tier below 25 and cross freshness table', () => {
    const bar1 = computeEnhancers('HIGHER', {
      indicators: snapshot({ barsSinceBullishCross: 1 }),
      adx: { adx: 22, plusDi: 20, minusDi: 18 },
      fractal: { bullish: false, bearish: false },
      settings: DEFAULT_SETTINGS,
    }).score;
    expect(bar1.adxStrength).toBe(5);
    expect(bar1.crossFreshness).toBe(8);

    const bar2 = computeEnhancers('HIGHER', {
      indicators: snapshot({ barsSinceBullishCross: 2 }),
      adx: { adx: 22, plusDi: 20, minusDi: 18 },
      fractal: { bullish: false, bearish: false },
      settings: DEFAULT_SETTINGS,
    }).score;
    expect(bar2.crossFreshness).toBe(5);

    const bar3 = computeEnhancers('HIGHER', {
      indicators: snapshot({ barsSinceBullishCross: 3 }),
      adx: { adx: 22, plusDi: 20, minusDi: 18 },
      fractal: { bullish: false, bearish: false },
      settings: DEFAULT_SETTINGS,
    }).score;
    expect(bar3.crossFreshness).toBe(0);
  });

  it('awards LOWER-side CCI and DI rules', () => {
    const { score } = computeEnhancers('LOWER', {
      indicators: snapshot({
        cci: 130,
        bullishCrossValid: false,
        bearishCrossValid: true,
        barsSinceBullishCross: null,
        barsSinceBearishCross: 0,
      }),
      adx: { adx: 18, plusDi: 10, minusDi: 25 },
      fractal: { bullish: false, bearish: true },
      settings: DEFAULT_SETTINGS,
    });
    expect(score.cci).toBe(5);
    expect(score.fractal).toBe(5);
    expect(score.adxStrength).toBe(0);
    expect(score.diConfirmation).toBe(5);
    expect(score.crossFreshness).toBe(10);
    expect(score.total).toBe(25);
  });

  it('skips CCI when disabled', () => {
    const { score } = computeEnhancers('HIGHER', {
      indicators: snapshot({ cci: -150 }),
      adx: { adx: 10, plusDi: 5, minusDi: 5 },
      fractal: { bullish: false, bearish: false },
      settings: {
        ...DEFAULT_SETTINGS,
        cci: { enabled: false, period: 14, overbought: 100, oversold: -100 },
      },
    });
    expect(score.cci).toBe(0);
  });

  it('uses configurable overbought and oversold levels', () => {
    const higher = computeEnhancers('HIGHER', {
      indicators: snapshot({ cci: -80 }),
      adx: { adx: 10, plusDi: 5, minusDi: 5 },
      fractal: { bullish: false, bearish: false },
      settings: {
        ...DEFAULT_SETTINGS,
        cci: { enabled: true, period: 14, overbought: 100, oversold: -80 },
      },
    });
    expect(higher.score.cci).toBe(5);
    expect(higher.flags.cci).toBe(true);

    const lower = computeEnhancers('LOWER', {
      indicators: snapshot({ cci: 90 }),
      adx: { adx: 10, plusDi: 5, minusDi: 25 },
      fractal: { bullish: false, bearish: false },
      settings: {
        ...DEFAULT_SETTINGS,
        cci: { enabled: true, period: 14, overbought: 90, oversold: -100 },
      },
    });
    expect(lower.score.cci).toBe(5);
    expect(lower.flags.cci).toBe(true);
  });

  it('awards CCI at exact threshold boundaries', () => {
    const higher = computeEnhancers('HIGHER', {
      indicators: snapshot({ cci: -100 }),
      adx: { adx: 10, plusDi: 5, minusDi: 5 },
      fractal: { bullish: false, bearish: false },
      settings: DEFAULT_SETTINGS,
    });
    expect(higher.score.cci).toBe(5);

    const lower = computeEnhancers('LOWER', {
      indicators: snapshot({ cci: 100 }),
      adx: { adx: 10, plusDi: 5, minusDi: 25 },
      fractal: { bullish: false, bearish: false },
      settings: DEFAULT_SETTINGS,
    });
    expect(lower.score.cci).toBe(5);
  });
});
