import { isValidPrice } from '../exnova/parser';

const LOCK_THRESHOLD = 5;
const OUTLIER_RATIO = 0.15;

export class ActiveSymbolTracker {
  private primaryActiveId: string | null = null;
  private counts = new Map<string, number>();
  private recentPrices: number[] = [];
  private onChange: (() => void) | null = null;

  setOnChange(cb: () => void): void {
    this.onChange = cb;
  }

  getPrimaryId(): string | null {
    return this.primaryActiveId;
  }

  /** Record a valid event; returns false if event should be dropped. */
  accept(symbol: string, price: number): boolean {
    if (!symbol || symbol === 'unknown' || !isValidPrice(price)) return false;

    if (this.primaryActiveId === null) {
      this.recordCandidate(symbol);
      const leader = this.getLeader();
      if (leader && leader[1] >= LOCK_THRESHOLD) {
        this.lock(leader[0]);
        this.onChange?.();
      } else if (leader && symbol !== leader[0]) {
        return false;
      }
    } else if (symbol !== this.primaryActiveId) {
      this.recordCandidate(symbol);
      const challenger = this.getLeader();
      if (
        challenger &&
        challenger[0] !== this.primaryActiveId &&
        challenger[1] >= LOCK_THRESHOLD * 2
      ) {
        this.lock(challenger[0]);
        this.onChange?.();
      }
      return symbol === this.primaryActiveId;
    }

    if (!this.passesOutlierGuard(price)) return false;

    this.recentPrices.push(price);
    if (this.recentPrices.length > 20) this.recentPrices.shift();
    return true;
  }

  reset(): void {
    this.primaryActiveId = null;
    this.counts.clear();
    this.recentPrices = [];
  }

  private getLeader(): [string, number] | null {
    let best: [string, number] | null = null;
    for (const entry of this.counts.entries()) {
      if (!best || entry[1] > best[1]) best = entry;
    }
    return best;
  }

  private recordCandidate(symbol: string): void {
    this.counts.set(symbol, (this.counts.get(symbol) ?? 0) + 1);
  }

  private lock(symbol: string): void {
    if (this.primaryActiveId === symbol) return;
    this.primaryActiveId = symbol;
    this.counts.clear();
    this.recentPrices = [];
  }

  private passesOutlierGuard(price: number): boolean {
    if (this.recentPrices.length < 3) return true;
    const sorted = [...this.recentPrices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (median <= 0) return true;
    return Math.abs(price - median) / median <= OUTLIER_RATIO;
  }
}
