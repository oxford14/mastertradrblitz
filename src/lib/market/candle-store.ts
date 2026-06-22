import type { Candle } from '../../types';

const MAX_CANDLES = 500;

export type CandleStoreListener = (store: CandleStore) => void;

export class CandleStore {
  private closed: Candle[] = [];
  private forming: Candle | null = null;
  private symbol = 'unknown';
  private latestPrice = 0;
  private intervalSec = 5;
  private wsConnected = false;
  private listeners = new Set<CandleStoreListener>();

  onUpdate(listener: CandleStoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this);
  }

  setWsConnected(connected: boolean): void {
    this.wsConnected = connected;
    this.notify();
  }

  isWsConnected(): boolean {
    return this.wsConnected;
  }

  setIntervalSec(sec: number): void {
    this.intervalSec = sec;
  }

  getIntervalSec(): number {
    return this.intervalSec;
  }

  addClosed(candle: Candle): void {
    if (candle.symbol !== 'unknown') this.symbol = candle.symbol;
    this.latestPrice = candle.close;

    const last = this.closed[this.closed.length - 1];
    if (last && last.timestamp === candle.timestamp) {
      this.closed[this.closed.length - 1] = candle;
    } else if (!last || candle.timestamp > last.timestamp) {
      this.closed.push(candle);
      if (this.closed.length > MAX_CANDLES) {
        this.closed = this.closed.slice(-MAX_CANDLES);
      }
    }
    this.forming = null;
    this.notify();
  }

  setForming(candle: Candle): void {
    if (candle.symbol !== 'unknown') this.symbol = candle.symbol;
    this.latestPrice = candle.close;
    this.forming = candle;
    this.notify();
  }

  /** Closed bars only — used for signal evaluation on bar close. */
  getClosedCandles(): readonly Candle[] {
    return this.closed;
  }

  /** Closed + forming bar — used for live indicator display. */
  getDisplayCandles(): readonly Candle[] {
    return this.forming ? [...this.closed, this.forming] : this.closed;
  }

  getCandles(): readonly Candle[] {
    return this.getDisplayCandles();
  }

  getLatestPrice(): number {
    return this.latestPrice;
  }

  getSymbol(): string {
    return this.symbol;
  }

  getCount(): number {
    return this.closed.length;
  }

  clear(): void {
    this.closed = [];
    this.forming = null;
    this.latestPrice = 0;
    this.notify();
  }
}
