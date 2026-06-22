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

export function isNearLowerBand(
  price: number,
  lower: number,
  proximityPct: number,
): boolean {
  const threshold = lower * (1 + proximityPct / 100);
  return price <= threshold;
}

export function isNearUpperBand(
  price: number,
  upper: number,
  proximityPct: number,
): boolean {
  const threshold = upper * (1 - proximityPct / 100);
  return price >= threshold;
}
