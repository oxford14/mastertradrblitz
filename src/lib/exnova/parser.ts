import type { MarketEvent, OHLC } from '../../types';

const DEV_LOG_LIMIT = 40;
const loggedShapes = new Set<string>();

const MIN_VALID_PRICE = 0.0001;
const MAX_VALID_PRICE = 1_000_000;

export function isValidPrice(price: number): boolean {
  return (
    Number.isFinite(price) && price > MIN_VALID_PRICE && price < MAX_VALID_PRICE
  );
}

function bufferToString(data: string | ArrayBuffer): string {
  if (typeof data === 'string') return data;
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    return '';
  }
}

function shapeKey(text: string): string {
  if (!text) return 'empty';
  if (text.length > 200) return `${text.slice(0, 80)}...${text.length}b`;
  return text.replace(/\d+(\.\d+)?/g, 'N');
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Prefer close, else mid of ask/bid for Quadcore candle/quote objects. */
export function resolveQuotePrice(rec: Record<string, unknown>): number {
  const close = Number(rec.close ?? rec.c ?? 0);
  if (isValidPrice(close)) return close;

  const ask = Number(rec.ask ?? 0);
  const bid = Number(rec.bid ?? 0);
  if (isValidPrice(ask) && isValidPrice(bid)) return (ask + bid) / 2;
  if (isValidPrice(ask)) return ask;
  if (isValidPrice(bid)) return bid;

  const price = Number(rec.price ?? 0);
  if (isValidPrice(price)) return price;

  return 0;
}

function ohlcFromRecord(rec: Record<string, unknown>): OHLC | null {
  const close = resolveQuotePrice(rec);
  if (!isValidPrice(close)) return null;

  const open = Number(rec.open ?? rec.o ?? close);
  const high = Number(rec.max ?? rec.high ?? rec.h ?? close);
  const low = Number(rec.min ?? rec.low ?? rec.l ?? close);

  return {
    open: isValidPrice(open) ? open : close,
    high: Math.max(high, close, open),
    low: Math.min(low, close, open),
    close,
  };
}

function candleEvent(
  rec: Record<string, unknown>,
  active: string,
  interval: number,
  isClosed: boolean,
): MarketEvent | null {
  const ohlc = ohlcFromRecord(rec);
  if (!ohlc) return null;

  const ts = Number(rec.from ?? rec.time ?? rec.t ?? Date.now());
  return {
    type: 'candle',
    symbol: active,
    intervalSec: interval || 5,
    ohlc,
    ts,
    isClosed,
  };
}

function tickFromRecord(rec: Record<string, unknown>): MarketEvent | null {
  const symbol = String(rec.active_id ?? rec.active ?? '');
  if (!symbol || symbol === 'undefined') return null;

  const price = resolveQuotePrice(rec);
  if (!isValidPrice(price)) return null;

  const ts = Number(rec.time ?? rec.t ?? rec.from ?? Date.now());
  return { type: 'tick', symbol, price, ts };
}

function extractFromQuadcore(obj: Record<string, unknown>): MarketEvent[] {
  const events: MarketEvent[] = [];
  const name = typeof obj.name === 'string' ? obj.name : '';
  const msg = obj.msg as Record<string, unknown> | undefined;
  if (!msg) return events;

  if (
    name === 'candle-generated' ||
    name === 'candles-generated' ||
    name === 'candle-generated-update' ||
    name === 'candles-generated-update'
  ) {
    const active = String(msg.active_id ?? msg.active ?? msg.id ?? 'unknown');
    const interval = Number(msg.size ?? msg.interval ?? msg.period ?? 5);
    const isUpdate = name.includes('update');
    const isClosed = isUpdate ? Boolean(msg.at ?? msg.closed ?? false) : true;

    const nested = msg.candles ?? msg.data;
    if (nested != null) {
      const list = (Array.isArray(nested) ? nested : [nested]) as Record<
        string,
        unknown
      >[];
      for (const c of list) {
        const ev = candleEvent(c, active, interval, true);
        if (ev) events.push(ev);
      }
      return events;
    }

    const ev = candleEvent(msg, active, interval, isClosed);
    if (ev) events.push(ev);
    return events;
  }

  if (name === 'quote-generated' || name === 'quotes' || name === 'quote') {
    const quotes = (msg.quotes ?? [msg]) as Record<string, unknown>[];
    const list = Array.isArray(quotes) ? quotes : [quotes];
    for (const q of list) {
      const tick = tickFromRecord(q);
      if (tick) events.push(tick);
    }
    return events;
  }

  return events;
}

/** Only extract explicit candle objects — no generic value/price walk. */
function walkForCandlesOnly(obj: unknown, events: MarketEvent[], depth = 0): void {
  if (depth > 6 || obj == null) return;

  if (Array.isArray(obj)) {
    for (const item of obj) walkForCandlesOnly(item, events, depth + 1);
    return;
  }

  if (typeof obj !== 'object') return;
  const rec = obj as Record<string, unknown>;

  const hasOhlc =
    (rec.open != null || rec.o != null) &&
    (rec.close != null || rec.c != null) &&
    (rec.max != null || rec.high != null || rec.min != null || rec.low != null);

  if (hasOhlc && (rec.active_id != null || rec.active != null)) {
    const active = String(rec.active_id ?? rec.active);
    const interval = Number(rec.size ?? rec.interval ?? 5);
    const ev = candleEvent(rec, active, interval, true);
    if (ev) events.push(ev);
    return;
  }

  for (const value of Object.values(rec)) {
    walkForCandlesOnly(value, events, depth + 1);
  }
}

export interface ParseOptions {
  devLog?: boolean;
}

export function parseWsPayload(
  raw: string | ArrayBuffer,
  options: ParseOptions = {},
): MarketEvent[] {
  const text = bufferToString(raw);
  if (!text) return [];

  if (options.devLog && loggedShapes.size < DEV_LOG_LIMIT) {
    const key = shapeKey(text);
    if (!loggedShapes.has(key)) {
      loggedShapes.add(key);
      console.debug('[MTB] WS shape:', key, text.slice(0, 500));
    }
  }

  const events: MarketEvent[] = [];

  const json = tryParseJson(text);
  if (json && typeof json === 'object') {
    if (Array.isArray(json)) {
      for (const item of json) {
        if (item && typeof item === 'object') {
          events.push(...extractFromQuadcore(item as Record<string, unknown>));
        }
      }
    } else {
      events.push(...extractFromQuadcore(json as Record<string, unknown>));
    }
  }

  if (events.length === 0) {
    walkForCandlesOnly(json, events);
  }

  const deduped = new Map<string, MarketEvent>();
  for (const ev of events) {
    const key =
      ev.type === 'tick'
        ? `t:${ev.symbol}:${ev.ts}:${ev.price}`
        : `c:${ev.symbol}:${ev.ts}:${ev.ohlc.close}`;
    deduped.set(key, ev);
  }
  return [...deduped.values()];
}

export function resetDevLog(): void {
  loggedShapes.clear();
}
