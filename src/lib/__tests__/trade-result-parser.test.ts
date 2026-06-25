import { describe, expect, it } from 'vitest';
import {
  parseTradeResultPayload,
  resolveClosedProfit,
} from '../exnova/trade-result-parser';

describe('resolveClosedProfit', () => {
  it('prefers sell_profit for closed positions', () => {
    expect(
      resolveClosedProfit({
        sell_profit: 182,
        invest: 100,
        status: 'closed',
      }),
    ).toBe(182);
  });

  it('returns 0 for break-even / loss closes', () => {
    expect(
      resolveClosedProfit({
        sell_profit: 0,
        invest: 100,
        status: 'closed',
      }),
    ).toBe(0);
  });
});

describe('parseTradeResultPayload', () => {
  it('parses position-changed closed win', () => {
    const payload = JSON.stringify({
      name: 'position-changed',
      msg: {
        id: 987654321,
        status: 'closed',
        instrument_type: 'turbo-option',
        direction: 'call',
        invest: 100,
        sell_profit: 182,
        close_time: 1700000005,
      },
    });

    const events = parseTradeResultPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: '987654321',
      profit: 182,
      outcome: 'win',
      direction: 'HIGHER',
    });
  });

  it('parses position-changed closed loss', () => {
    const payload = JSON.stringify({
      name: 'position-changed',
      msg: {
        id: 987654322,
        status: 'closed',
        instrument_type: 'blitz',
        direction: 'put',
        invest: 100,
        sell_profit: 0,
        close_time: 1700000010,
      },
    });

    const events = parseTradeResultPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: '987654322',
      profit: 0,
      outcome: 'loss',
      direction: 'LOWER',
    });
  });

  it('dedupes by position id when payload repeats', () => {
    const win = {
      name: 'position-changed',
      msg: {
        id: 111,
        status: 'closed',
        sell_profit: 50,
        direction: 'call',
      },
    };
    const payload = JSON.stringify([win, win]);
    const events = parseTradeResultPayload(payload);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('111');
  });

  it('ignores non-closed position-changed updates', () => {
    const payload = JSON.stringify({
      name: 'position-changed',
      msg: {
        id: 222,
        status: 'open',
        sell_profit: 0,
      },
    });
    expect(parseTradeResultPayload(payload)).toHaveLength(0);
  });

  it('skips market tick payloads without parsing', () => {
    const payload = JSON.stringify({
      name: 'quote-generated',
      msg: {
        quotes: [{ active_id: 76, ask: 1.144, bid: 1.1438, time: 1700000000000 }],
      },
    });
    expect(parseTradeResultPayload(payload)).toHaveLength(0);
  });
});
