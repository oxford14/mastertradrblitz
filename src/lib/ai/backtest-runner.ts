import type { AppSettings, Candle, TradeRecord } from '../../types';
import { IndicatorEngine } from '../indicators/indicator-engine';
import { computeAdx } from '../indicators/adx';
import { detectEngulfing } from '../patterns/candle-pattern-engine';
import { detectRejectionWick } from '../patterns/rejection-wick';
import { evaluateSignal } from '../signals/signal-engine';

export interface BacktestScore {
  score: number;
  total: number;
  wouldTakeSame: number;
  avoidedLosses: number;
  missedWins: number;
}

function replaySignalOnCandles(
  candles: readonly Candle[],
  settings: AppSettings,
): ReturnType<typeof evaluateSignal> | null {
  if (candles.length < 3) return null;
  const engine = new IndicatorEngine(settings);
  const indicators = engine.computeFromCandles(candles);
  if (!indicators.warmedUp) return null;
  const pattern = detectEngulfing([...candles]);
  const wick = detectRejectionWick(candles);
  const adx = computeAdx(candles, settings.adx.period);
  return evaluateSignal(indicators, pattern, wick, settings, adx);
}

export function scoreRecordWithSettings(
  record: TradeRecord,
  settings: AppSettings,
): { wouldTake: boolean; aligned: boolean } | null {
  const evalResult = replaySignalOnCandles(record.candlesAtEntry, settings);
  if (!evalResult) return null;
  const wouldTake = evalResult.signal === record.signal;
  const aligned =
    (record.outcome === 'win' && wouldTake) ||
    (record.outcome === 'loss' && !wouldTake);
  return { wouldTake, aligned };
}

export function scoreSettingsOnRecords(
  records: readonly TradeRecord[],
  settings: AppSettings,
): BacktestScore {
  let score = 0;
  let total = 0;
  let wouldTakeSame = 0;
  let avoidedLosses = 0;
  let missedWins = 0;

  for (const record of records) {
    if (record.candlesAtEntry.length < 5) continue;
    const result = scoreRecordWithSettings(record, settings);
    if (!result) continue;
    total += 1;
    if (result.wouldTake && record.signal === record.entry.signal) {
      wouldTakeSame += 1;
    }
    if (result.aligned) score += 1;
    if (record.outcome === 'loss' && !result.wouldTake) avoidedLosses += 1;
    if (record.outcome === 'win' && !result.wouldTake) missedWins += 1;
  }

  return {
    score: total > 0 ? score / total : 0,
    total,
    wouldTakeSame,
    avoidedLosses,
    missedWins,
  };
}

export function splitHoldout<T>(items: readonly T[], holdoutPercent: number): {
  train: T[];
  holdout: T[];
} {
  const pct = Math.min(50, Math.max(5, holdoutPercent)) / 100;
  const holdoutSize = Math.max(1, Math.floor(items.length * pct));
  if (items.length <= holdoutSize + 1) {
    return { train: [...items], holdout: [] };
  }
  const splitAt = items.length - holdoutSize;
  return {
    train: items.slice(0, splitAt),
    holdout: items.slice(splitAt),
  };
}

export function candidateBeatsCurrent(
  records: readonly TradeRecord[],
  currentSettings: AppSettings,
  candidateSettings: AppSettings,
  holdoutPercent: number,
): { applies: boolean; currentScore: number; candidateScore: number } {
  const { holdout } = splitHoldout(records, holdoutPercent);
  if (holdout.length === 0) {
    return { applies: true, currentScore: 0, candidateScore: 0 };
  }
  const current = scoreSettingsOnRecords(holdout, currentSettings);
  const candidate = scoreSettingsOnRecords(holdout, candidateSettings);
  return {
    applies: candidate.score > current.score,
    currentScore: current.score,
    candidateScore: candidate.score,
  };
}
