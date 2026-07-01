import { describe, expect, it } from 'vitest';
import { mapAiDecisionToSignal, mapSignalToAiDecision, MarketSnapshotSchema } from '@mtb/shared';
import {
  attachAiToSignalResult,
  buildLiveSnapshot,
  getAiAutoTradeGateMessage,
  getAiAutoTradeThreshold,
  resetAiDecisionState,
  shouldAutoTradeAiDecision,
} from '../decision/decision-adapter';
import { buildMarketSnapshot } from '../snapshot/market-snapshot';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { IndicatorSnapshot } from '../../types';

const baseIndicators = (): IndicatorSnapshot => ({
  rsi: 22,
  stochK: 18,
  stochD: 25,
  price: 1.085,
  bbUpper: 1.09,
  bbLower: 1.08,
  bbMiddle: 1.085,
  stochCrossUp: true,
  stochCrossDown: false,
  crossUpOnThisBar: true,
  crossDownOnThisBar: false,
  bullishCrossValid: true,
  bearishCrossValid: false,
  barsSinceBullishCross: 0,
  barsSinceBearishCross: null,
  warmedUp: true,
  warmupRequired: 20,
  warmupCurrent: 30,
  maFast: 1.086,
  maSlow: 1.084,
  maTrend: 'up',
  cci: -120,
});

