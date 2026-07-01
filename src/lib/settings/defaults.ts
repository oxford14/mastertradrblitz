import type {
  AiAnalystSettings,
  AppSettings,
  MaType,
  MinimumSignalConfidence,
  MinimumSignalEdge,
  ProgressionMaxLevel,
  ProgressionProfileId,
  TradeExpirySec,
} from '../../types';
import { getPreset, isTradeExpirySec } from './presets';
import { DEFAULT_CUSTOM_LEVELS, isProgressionProfileId } from '../progression/tables';
import {
  DEFAULT_OPENROUTER_MODEL,
  normalizeOpenRouterModel,
} from '../ai/openrouter-models';
import { normalizeAutoTradeDirectionFilter } from '../exnova/auto-trade-direction';

export const DEFAULT_SETTINGS: AppSettings = getPreset(5);

const DEFAULT_AI_ANALYST: AiAnalystSettings = {
  enabled: false,
  model: DEFAULT_OPENROUTER_MODEL,
  autoApplyPerTrade: false,
  autoApplyBatch: true,
  batchEveryNTrades: 25,
  requireBacktestForBatch: true,
  holdoutPercent: 20,
};

function validateAiAnalyst(
  raw: Partial<AiAnalystSettings & { autoApply?: boolean }> | undefined,
): AiAnalystSettings {
  const batchEveryNTrades = Math.round(Number(raw?.batchEveryNTrades ?? 25));
  const holdoutPercent = Math.round(Number(raw?.holdoutPercent ?? 20));

  let autoApplyPerTrade = raw?.autoApplyPerTrade;
  let autoApplyBatch = raw?.autoApplyBatch;
  if (autoApplyPerTrade === undefined && autoApplyBatch === undefined && raw?.autoApply !== undefined) {
    autoApplyPerTrade = raw.autoApply;
    autoApplyBatch = raw.autoApply;
  }

  return {
    enabled: raw?.enabled ?? false,
    model: normalizeOpenRouterModel(
      typeof raw?.model === 'string' && raw.model.trim() ? raw.model : DEFAULT_AI_ANALYST.model,
    ),
    autoApplyPerTrade: autoApplyPerTrade ?? DEFAULT_AI_ANALYST.autoApplyPerTrade,
    autoApplyBatch: autoApplyBatch ?? DEFAULT_AI_ANALYST.autoApplyBatch,
    batchEveryNTrades: batchEveryNTrades >= 0 ? Math.min(batchEveryNTrades, 500) : 25,
    requireBacktestForBatch: raw?.requireBacktestForBatch ?? true,
    holdoutPercent: holdoutPercent >= 5 && holdoutPercent <= 50 ? holdoutPercent : 20,
  };
}

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
    movingAverage: (() => {
      const legacy = (
        settings as AppSettings & {
          ema?: { fastPeriod?: number; slowPeriod?: number };
        }
      ).ema;
      const ma = settings.movingAverage ?? legacy;
      const type: MaType = ma && 'type' in ma && ma.type === 'sma' ? 'sma' : 'ema';
      return {
        fastPeriod: clamp(Math.round(ma?.fastPeriod ?? 9), 2, 200),
        slowPeriod: clamp(Math.round(ma?.slowPeriod ?? 21), 2, 200),
        type,
        requireTrendAlignment: settings.movingAverage?.requireTrendAlignment ?? false,
      };
    })(),
    adx: {
      period: clamp(Math.round(settings.adx?.period ?? 14), 2, 100),
      threshold: clamp(settings.adx?.threshold ?? 20, 5, 100),
    },
    cci: {
      enabled: settings.cci?.enabled ?? true,
      period: clamp(Math.round(settings.cci?.period ?? 14), 2, 100),
      overbought: clamp(Math.round(settings.cci?.overbought ?? 100), 1, 500),
      oversold: clamp(Math.round(settings.cci?.oversold ?? -100), -500, -1),
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
      clickEngine: 'native',
      directionFilter: normalizeAutoTradeDirectionFilter(
        settings.autoTrade?.directionFilter,
      ),
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
    progression: (() => {
      const p = settings.progression;
      const profileId: ProgressionProfileId = isProgressionProfileId(
        String(p?.profileId ?? ''),
      )
        ? (p!.profileId as ProgressionProfileId)
        : 'D200';
      const maxLevels: ProgressionMaxLevel[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];
      const maxLevel: ProgressionMaxLevel = maxLevels.includes(
        p?.maxLevel as ProgressionMaxLevel,
      )
        ? (p!.maxLevel as ProgressionMaxLevel)
        : 10;
      const customRaw = Array.isArray(p?.customLevels) ? p!.customLevels : [];
      const customLevels = Array.from({ length: 10 }, (_, i) => {
        const v = Number(customRaw[i] ?? DEFAULT_CUSTOM_LEVELS[i]);
        return Number.isFinite(v) && v > 0 ? Math.round(v) : DEFAULT_CUSTOM_LEVELS[i];
      });
      const field = p?.amountField;
      const amountField =
        field &&
        Number.isFinite(field.screenX) &&
        Number.isFinite(field.screenY) &&
        Number.isFinite(field.clientX) &&
        Number.isFinite(field.clientY)
          ? {
              screenX: Math.round(field.screenX),
              screenY: Math.round(field.screenY),
              clientX: Math.round(field.clientX),
              clientY: Math.round(field.clientY),
              width: clamp(Math.round(field.width ?? 120), 20, 400),
              height: clamp(Math.round(field.height ?? 32), 16, 120),
              calibratedAt: Number(field.calibratedAt) || Date.now(),
            }
          : null;
      return {
        enabled: p?.enabled ?? false,
        profileId,
        customLevels,
        maxLevel,
        resetOnWin: p?.resetOnWin ?? true,
        advanceOnLoss: p?.advanceOnLoss ?? true,
        amountField,
        amountEntryMode: p?.amountEntryMode === 'keypad' ? 'keypad' : 'hybrid',
      };
    })(),
    aiAnalyst: validateAiAnalyst(settings.aiAnalyst),
    tradingMode: settings.tradingMode === 'AI' ? 'AI' : 'LEGACY',
    aiBackend: {
      apiBaseUrl: String(settings.aiBackend?.apiBaseUrl ?? '').trim(),
      apiKey: String(settings.aiBackend?.apiKey ?? '').trim(),
    },
    autoTradingMode:
      settings.autoTradingMode === 'semi' || settings.autoTradingMode === 'full'
        ? settings.autoTradingMode
        : 'manual',
    aiConfidenceThreshold: clamp(
      Math.round(Number(settings.aiConfidenceThreshold ?? 70)),
      0,
      100,
    ),
    aiAutoTradeThreshold: clamp(
      Math.round(Number(settings.aiAutoTradeThreshold ?? 85)),
      0,
      100,
    ),
    assignedStrategyId:
      typeof settings.assignedStrategyId === 'string' && settings.assignedStrategyId.trim()
        ? settings.assignedStrategyId.trim()
        : null,
    devLogWs: settings.devLogWs,
  };
}
