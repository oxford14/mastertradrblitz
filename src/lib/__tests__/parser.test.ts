import { describe, expect, it } from 'vitest';
import { parseWsPayload, resolveQuotePrice } from '../exnova/parser';

describe('resolveQuotePrice', () => {
  it('prefers close over ask/bid', () => {
    expect(resolveQuotePrice({ close: 1.1439, ask: 1.144, bid: 1.1438 })).toBe(
      1.1439,
    );
  });

  it('uses ask/bid mid when close missing', () => {
    expect(resolveQuotePrice({ ask: 1.144, bid: 1.1438 })).toBeCloseTo(1.1439, 4);
  });
});

describe('parseWsPayload', () => {
  it('parses quote-generated with ask/bid', () => {
    const payload = JSON.stringify({
      name: 'quote-generated',
      msg: {
        quotes: [
          { active_id: 76, ask: 1.144, bid: 1.1438, time: 1700000000000 },
        ],
      },
    });
    const events = parseWsPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'tick',
      symbol: '76',
      price: 1.1439,
    });
  });

  it('parses singular candle-generated with ask/bid/close', () => {
    const payload = JSON.stringify({
      name: 'candle-generated',
      msg: {
        active_id: 76,
        size: 1,
        open: 1.1435,
        max: 1.1442,
        min: 1.1435,
        close: 1.1439,
        ask: 1.144,
        bid: 1.1438,
        from: 1700000000,
      },
    });
    const events = parseWsPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'candle',
      symbol: '76',
      ohlc: { close: 1.1439 },
    });
  });

  it('parses candle-generated candles array', () => {
    const payload = JSON.stringify({
      name: 'candle-generated',
      msg: {
        active_id: 76,
        size: 5,
        candles: [
          {
            open: 1.1,
            max: 1.2,
            min: 1.0,
            close: 1.15,
            from: 1700000000000,
          },
        ],
      },
    });
    const events = parseWsPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'candle',
      symbol: '76',
      intervalSec: 5,
      isClosed: true,
    });
  });

  it('parses candle-generated-update', () => {
    const payload = JSON.stringify({
      name: 'candle-generated-update',
      msg: {
        active_id: 76,
        size: 5,
        open: 1.1,
        max: 1.2,
        min: 1.0,
        close: 1.15,
        from: 1700000000000,
        at: 1700000005000,
      },
    });
    const events = parseWsPayload(payload);
    expect(events[0]?.type).toBe('candle');
  });

  it('ignores generic value fields without quote context', () => {
    const payload = JSON.stringify({
      name: 'some-other-event',
      msg: { active_id: 76, value: 0.35, time: 1700000000000 },
    });
    const events = parseWsPayload(payload);
    expect(events).toHaveLength(0);
  });
});
