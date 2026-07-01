import { describe, expect, it } from 'vitest';
import { detectFractals } from '../patterns/fractal';
import type { Candle } from '../../types';

function candle(high: number, low: number, close: number, i: number): Candle {
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

describe('detectFractals', () => {
  it('returns false flags with fewer than 5 candles', () => {
    const candles = [candle(10, 9, 9.5, 0), candle(10, 8, 8.5, 1)];
    expect(detectFractals(candles)).toEqual({ bullish: false, bearish: false });
  });

  it('detects bullish fractal when middle low is lowest', () => {
    const candles = [
      candle(10, 8, 9, 0),
      candle(10, 7.5, 8, 1),
      candle(10, 5, 6, 2),
      candle(10, 7, 8, 3),
      candle(10, 7.2, 8.2, 4),
    ];
    expect(detectFractals(candles)).toEqual({ bullish: true, bearish: false });
  });

  it('detects bearish fractal when middle high is highest', () => {
    const candles = [
      candle(9, 8, 8.5, 0),
      candle(10, 8, 9, 1),
      candle(12, 9, 11, 2),
      candle(10, 8, 9, 3),
      candle(9.5, 8, 8.8, 4),
    ];
    expect(detectFractals(candles)).toEqual({ bullish: false, bearish: true });
  });
});
