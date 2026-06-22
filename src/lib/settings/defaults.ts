import type {
  AppSettings,
  MinimumSignalConfidence,
  MinimumSignalEdge,
  TradeExpirySec,
} from '../../types';
import { getPreset, isTradeExpirySec } from './presets';

export const DEFAULT_SETTINGS: AppSettings = getPreset(5);

export function validateSettings(settings: AppSettings): AppSettings {
  const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));

  const rawExpiry = settings.market?.tradeExpirySec;
  const candleFromSettings = settings.market?.candleIntervalSec;

  let tradeExpirySec: TradeExpirySec = 5;
  if (isTradeExpirySec(rawExpiry)) {
    tradeExpirySec = rawExpiry;
  } else if (isTradeExpirySec(candleFromSettings)) {
    tradeExpirySec = candleFromSettings;
  }

  return {
    rsi: {
      period: clamp(Math.round(settings.rsi.period), 2, 100),
      overbought: clamp(settings.rsi.overbought, 50, 100),
      oversold: clamp(settings.rsi.oversold, 0, 50),
      requireExtreme: settings.rsi?.requireExtreme ?? false,
    },
    stochastic: {
      kPeriod: clamp(Math.round(settings.stochastic.kPeriod), 2, 50),
      dPeriod: clamp(Math.round(settings.stochastic.dPeriod), 1, 20),
      smoothing: clamp(Math.round(settings.stochastic.smoothing), 1, 20),
      overbought: clamp(settings.stochastic.overbought, 50, 100),
      oversold: clamp(settings.stochastic.oversold, 0, 50),
      crossValidityBars: clamp(
        Math.round(settings.stochastic?.crossValidityBars ?? 3),
        1,
        20,
      ),
    },
    bollinger: {
      period: clamp(Math.round(settings.bollinger.period), 2, 100),
      deviation: clamp(settings.bollinger.deviation, 0.1, 5),
      bandProximityPct: clamp(settings.bollinger.bandProximityPct, 0, 5),
    },
    ema: {
      fastPeriod: clamp(Math.round(settings.ema?.fastPeriod ?? 20), 2, 200),
      slowPeriod: clamp(Math.round(settings.ema?.slowPeriod ?? 50), 2, 200),
      enabled: settings.ema?.enabled ?? false,
    },
    adx: {
      period: clamp(Math.round(settings.adx?.period ?? 14), 2, 100),
      threshold: clamp(settings.adx?.threshold ?? 20, 5, 100),
    },
    market: {
      tradeExpirySec,
      candleIntervalSec: tradeExpirySec,
      signalHoldSec: clamp(Math.round(settings.market.signalHoldSec), 0, 30),
      signalCooldownSec: clamp(
        Math.round(settings.market?.signalCooldownSec ?? 5),
        0,
        60,
      ),
      signalDebugMode: settings.market?.signalDebugMode ?? true,
      minimumSignalConfidence: ([50, 60, 70, 80, 90] as const).includes(
        settings.market?.minimumSignalConfidence as MinimumSignalConfidence,
      )
        ? (settings.market.minimumSignalConfidence as MinimumSignalConfidence)
        : 70,
      minimumSignalEdge: ([3, 5, 10] as const).includes(
        settings.market?.minimumSignalEdge as MinimumSignalEdge,
      )
        ? (settings.market.minimumSignalEdge as MinimumSignalEdge)
        : 5,
    },
    autoTrade: {
      enabled: settings.autoTrade?.enabled ?? false,
      dryRun: settings.autoTrade?.dryRun ?? true,
      useCanvas: settings.autoTrade?.useCanvas ?? true,
      clickEngine:
        settings.autoTrade?.clickEngine === 'native' ||
        settings.autoTrade?.clickEngine === 'synthetic'
          ? settings.autoTrade.clickEngine
          : 'debugger',
      canvas: {
        higherXPercent: clamp(
          Number(settings.autoTrade?.canvas?.higherXPercent ?? 88),
          0,
          100,
        ),
        higherYPercent: clamp(
          Number(settings.autoTrade?.canvas?.higherYPercent ?? 72),
          0,
          100,
        ),
        lowerXPercent: clamp(
          Number(settings.autoTrade?.canvas?.lowerXPercent ?? 88),
          0,
          100,
        ),
        lowerYPercent: clamp(
          Number(settings.autoTrade?.canvas?.lowerYPercent ?? 82),
          0,
          100,
        ),
      },
    },
    devLogWs: settings.devLogWs,
  };
}
