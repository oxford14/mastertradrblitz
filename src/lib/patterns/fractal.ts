import type { Candle } from '../../types';

export interface FractalSnapshot {
  bullish: boolean;
  bearish: boolean;
}

export const EMPTY_FRACTAL: FractalSnapshot = { bullish: false, bearish: false };

/** Bill Williams 5-bar fractal on the most recent completed window (middle = length - 3). */
export function detectFractals(closedCandles: readonly Candle[]): FractalSnapshot {
  if (closedCandles.length < 5) return EMPTY_FRACTAL;

  const mid = closedCandles.length - 3;
  const lows = Array.from({ length: 5 }, (_, i) => closedCandles[mid - 2 + i].low);
  const highs = Array.from({ length: 5 }, (_, i) => closedCandles[mid - 2 + i].high);

  const bullish =
    lows[2] < lows[0] &&
    lows[2] < lows[1] &&
    lows[2] < lows[3] &&
    lows[2] < lows[4];
  const bearish =
    highs[2] > highs[0] &&
    highs[2] > highs[1] &&
    highs[2] > highs[3] &&
    highs[2] > highs[4];

  return { bullish, bearish };
}
