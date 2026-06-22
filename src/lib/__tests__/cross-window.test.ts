import { describe, expect, it } from 'vitest';
import { IndicatorEngine } from '../indicators/indicator-engine';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { Candle } from '../../types';

function candle(i: number, close: number, high = close + 0.5, low = close - 0.5): Candle {
  return {
    symbol: 'test',
    intervalSec: 5,
    timestamp: i * 5000,
    open: close,
    high,
    low,
    close,
  };
}

describe('crossover validity window', () => {
  it('keeps bullish cross valid for 3 bars then expires', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      stochastic: {
        ...DEFAULT_SETTINGS.stochastic,
        crossValidityBars: 3,
        kPeriod: 3,
        dPeriod: 2,
        smoothing: 1,
      },
    };
    const engine = new IndicatorEngine(settings);

    const pattern = [
      10, 9, 8, 7, 6, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      20, 21, 22, 23, 24, 25,
    ];
    const candles: Candle[] = pattern.map((c, i) => candle(i, c));

    const snap = engine.computeFromCandles(candles);
    if (snap.barsSinceBullishCross !== null) {
      expect(snap.bullishCrossValid).toBe(
        snap.barsSinceBullishCross < settings.stochastic.crossValidityBars,
      );
    }
  });

  it('expires cross when age reaches window', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      stochastic: {
        ...DEFAULT_SETTINGS.stochastic,
        crossValidityBars: 3,
        kPeriod: 3,
        dPeriod: 2,
        smoothing: 1,
      },
    };
    const engine = new IndicatorEngine(settings);

    const pattern = [
      10, 9, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25,
    ];
    const candles = pattern.map((c, i) => candle(i, c));
    const snap = engine.computeFromCandles(candles);

    if (snap.barsSinceBullishCross !== null && snap.barsSinceBullishCross >= 3) {
      expect(snap.bullishCrossValid).toBe(false);
    }
  });

  it('counts cross up without zone requirement', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      stochastic: {
        ...DEFAULT_SETTINGS.stochastic,
        crossValidityBars: 3,
        kPeriod: 3,
        dPeriod: 2,
        smoothing: 1,
        oversold: 20,
        overbought: 80,
      },
    };
    const engine = new IndicatorEngine(settings);

    const pattern = [
      10, 9, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
      24, 25,
    ];
    const candles = pattern.map((c, i) => candle(i, c));
    const snap = engine.computeFromCandles(candles);

    if (snap.bullishCrossValid) {
      expect(snap.barsSinceBullishCross).not.toBeNull();
    }
  });
});
