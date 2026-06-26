import type {
  AppSettings,
  Candle,
  ProgressionSnapshot,
  SignalResult,
  TradeCloseEvent,
  TradeEntrySnapshot,
  TradeRecord,
} from '../../types';

export const CANDLES_AT_ENTRY_COUNT = 30;

export function captureCandlesAtEntry(
  closed: readonly Candle[],
  count = CANDLES_AT_ENTRY_COUNT,
): Candle[] {
  return closed.slice(-count).map((c) => ({ ...c }));
}

export function buildTradeEntrySnapshot(input: {
  placedAt: number;
  signal: 'HIGHER' | 'LOWER';
  symbol: string;
  stake: number;
  progression: ProgressionSnapshot;
  dryRun: boolean;
  settings: AppSettings;
  signalResult: SignalResult | null;
}): TradeEntrySnapshot {
  return {
    placedAt: input.placedAt,
    signal: input.signal,
    symbol: input.symbol,
    stake: input.stake,
    progressionLevel: input.progression.level,
    dryRun: input.dryRun,
    settingsAtEntry: structuredClone(input.settings),
    signalResult: input.signalResult ? structuredClone(input.signalResult) : null,
  };
}

export function buildTradeRecord(input: {
  entry: TradeEntrySnapshot;
  close: TradeCloseEvent;
  candlesAtEntry: Candle[];
}): TradeRecord {
  return {
    id: input.close.id,
    placedAt: input.entry.placedAt,
    closedAt: input.close.closedAt,
    signal: input.entry.signal,
    outcome: input.close.outcome,
    profit: input.close.profit,
    symbol: input.entry.symbol,
    stake: input.entry.stake,
    progressionLevel: input.entry.progressionLevel,
    entry: input.entry,
    candlesAtEntry: input.candlesAtEntry,
  };
}

export function summarizeEntryForPrompt(entry: TradeEntrySnapshot): Record<string, unknown> {
  const sr = entry.signalResult;
  return {
    signal: entry.signal,
    symbol: entry.symbol,
    stake: entry.stake,
    progressionLevel: entry.progressionLevel,
    dryRun: entry.dryRun,
    confidence: sr?.confidence?.total ?? null,
    higherConfidence: sr?.dualConfidence?.higher?.total ?? null,
    lowerConfidence: sr?.dualConfidence?.lower?.total ?? null,
    activeCheck: sr?.activeCheck ?? null,
    debugReason: sr?.debug?.reason ?? null,
    rsi: sr?.indicators?.rsi ?? null,
    stochK: sr?.indicators?.stochK ?? null,
    stochD: sr?.indicators?.stochD ?? null,
    maTrend: sr?.indicators?.maTrend ?? null,
    adx: sr?.debug?.adx ?? null,
    pattern: sr?.pattern?.pattern ?? null,
    settings: {
      minimumSignalConfidence: entry.settingsAtEntry.market.minimumSignalConfidence,
      minimumSignalEdge: entry.settingsAtEntry.market.minimumSignalEdge,
      signalCooldownSec: entry.settingsAtEntry.market.signalCooldownSec,
      signalHoldSec: entry.settingsAtEntry.market.signalHoldSec,
      rsiOversold: entry.settingsAtEntry.rsi.oversold,
      rsiOverbought: entry.settingsAtEntry.rsi.overbought,
      adxThreshold: entry.settingsAtEntry.adx.threshold,
    },
  };
}
