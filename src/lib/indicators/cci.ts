import type { Candle } from '../../types';

function typicalPrice(candle: Candle): number {
  return (candle.high + candle.low + candle.close) / 3;
}

/** Standard CCI on typical price; null during warmup. */
export function computeCci(
  candles: readonly Candle[],
  period: number,
): number | null {
  if (period < 1 || candles.length < period) return null;

  const typicalPrices = candles.map(typicalPrice);
  const window = typicalPrices.slice(-period);
  const sma = window.reduce((sum, tp) => sum + tp, 0) / period;
  const meanDev =
    window.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;

  if (meanDev === 0) return 0;

  const lastTp = typicalPrices[typicalPrices.length - 1];
  return (lastTp - sma) / (0.015 * meanDev);
}
