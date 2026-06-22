import type { Candle, WickSnapshot } from '../../types';

export const EMPTY_WICK: WickSnapshot = {
  bullishRejection: false,
  bearishRejection: false,
};

function candleBody(c: Candle): number {
  return Math.abs(c.close - c.open);
}

function lowerWick(c: Candle): number {
  return Math.min(c.open, c.close) - c.low;
}

function upperWick(c: Candle): number {
  return c.high - Math.max(c.open, c.close);
}

export function detectRejectionWick(
  closedCandles: readonly Candle[],
): WickSnapshot {
  if (closedCandles.length === 0) {
    return EMPTY_WICK;
  }

  const curr = closedCandles[closedCandles.length - 1];
  const body = candleBody(curr);

  if (body === 0) {
    return EMPTY_WICK;
  }

  return {
    bullishRejection: lowerWick(curr) >= 2 * body,
    bearishRejection: upperWick(curr) >= 2 * body,
  };
}
