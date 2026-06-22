import { describe, expect, it } from 'vitest';
import { detectRejectionWick } from '../patterns/rejection-wick';
import type { Candle } from '../../types';

function candle(
  open: number,
  close: number,
  high: number,
  low: number,
  i = 0,
): Candle {
  return {
    symbol: 'test',
    intervalSec: 5,
    timestamp: i * 5000,
    open,
    high,
    low,
    close,
  };
}

describe('detectRejectionWick', () => {
  it('detects bullish rejection wick', () => {
    const result = detectRejectionWick([
      candle(10, 10.5, 10.6, 8, 0),
    ]);
    expect(result.bullishRejection).toBe(true);
    expect(result.bearishRejection).toBe(false);
  });

  it('detects bearish rejection wick', () => {
    const result = detectRejectionWick([
      candle(10.5, 10, 12, 9.9, 0),
    ]);
    expect(result.bearishRejection).toBe(true);
    expect(result.bullishRejection).toBe(false);
  });

  it('returns false when wick too small', () => {
    const result = detectRejectionWick([
      candle(10, 10.2, 10.3, 10, 0),
    ]);
    expect(result.bullishRejection).toBe(false);
    expect(result.bearishRejection).toBe(false);
  });

  it('returns empty when no candles', () => {
    const result = detectRejectionWick([]);
    expect(result.bullishRejection).toBe(false);
    expect(result.bearishRejection).toBe(false);
  });
});
