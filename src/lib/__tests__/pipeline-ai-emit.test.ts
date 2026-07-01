import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TradingPipeline } from '../pipeline';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { resetAiDecisionState } from '../decision/decision-adapter';
import { requestAiDecision } from '../api/mtb-api-client';
import type { AppSettings } from '../../types';

vi.mock('../api/mtb-api-client', () => ({
  requestAiDecision: vi.fn(),
  isMtbApiConfigured: () => true,
}));

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

function closedCandlePayload(fromMs: number, close = 1.15): string {
  return JSON.stringify({
    name: 'candle-generated',
    msg: {
      active_id: SYMBOL,
      size: INTERVAL_SEC,
      candles: [{ open: 1.1, max: 1.2, min: 1.0, close, from: fromMs }],
    },
  });
}

function lockSymbol(pipeline: TradingPipeline, timeMs: number): void {
  for (let i = 0; i < 5; i += 1) {
    pipeline.handleWsMessage(quotePayload(timeMs + i));
  }
}

function aiSettings(signalHoldSec: number): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    tradingMode: 'AI',
    autoTradingMode: 'full',
    aiAutoTradeThreshold: 50,
    aiBackend: { apiBaseUrl: 'http://localhost:3001', apiKey: 'test-key' },
    market: {
      ...DEFAULT_SETTINGS.market,
      candleIntervalSec: INTERVAL_SEC,
      signalHoldSec,
      signalCooldownSec: 0,
    },
  };
}

describe('TradingPipeline AI async emit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    resetAiDecisionState();
    vi.mocked(requestAiDecision).mockResolvedValue({
      decision: 'BUY',
      confidence: 72,
      reasoning: ['strong setup'],
      risks: [],
      supportingIndicators: [],
      id: 'decision-1',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('emits a trade when the AI decision resolves after the bar close (hold=0)', async () => {
    const pipeline = new TradingPipeline(aiSettings(0));
    const trades: Array<{ signal: string; aiConfidence: number }> = [];
    pipeline.onTradeConfirmed(({ signal, aiConfidence }) =>
      trades.push({ signal, aiConfidence }),
    );

    lockSymbol(pipeline, 0);
    vi.setSystemTime(5_000);
    pipeline.handleWsMessage(closedCandlePayload(5_000));

    await vi.advanceTimersByTimeAsync(50);

    expect(trades).toEqual([{ signal: 'HIGHER', aiConfidence: 72 }]);
  });

  it('emits after the hold window even when the API resolves late (hold>0)', async () => {
    const pipeline = new TradingPipeline(aiSettings(2));
    const trades: string[] = [];
    pipeline.onTradeConfirmed(({ signal }) => trades.push(signal));

    lockSymbol(pipeline, 0);
    vi.setSystemTime(5_000);
    pipeline.handleWsMessage(closedCandlePayload(5_000));

    // Decision arrives, hold starts; nothing fires yet.
    await vi.advanceTimersByTimeAsync(50);
    expect(trades).toEqual([]);

    // After the hold window elapses the held signal confirms.
    await vi.advanceTimersByTimeAsync(2_500);
    expect(trades).toEqual(['HIGHER']);
  });
});
