import { describe, expect, it } from 'vitest';
import { computeCci } from '../indicators/cci';
import type { Candle } from '../../types';

function candle(
  high: number,
  low: number,
  close: number,
  i: number,
): Candle {
  return {
    open: close,
    high,
    low,
    close,
    timestamp: i,
    symbol: 'TEST',
    intervalSec: 5,
  };
}

describe('computeCci', () => {
  it('returns null during warmup', () => {
    const candles = [candle(10, 8, 9, 0), candle(10, 7, 8, 1)];
    expect(computeCci(candles, 14)).toBeNull();
  });

  it('computes CCI on typical price after warmup', () => {
    const candles = Array.from({ length: 14 }, (_, i) =>
      candle(10 + i * 0.1, 9 - i * 0.05, 9.5 + i * 0.02, i),
    );
    candles.push(candle(8, 6, 6.5, 14));
    const cci = computeCci(candles, 14);
    expect(cci).not.toBeNull();
    expect(Number.isFinite(cci)).toBe(true);
    expect(cci!).toBeLessThan(-50);
  });
});
