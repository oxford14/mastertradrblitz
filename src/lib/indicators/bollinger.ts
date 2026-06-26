function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
}

/** Bands narrower than this (as % of middle) are treated as undefined — avoids false "touch" when std ≈ 0. */
export const MIN_BAND_WIDTH_PCT = 0.02;

export function computeBollinger(
  closes: number[],
  period: number,
  deviation: number,
): BollingerResult {
  if (closes.length < period) {
    const last = closes[closes.length - 1] ?? 0;
    return { upper: last, middle: last, lower: last };
  }

  const slice = closes.slice(-period);
  const middle = sma(slice, period);
  const variance =
    slice.reduce((s, p) => s + (p - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: middle + deviation * std,
    middle,
    lower: middle - deviation * std,
  };
}

function hasMeaningfulBandWidth(lower: number, upper: number): boolean {
  const middle = (upper + lower) / 2;
  const width = upper - lower;
  if (!Number.isFinite(width) || width <= 0 || middle <= 0) return false;
  return width / middle >= MIN_BAND_WIDTH_PCT / 100;
}

/**
 * HIGHER setup: price near the lower band.
 * proximityPct is a % of total band width (upper − lower), not a % of price level.
 */
export function isNearLowerBand(
  price: number,
  lower: number,
  upper: number,
  proximityPct: number,
): boolean {
  if (!hasMeaningfulBandWidth(lower, upper)) return false;
  const width = upper - lower;
  const margin = width * (proximityPct / 100);
  return price <= lower + margin;
}

/**
 * LOWER setup: price near the upper band.
 * proximityPct is a % of total band width (upper − lower), not a % of price level.
 */
export function isNearUpperBand(
  price: number,
  upper: number,
  lower: number,
  proximityPct: number,
): boolean {
  if (!hasMeaningfulBandWidth(lower, upper)) return false;
  const width = upper - lower;
  const margin = width * (proximityPct / 100);
  return price >= upper - margin;
}
