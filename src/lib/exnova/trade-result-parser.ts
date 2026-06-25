import type { TradeCloseEvent, TradeDirection } from '../../types';

const BLITZ_INSTRUMENT_HINTS = [
  'blitz',
  'turbo',
  'binary',
  'digital',
  'option',
];

const TRADE_CLOSE_HINTS = [
  'position-changed',
  'option-closed',
  'history-positions',
  'history_positions',
  '"status":"closed"',
  '"status": "closed"',
];

function mightContainTradeClose(text: string): boolean {
  const sample = text.length > 50_000 ? text.slice(0, 50_000) : text;
  const lower = sample.toLowerCase();
  return TRADE_CLOSE_HINTS.some((hint) => lower.includes(hint));
}

function bufferToString(data: string | ArrayBuffer): string {
  if (typeof data === 'string') return data;
  try {
    return new TextDecoder('utf-8').decode(data);
  } catch {
    return '';
  }
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstFiniteNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function resolveClosedProfit(rec: Record<string, unknown>): number {
  const raw = rec.raw_event;
  const rawRec = asRecord(raw);
  const nested = rawRec
    ? Object.values(rawRec).map(asRecord).find(Boolean)
    : null;

  const profit =
    firstFiniteNumber(
      rec.sell_profit,
      rec.close_profit,
      rec.profit,
      rec.profit_amount,
      rec.pnl,
      rec.pnl_net,
      rec.pnl_net_enrolled,
      rec.sell_profit_enrolled,
      nested?.sell_profit,
      nested?.close_profit,
      nested?.profit,
      nested?.pnl,
      nested?.pnl_net,
    ) ?? 0;

  return profit;
}

function isClosedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'closed' || s === 'close' || s === 'sold' || s === 'expired';
}

function isBlitzInstrument(instrumentType: string): boolean {
  const lower = instrumentType.toLowerCase();
  if (!lower) return true;
  return BLITZ_INSTRUMENT_HINTS.some((hint) => lower.includes(hint));
}

export function resolveTradeDirection(
  rec: Record<string, unknown>,
): TradeDirection | null {
  const direction = String(rec.direction ?? rec.type ?? '').toLowerCase();
  if (direction === 'call' || direction === 'long' || direction === 'higher') {
    return 'HIGHER';
  }
  if (direction === 'put' || direction === 'short' || direction === 'lower') {
    return 'LOWER';
  }
  return null;
}

function positionId(rec: Record<string, unknown>): string | null {
  const id = rec.id ?? rec.external_id ?? rec.position_id;
  if (id === undefined || id === null || id === '') return null;
  return String(id);
}

function closedAtMs(rec: Record<string, unknown>): number {
  const ts = firstFiniteNumber(
    rec.close_time,
    rec.closed_at,
    rec.close_time_ms,
    rec.updated_at,
    rec.time,
  );
  if (ts !== null && ts > 1_000_000_000_000) return ts;
  if (ts !== null && ts > 0) return ts * 1000;
  return Date.now();
}

function closeEventFromRecord(
  rec: Record<string, unknown>,
  source: string,
): TradeCloseEvent | null {
  const status = String(rec.status ?? '').toLowerCase();
  const explicitlyClosed =
    status.length > 0
      ? isClosedStatus(status)
      : source === 'option-closed' || source.includes('history');

  if (!explicitlyClosed && source !== 'option-closed') return null;

  const id = positionId(rec);
  if (!id) return null;

  const instrumentType = String(rec.instrument_type ?? rec.instrument ?? '');
  if (instrumentType && !isBlitzInstrument(instrumentType)) return null;

  const profit = resolveClosedProfit(rec);
  return {
    id,
    profit,
    outcome: profit > 0 ? 'win' : 'loss',
    closedAt: closedAtMs(rec),
    direction: resolveTradeDirection(rec),
    instrumentType: instrumentType || undefined,
  };
}

function extractFromNamedMessage(obj: Record<string, unknown>): TradeCloseEvent[] {
  const name = typeof obj.name === 'string' ? obj.name : '';
  const msg = asRecord(obj.msg);
  if (!msg) return [];

  if (name === 'position-changed' || name === 'option-closed') {
    const ev = closeEventFromRecord(msg, name);
    return ev ? [ev] : [];
  }

  if (name === 'history-positions' || name.includes('history')) {
    const positions = msg.positions ?? msg.deals ?? msg.items ?? msg.data;
    const list = Array.isArray(positions) ? positions : positions ? [positions] : [];
    const events: TradeCloseEvent[] = [];
    for (const item of list) {
      const rec = asRecord(item);
      if (!rec) continue;
      const ev = closeEventFromRecord(rec, name);
      if (ev) events.push(ev);
    }
    return events;
  }

  return [];
}

function walkForCloseEvents(obj: unknown, events: TradeCloseEvent[], depth = 0): void {
  if (depth > 8 || obj == null) return;

  if (Array.isArray(obj)) {
    for (const item of obj) walkForCloseEvents(item, events, depth + 1);
    return;
  }

  const rec = asRecord(obj);
  if (!rec) return;

  if (typeof rec.name === 'string') {
    events.push(...extractFromNamedMessage(rec));
    return;
  }

  const status = String(rec.status ?? '').toLowerCase();
  if (isClosedStatus(status) && positionId(rec)) {
    const ev = closeEventFromRecord(rec, 'walk');
    if (ev) events.push(ev);
    return;
  }

  for (const value of Object.values(rec)) {
    walkForCloseEvents(value, events, depth + 1);
  }
}

export function parseTradeResultPayload(
  raw: string | ArrayBuffer,
): TradeCloseEvent[] {
  const text = bufferToString(raw);
  if (!text || !mightContainTradeClose(text)) return [];

  const json = tryParseJson(text);
  if (!json) return [];

  const events: TradeCloseEvent[] = [];

  if (Array.isArray(json)) {
    for (const item of json) {
      const rec = asRecord(item);
      if (rec) events.push(...extractFromNamedMessage(rec));
    }
  } else {
    const rec = asRecord(json);
    if (rec) events.push(...extractFromNamedMessage(rec));
  }

  if (events.length === 0 && text.toLowerCase().includes('closed')) {
    walkForCloseEvents(json, events);
  }

  const deduped = new Map<string, TradeCloseEvent>();
  for (const ev of events) {
    deduped.set(ev.id, ev);
  }
  return [...deduped.values()];
}
