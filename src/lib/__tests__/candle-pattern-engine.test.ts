import { describe, expect, it } from 'vitest';
import { detectEngulfing } from '../patterns/candle-pattern-engine';
import type { Candle } from '../../types';

function candle(
  i: number,
  open: number,
  close: number,
  high?: number,
  low?: number,
): Candle {
  return {
    symbol: 'test',
    intervalSec: 5,
    timestamp: i * 5000,
    open,
    high: high ?? Math.max(open, close) + 0.1,
    low: low ?? Math.min(open, close) - 0.1,
    close,
  };
}

describe('detectEngulfing', () => {
  it('detects bullish engulfing', () => {
    const candles = [
      candle(0, 10, 9),
      candle(1, 8.5, 10.5),
    ];
    const result = detectEngulfing(candles);
    expect(result.bullishEngulfing).toBe(true);
    expect(result.pattern).toBe('Bullish Engulfing');
  });

  it('detects bearish engulfing', () => {
    const candles = [
      candle(0, 9, 10),
      candle(1, 10.5, 8.5),
    ];
    const result = detectEngulfing(candles);
    expect(result.bearishEngulfing).toBe(true);
    expect(result.pattern).toBe('Bearish Engulfing');
  });

  it('returns None when pattern does not match', () => {
    const candles = [
      candle(0, 10, 9),
      candle(1, 9.2, 9.5),
    ];
    const result = detectEngulfing(candles);
    expect(result.pattern).toBe('None');
    expect(result.bullishEngulfing).toBe(false);
    expect(result.bearishEngulfing).toBe(false);
  });

  it('returns None with fewer than 2 candles', () => {
    const result = detectEngulfing([candle(0, 10, 11)]);
    expect(result.pattern).toBe('None');
  });
});
