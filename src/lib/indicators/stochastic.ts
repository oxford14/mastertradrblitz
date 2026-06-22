function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export interface StochasticResult {
  k: number;
  d: number;
  crossUp: boolean;
  crossDown: boolean;
}

export class StochasticOscillator {
  private readonly kPeriod: number;
  private readonly dPeriod: number;
  private readonly smoothing: number;
  private closes: number[] = [];
  private highs: number[] = [];
  private lows: number[] = [];
  private rawKHistory: number[] = [];
  private smoothedKHistory: number[] = [];
  private k = 50;
  private d = 50;
  private prevK = 50;
  private prevD = 50;

  constructor(kPeriod = 8, dPeriod = 3, smoothing = 3) {
    this.kPeriod = kPeriod;
    this.dPeriod = dPeriod;
    this.smoothing = smoothing;
  }

  update(high: number, low: number, close: number): StochasticResult {
    this.closes.push(close);
    this.highs.push(high);
    this.lows.push(low);

    const maxLen = this.kPeriod + this.smoothing + this.dPeriod + 5;
    if (this.closes.length > maxLen) {
      this.closes.shift();
      this.highs.shift();
      this.lows.shift();
    }

    if (this.closes.length >= this.kPeriod) {
      const highSlice = this.highs.slice(-this.kPeriod);
      const lowSlice = this.lows.slice(-this.kPeriod);
      const highest = Math.max(...highSlice);
      const lowest = Math.min(...lowSlice);
      const rawK =
        highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100;

      this.rawKHistory.push(rawK);
      if (this.rawKHistory.length > this.smoothing + 10) {
        this.rawKHistory.shift();
      }

      if (this.rawKHistory.length >= this.smoothing) {
        this.k = sma(this.rawKHistory, this.smoothing);
        this.smoothedKHistory.push(this.k);
        if (this.smoothedKHistory.length > this.dPeriod + 10) {
          this.smoothedKHistory.shift();
        }
        if (this.smoothedKHistory.length >= this.dPeriod) {
          this.d = sma(this.smoothedKHistory, this.dPeriod);
        }
      }
    }

    const crossUp = this.prevK <= this.prevD && this.k > this.d;
    const crossDown = this.prevK >= this.prevD && this.k < this.d;

    this.prevK = this.k;
    this.prevD = this.d;

    return { k: this.k, d: this.d, crossUp, crossDown };
  }

  get(): { k: number; d: number } {
    return { k: this.k, d: this.d };
  }

  reset(): void {
    this.closes = [];
    this.highs = [];
    this.lows = [];
    this.rawKHistory = [];
    this.smoothedKHistory = [];
    this.k = 50;
    this.d = 50;
    this.prevK = 50;
    this.prevD = 50;
  }
}
