import type { Candle, CandlePatternName, OHLC, PatternSnapshot } from '../../types';

export const EMPTY_PATTERN: PatternSnapshot = {
  pattern: 'None',
  bullishEngulfing: false,
  bearishEngulfing: false,
};

function isBullish(c: OHLC): boolean {
  return c.close > c.open;
}

function isBearish(c: OHLC): boolean {
  return c.close < c.open;
}

function detectBullishEngulfing(prev: Candle, curr: Candle): boolean {
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open <= prev.close &&
    curr.close >= prev.open
  );
}

function detectBearishEngulfing(prev: Candle, curr: Candle): boolean {
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open >= prev.close &&
    curr.close <= prev.open
  );
}

export function detectEngulfing(
  closedCandles: readonly Candle[],
): PatternSnapshot {
  if (closedCandles.length < 2) {
    return EMPTY_PATTERN;
  }

  const curr = closedCandles[closedCandles.length - 1];
  const prev = closedCandles[closedCandles.length - 2];
  const bullishEngulfing = detectBullishEngulfing(prev, curr);
  const bearishEngulfing = detectBearishEngulfing(prev, curr);

  let pattern: CandlePatternName = 'None';
  if (bullishEngulfing) pattern = 'Bullish Engulfing';
  else if (bearishEngulfing) pattern = 'Bearish Engulfing';

  return { pattern, bullishEngulfing, bearishEngulfing };
}
