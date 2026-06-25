export function computeSma(closes: readonly number[], period: number): number {
  if (closes.length === 0) return 0;
  if (closes.length < period) return closes[closes.length - 1] ?? 0;

  const slice = closes.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}
