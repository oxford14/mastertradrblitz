import { describe, expect, it } from 'vitest';
import { computeAdx } from '../indicators/adx';
import type { Candle } from '../../types';

function candle(i: number, close: number, spread = 0.5): Candle {
  return {
    symbol: 'test',
    intervalSec: 5,
    timestamp: i * 5000,
    open: close,
    high: close + spread,
    low: close - spread,
    close,
  };
}

describe('computeAdx', () => {
  it('returns zeros when not enough candles', () => {
    const candles = [candle(0, 100), candle(1, 101)];
    const result = computeAdx(candles, 14);
    expect(result.adx).toBe(0);
    expect(result.plusDi).toBe(0);
    expect(result.minusDi).toBe(0);
  });

  it('returns bounded ADX and DI values on trending data', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      candles.push(candle(i, 100 + i * 0.5));
    }
    const result = computeAdx(candles, 14);
    expect(result.adx).toBeGreaterThanOrEqual(0);
    expect(result.adx).toBeLessThanOrEqual(100);
    expect(result.plusDi).toBeGreaterThanOrEqual(0);
    expect(result.minusDi).toBeGreaterThanOrEqual(0);
  });

  it('shows bullish DI dominance on uptrend', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 50; i++) {
      candles.push(candle(i, 100 + i));
    }
    const result = computeAdx(candles, 14);
    expect(result.plusDi).toBeGreaterThan(result.minusDi);
  });
});
