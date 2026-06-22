export function computeEma(closes: readonly number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes[closes.length - 1] ?? 0;

  const seed = closes.slice(0, period);
  let ema = seed.reduce((sum, value) => sum + value, 0) / period;
  const multiplier = 2 / (period + 1);

  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }

  return ema;
}
