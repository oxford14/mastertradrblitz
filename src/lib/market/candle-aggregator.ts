import type { Candle, MarketEvent } from '../../types';

export class CandleAggregator {
  private intervalSec: number;
  private current: Candle | null = null;

  constructor(intervalSec: number) {
    this.intervalSec = intervalSec;
  }

  setIntervalSec(sec: number): void {
    if (sec !== this.intervalSec) {
      this.intervalSec = sec;
      this.current = null;
    }
  }

  processTick(
    symbol: string,
    price: number,
    ts: number,
  ): { closed: Candle | null; forming: Candle | null } {
    const bucketStart =
      Math.floor(ts / (this.intervalSec * 1000)) * this.intervalSec * 1000;

    let closed: Candle | null = null;

    if (!this.current || this.current.timestamp !== bucketStart) {
      if (this.current) closed = { ...this.current };
      this.current = {
        symbol,
        intervalSec: this.intervalSec,
        timestamp: bucketStart,
        open: price,
        high: price,
        low: price,
        close: price,
      };
    } else {
      this.current.high = Math.max(this.current.high, price);
      this.current.low = Math.min(this.current.low, price);
      this.current.close = price;
    }

    return { closed, forming: this.current ? { ...this.current } : null };
  }

  ingestEvent(event: MarketEvent): Candle | null {
    if (event.type === 'tick') {
      return this.processTick(event.symbol, event.price, event.ts).closed;
    }

    if (event.isClosed) {
      return {
        symbol: event.symbol,
        intervalSec: event.intervalSec,
        timestamp: event.ts,
        ...event.ohlc,
      };
    }

    return null;
  }
}
