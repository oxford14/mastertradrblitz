import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradingPipeline } from '../pipeline';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { evaluateSignal } from '../signals/signal-engine';
import type { AppSettings } from '../../types';

vi.mock('../signals/signal-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../signals/signal-engine')>();
  return {
    ...actual,
    evaluateSignal: vi.fn(actual.evaluateSignal),
  };
});

const SYMBOL = 76;
const INTERVAL_SEC = 5;

function quotePayload(timeMs: number): string {
  return JSON.stringify({
    name: 'quote-generated',
    msg: {
      quotes: [{ active_id: SYMBOL, ask: 1.144, bid: 1.1438, time: timeMs }],
    },
  });
}

function closedCandlePayload(fromMs: number): string {
  return JSON.stringify({
    name: 'candle-generated',
    msg: {
      active_id: SYMBOL,
      size: INTERVAL_SEC,
      candles: [
        {
          open: 1.1,
          max: 1.2,
          min: 1.0,
          close: 1.15,
          from: fromMs,
        },
      ],
    },
  });
}

function lockSymbol(pipeline: TradingPipeline, timeMs: number): void {
  for (let i = 0; i < 5; i += 1) {
    pipeline.handleWsMessage(quotePayload(timeMs + i));
  }
}

function settingsWithCooldown(cooldownSec: number): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    market: {
      ...DEFAULT_SETTINGS.market,
      candleIntervalSec: INTERVAL_SEC,
      signalHoldSec: 0,
      signalCooldownSec: cooldownSec,
    },
  };
}

describe('TradingPipeline trade cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(evaluateSignal).mockReturnValue({
      signal: 'HIGHER',
      tradeDirection: 'HIGHER',
      activeCheck: {
        rsi: true,
        stochastic: true,
        candlePattern: false,
        bollinger: false,
        rejectionWick: false,
      },
      debug: {
        reason: 'HIGHER',
        higherConfidence: {
          rsi: 25,
          stochastic: 30,
          candlePattern: 0,
          bollinger: 0,
          rejectionWick: 0,
          total: 55,
        },
        lowerConfidence: {
          rsi: 0,
          stochastic: 0,
          candlePattern: 0,
          bollinger: 0,
          rejectionWick: 0,
          total: 0,
        },
        adx: 25,
        plusDi: 30,
        minusDi: 15,
      },
      indicators: {
        warmedUp: true,
        warmupRequired: 21,
        warmupCurrent: 25,
        maFast: 100,
        maSlow: 99,
        maTrend: 'up',
      } as never,
      pattern: { pattern: null, bullishEngulfing: false, bearishEngulfing: false },
      dualConfidence: {
        higher: {
          rsi: 25,
          stochastic: 30,
          candlePattern: 0,
          bollinger: 0,
          rejectionWick: 0,
          total: 80,
        },
        lower: {
          rsi: 0,
          stochastic: 0,
          candlePattern: 0,
          bollinger: 0,
          rejectionWick: 0,
          total: 0,
        },
      },
      confidence: {
        rsi: 25,
        stochastic: 30,
        candlePattern: 0,
        bollinger: 0,
        rejectionWick: 0,
        total: 80,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not auto-trade on every bar while cooldown is active (hold=0)', () => {
    const pipeline = new TradingPipeline(settingsWithCooldown(10));
    const trades: string[] = [];
    pipeline.onTradeConfirmed(({ signal }) => trades.push(signal));

    lockSymbol(pipeline, 0);

    const barTimes = [5_000, 10_000, 15_000, 20_000, 25_000];
    for (const barTime of barTimes) {
      vi.setSystemTime(barTime);
      pipeline.handleWsMessage(closedCandlePayload(barTime));
    }

    expect(trades.length).toBeLessThan(barTimes.length);
    expect(trades).toEqual(['HIGHER', 'HIGHER', 'HIGHER']);
  });

  it('blocks new emits while trade placement gate reports open trade', () => {
    const pipeline = new TradingPipeline(settingsWithCooldown(0));
    let open = false;
    pipeline.setTradePlacementGate({
      canPlaceTrade: () => !open,
      secondsUntilReady: () => (open ? 3 : 0),
    });
    const trades: string[] = [];
    pipeline.onTradeConfirmed(({ signal }) => {
      trades.push(signal);
      open = true;
    });

    lockSymbol(pipeline, 0);
    vi.setSystemTime(5_000);
    pipeline.handleWsMessage(closedCandlePayload(5_000));
    vi.setSystemTime(10_000);
    pipeline.handleWsMessage(closedCandlePayload(10_000));

    expect(trades).toEqual(['HIGHER']);
  });

  it('uses trade expiry as cooldown floor when it exceeds signal cooldown', () => {
    const pipeline = new TradingPipeline({
      ...settingsWithCooldown(3),
      market: {
        ...settingsWithCooldown(3).market,
        tradeExpirySec: 5,
      },
    });
    const trades: string[] = [];
    pipeline.onTradeConfirmed(({ signal }) => trades.push(signal));

    lockSymbol(pipeline, 0);
    vi.setSystemTime(5_000);
    pipeline.handleWsMessage(closedCandlePayload(5_000));
    vi.setSystemTime(8_000);
    pipeline.handleWsMessage(closedCandlePayload(8_000));

    expect(trades).toEqual(['HIGHER']);
  });
});
