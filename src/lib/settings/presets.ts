import type { AppSettings, ExnovaGuide, TradeExpirySec } from '../../types';

export type { TradeExpirySec };

export const TRADE_EXPIRY_OPTIONS: TradeExpirySec[] = [5, 10, 15, 30];

const EXNOVA_GUIDES: Record<TradeExpirySec, ExnovaGuide> = {
  5: {
    tradeExpirySec: 5,
    recommendedChartType: 'line',
    avoidChartTypes: ['heikin-ashi'],
    exnovaCandlePeriod: '5 seconds (if using candles instead of line)',
    exnovaVisibleWindow: 'Last 2–3 minutes',
    exnovaTradeExpiry: 'Set Blitz expiry to 5 sec',
    notes: [
      'Line chart is recommended — the extension builds 5s bars from ticks internally.',
      'If using candlesticks, set chart period to 5 seconds to match.',
    ],
  },
  10: {
    tradeExpirySec: 10,
    recommendedChartType: 'line',
    avoidChartTypes: ['heikin-ashi'],
    exnovaCandlePeriod: '10 seconds (if using candles instead of line)',
    exnovaVisibleWindow: 'Last 3–5 minutes',
    exnovaTradeExpiry: 'Set Blitz expiry to 10 sec',
    notes: [
      'Line chart is recommended for fastest tick alignment.',
      'Bars chart uses the same OHLC setup as candlesticks.',
    ],
  },
  15: {
    tradeExpirySec: 15,
    recommendedChartType: 'line',
    avoidChartTypes: ['heikin-ashi'],
    exnovaCandlePeriod: '15 seconds (if using candles instead of line)',
    exnovaVisibleWindow: 'Last 5 minutes',
    exnovaTradeExpiry: 'Set Blitz expiry to 15 sec',
    notes: [
      'Mid-blitz mode — allow ~4 minutes warmup before trusting signals.',
    ],
  },
  30: {
    tradeExpirySec: 30,
    recommendedChartType: 'line',
    avoidChartTypes: ['heikin-ashi'],
    exnovaCandlePeriod: '30 seconds (if using candles instead of line)',
    exnovaVisibleWindow: 'Last 5–10 minutes',
    exnovaTradeExpiry: 'Set Blitz expiry to 30 sec',
    notes: [
      'Longest blitz mode — wider Bollinger period reduces noise.',
      'Do not use Heikin-Ashi; smoothed candles will not match extension math.',
    ],
  },
};

const DEFAULT_ADX = { period: 14, threshold: 20 };
const DEFAULT_MOVING_AVERAGE = {
  fastPeriod: 9,
  slowPeriod: 21,
  type: 'ema' as const,
};
const DEFAULT_RSI = {
  period: 14,
  overbought: 70,
  oversold: 30,
  requireExtreme: false,
};
const DEFAULT_STOCH = {
  dPeriod: 3,
  smoothing: 3,
  overbought: 80,
  oversold: 20,
  crossValidityBars: 3,
};
const DEFAULT_PROGRESSION = {
  enabled: false,
  profileId: 'D200' as const,
  customLevels: [200, 488, 1084, 2408, 5352, 11890, 26428, 58731, 130510, 290028],
  maxLevel: 10 as const,
  resetOnWin: true,
  advanceOnLoss: true,
  amountField: null,
  amountEntryMode: 'hybrid' as const,
};
const DEFAULT_AI_ANALYST = {
  enabled: false,
  model: 'google/gemini-2.0-flash-001',
  autoApply: true,
  batchEveryNTrades: 25,
  requireBacktestForBatch: true,
  holdoutPercent: 20,
};
const DEFAULT_AUTO_TRADE = {
  enabled: false,
  dryRun: true,
  useCanvas: true,
  clickEngine: 'native' as const,
  canvas: {
    higherXPercent: 88,
    higherYPercent: 72,
    lowerXPercent: 88,
    lowerYPercent: 82,
  },
};
const DEFAULT_MARKET = {
  signalHoldSec: 2,
  signalCooldownSec: 5,
  signalDebugMode: true,
  minimumSignalConfidence: 70 as const,
  minimumSignalEdge: 5 as const,
};

function basePreset(expiry: TradeExpirySec): Omit<AppSettings, 'devLogWs' | 'aiAnalyst'> {
  const guides = {
    5: {
      rsi: DEFAULT_RSI,
      stochastic: { kPeriod: 8, ...DEFAULT_STOCH },
      adx: DEFAULT_ADX,
      bollinger: { period: 14, deviation: 2.0, bandProximityPct: 0.5 },
      movingAverage: DEFAULT_MOVING_AVERAGE,
      autoTrade: DEFAULT_AUTO_TRADE,
      progression: { ...DEFAULT_PROGRESSION },
      market: {
        tradeExpirySec: 5 as const,
        candleIntervalSec: 5,
        ...DEFAULT_MARKET,
      },
    },
    10: {
      rsi: DEFAULT_RSI,
      stochastic: { kPeriod: 10, ...DEFAULT_STOCH },
      adx: DEFAULT_ADX,
      bollinger: { period: 14, deviation: 2.0, bandProximityPct: 0.5 },
      movingAverage: DEFAULT_MOVING_AVERAGE,
      autoTrade: DEFAULT_AUTO_TRADE,
      progression: { ...DEFAULT_PROGRESSION },
      market: {
        tradeExpirySec: 10 as const,
        candleIntervalSec: 10,
        ...DEFAULT_MARKET,
      },
    },
    15: {
      rsi: DEFAULT_RSI,
      stochastic: { kPeriod: 12, ...DEFAULT_STOCH },
      adx: DEFAULT_ADX,
      bollinger: { period: 16, deviation: 2.0, bandProximityPct: 0.5 },
      movingAverage: DEFAULT_MOVING_AVERAGE,
      autoTrade: DEFAULT_AUTO_TRADE,
      progression: { ...DEFAULT_PROGRESSION },
      market: {
        tradeExpirySec: 15 as const,
        candleIntervalSec: 15,
        ...DEFAULT_MARKET,
        signalHoldSec: 3,
      },
    },
    30: {
      rsi: DEFAULT_RSI,
      stochastic: { kPeriod: 14, ...DEFAULT_STOCH },
      adx: DEFAULT_ADX,
      bollinger: { period: 20, deviation: 2.0, bandProximityPct: 0.5 },
      movingAverage: DEFAULT_MOVING_AVERAGE,
      autoTrade: DEFAULT_AUTO_TRADE,
      progression: { ...DEFAULT_PROGRESSION },
      market: {
        tradeExpirySec: 30 as const,
        candleIntervalSec: 30,
        ...DEFAULT_MARKET,
        signalHoldSec: 3,
      },
    },
  };
  return guides[expiry];
}

export function getPreset(expiry: TradeExpirySec, devLogWs = false): AppSettings {
  return { ...basePreset(expiry), aiAnalyst: { ...DEFAULT_AI_ANALYST }, devLogWs };
}

export function getExnovaGuide(expiry: TradeExpirySec): ExnovaGuide {
  return EXNOVA_GUIDES[expiry];
}

export function isTradeExpirySec(v: number): v is TradeExpirySec {
  return TRADE_EXPIRY_OPTIONS.includes(v as TradeExpirySec);
}

export function applyPresetToSettings(
  current: AppSettings,
  expiry: TradeExpirySec,
): AppSettings {
  const preset = getPreset(expiry, current.devLogWs);
  return { ...preset };
}
