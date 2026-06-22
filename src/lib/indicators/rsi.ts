export class RSI {
  private readonly period: number;
  private gains: number[] = [];
  private losses: number[] = [];
  private prevPrice: number | null = null;
  private value = 50;

  constructor(period = 14) {
    this.period = period;
  }

  update(price: number): number {
    if (this.prevPrice === null) {
      this.prevPrice = price;
      return this.value;
    }

    const change = price - this.prevPrice;
    this.prevPrice = price;
    this.gains.push(change > 0 ? change : 0);
    this.losses.push(change < 0 ? Math.abs(change) : 0);

    if (this.gains.length > this.period) {
      this.gains.shift();
      this.losses.shift();
    }

    if (this.gains.length < this.period) return this.value;

    const avgGain = this.gains.reduce((a, b) => a + b, 0) / this.period;
    const avgLoss = this.losses.reduce((a, b) => a + b, 0) / this.period;

    if (avgLoss === 0) {
      this.value = 100;
    } else {
      const rs = avgGain / avgLoss;
      this.value = 100 - 100 / (1 + rs);
    }

    return this.value;
  }

  get(): number {
    return this.value;
  }

  reset(): void {
    this.gains = [];
    this.losses = [];
    this.prevPrice = null;
    this.value = 50;
  }
}

export function computeRsiSeries(closes: number[], period: number): number[] {
  const rsi = new RSI(period);
  return closes.map((c) => rsi.update(c));
}