describe('market-snapshot', () => {
  it('maps RSI to OVERSOLD state', () => {
    const snapshot = buildMarketSnapshot({
      asset: 'EURUSD',
      expiry: 5,
      indicators: baseIndicators(),
      pattern: { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
      wick: { bullishRejection: false, bearishRejection: false },
      adx: 34,
      plusDi: 28,
      minusDi: 12,
      settings: DEFAULT_SETTINGS,
    });

    expect(snapshot.rsi.state).toBe('OVERSOLD');
    expect(snapshot.stochastic.cross).toBe('BULLISH');
    expect(snapshot.trend).toBe('UP');
    expect(MarketSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('buildLiveSnapshot includes fractal label from detector', () => {
    const snapshot = buildLiveSnapshot(DEFAULT_SETTINGS, {
      asset: 'EURUSD',
      indicators: baseIndicators(),
      pattern: { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
      wick: { bullishRejection: false, bearishRejection: false },
      adxResult: { adx: 34, plusDi: 28, minusDi: 12 },
      fractal: { bullish: true, bearish: false },
    });

    expect(snapshot.fractal).toBe('Bullish');
    expect(MarketSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('attachAiToSignalResult attaches live snapshot on every AI tick', () => {
    resetAiDecisionState();
    const settings = { ...DEFAULT_SETTINGS, tradingMode: 'AI' as const };
    const indicators = baseIndicators();
    const result = attachAiToSignalResult(
      {
        signal: 'WAIT',
        rawSignal: 'WAIT',
        confirming: false,
        holdSecondsRemaining: 0,
        tradeDirection: null,
        activeCheck: {
          rsi: false,
          stochastic: false,
          candlePattern: false,
          bollinger: false,
          rejectionWick: false,
          movingAverageTrend: false,
        },
        debug: {
          rsi: indicators.rsi,
          rsiOversold: true,
          rsiOverbought: false,
          bullishCross: true,
          bearishCross: false,
          bullishCrossAgeBars: 0,
          bearishCrossAgeBars: null,
          adx: 34,
          plusDi: 28,
          minusDi: 12,
          cci: -120,
          fractalStatus: 'Bullish',
          pattern: 'None',
          evalDirection: null,
          higherChecklist: {
            rsi: false,
            stochastic: false,
            candlePattern: false,
            bollinger: false,
            rejectionWick: false,
            movingAverageTrend: false,
          },
          lowerChecklist: {
            rsi: false,
            stochastic: false,
            candlePattern: false,
            bollinger: false,
            rejectionWick: false,
            movingAverageTrend: false,
          },
          higherConfidence: {
            rsi: 0,
            stochastic: 0,
            candlePattern: 0,
            bollinger: 0,
            rejectionWick: 0,
            movingAverage: 0,
            total: 0,
          },
          lowerConfidence: {
            rsi: 0,
            stochastic: 0,
            candlePattern: 0,
            bollinger: 0,
            rejectionWick: 0,
            movingAverage: 0,
            total: 0,
          },
          higherEnhancerFlags: {
            cci: false,
            fractal: false,
            adxStrength: false,
            diConfirmation: false,
            crossFreshness: false,
          },
          lowerEnhancerFlags: {
            cci: false,
            fractal: false,
            adxStrength: false,
            diConfirmation: false,
            crossFreshness: false,
          },
          maTrend: 'up',
          signal: 'WAIT',
          reason: 'Awaiting AI decision',
        },
        indicators,
        pattern: { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
        dualConfidence: {
          higher: {
            rsi: 0,
            stochastic: 0,
            candlePattern: 0,
            bollinger: 0,
            rejectionWick: 0,
            movingAverage: 0,
            total: 0,
          },
          lower: {
            rsi: 0,
            stochastic: 0,
            candlePattern: 0,
            bollinger: 0,
            rejectionWick: 0,
            movingAverage: 0,
            total: 0,
          },
        },
        confidence: {
          rsi: 0,
          stochastic: 0,
          candlePattern: 0,
          bollinger: 0,
          rejectionWick: 0,
          movingAverage: 0,
          total: 0,
        },
        signalDebugMode: false,
        crossValidityBars: 3,
      },
      settings,
      {
        asset: 'EURUSD',
        indicators,
        pattern: { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
        wick: { bullishRejection: false, bearishRejection: false },
        adxResult: { adx: 34, plusDi: 28, minusDi: 12 },
        fractal: { bullish: true, bearish: false },
      },
    );

    expect(result.aiSnapshot).toBeTruthy();
    expect((result.aiSnapshot as { rsi: { value: number } }).rsi.value).toBe(22);
    expect((result.aiSnapshot as { fractal?: string }).fractal).toBe('Bullish');
  });
});

describe('decision mapping', () => {
  it('maps BUY to HIGHER and SELL to LOWER', () => {
    expect(mapAiDecisionToSignal('BUY')).toBe('HIGHER');
    expect(mapAiDecisionToSignal('SELL')).toBe('LOWER');
    expect(mapAiDecisionToSignal('WAIT')).toBe('WAIT');
    expect(mapSignalToAiDecision('HIGHER')).toBe('BUY');
    expect(mapSignalToAiDecision('LOWER')).toBe('SELL');
  });
});

describe('auto trading modes', () => {
  it('manual mode never auto trades', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      autoTradingMode: 'manual' as const,
      aiConfidenceThreshold: 70,
      aiAutoTradeThreshold: 85,
    };
    expect(shouldAutoTradeAiDecision(settings, 95)).toBe(false);
  });

  it('semi mode uses confidence threshold', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      autoTradingMode: 'semi' as const,
      aiConfidenceThreshold: 80,
      aiAutoTradeThreshold: 85,
    };
    expect(getAiAutoTradeThreshold(settings)).toBe(80);
    expect(shouldAutoTradeAiDecision(settings, 79)).toBe(false);
    expect(shouldAutoTradeAiDecision(settings, 80)).toBe(true);
  });

  it('full mode uses auto trade threshold', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      autoTradingMode: 'full' as const,
      aiConfidenceThreshold: 50,
      aiAutoTradeThreshold: 85,
    };
    expect(getAiAutoTradeThreshold(settings)).toBe(85);
    expect(shouldAutoTradeAiDecision(settings, 70)).toBe(false);
    expect(shouldAutoTradeAiDecision(settings, 85)).toBe(true);
  });
});

describe('getAiAutoTradeGateMessage', () => {
  it('explains WAIT decisions', () => {
    const message = getAiAutoTradeGateMessage({
      settings: { ...DEFAULT_SETTINGS, tradingMode: 'AI', autoTradingMode: 'full' },
      autoTradeEnabled: true,
      autoTradeDryRun: false,
      aiDecision: {
        decision: 'WAIT',
        confidence: 80,
        reasoning: ['Conflicting signals'],
        risks: [],
        supportingIndicators: [],
      },
    });
    expect(message).toContain('WAIT');
    expect(message).toContain('Conflicting signals');
  });

  it('explains full auto threshold mismatch', () => {
    const message = getAiAutoTradeGateMessage({
      settings: {
        ...DEFAULT_SETTINGS,
        tradingMode: 'AI',
        autoTradingMode: 'full',
        aiConfidenceThreshold: 50,
        aiAutoTradeThreshold: 85,
      },
      autoTradeEnabled: true,
      autoTradeDryRun: false,
      aiDecision: {
        decision: 'BUY',
        confidence: 70,
        reasoning: [],
        risks: [],
        supportingIndicators: [],
      },
    });
    expect(message).toContain('70%');
    expect(message).toContain('85%');
  });
});
