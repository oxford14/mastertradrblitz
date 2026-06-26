import type { AggregateLearningRun, AppSettings, TradeRecord } from '../../types';
import { analyzeAggregateRecords } from './openrouter-client';
import {
  applySettingsPatch,
  sanitizePatch,
} from './apply-suggestions';
import { candidateBeatsCurrent } from './backtest-runner';
import {
  clientAppendAggregateRun,
  clientListTradeRecords,
} from './trade-journal-client';

export function computeRollingStats(records: TradeRecord[]): Record<string, unknown> {
  const wins = records.filter((r) => r.outcome === 'win').length;
  const losses = records.length - wins;
  const higherWins = records.filter((r) => r.signal === 'HIGHER' && r.outcome === 'win').length;
  const lowerWins = records.filter((r) => r.signal === 'LOWER' && r.outcome === 'win').length;
  const marginalLosses = records.filter(
    (r) => r.outcome === 'loss' && r.analysis?.verdict === 'marginal',
  ).length;
  return {
    total: records.length,
    wins,
    losses,
    winRate: records.length > 0 ? wins / records.length : 0,
    higherWins,
    lowerWins,
    marginalLosses,
  };
}

export async function runAggregateLearning(
  settings: AppSettings,
  tradeCount: number,
): Promise<{
  settings: AppSettings;
  run: AggregateLearningRun | null;
  error?: string;
}> {
  const n = Math.min(tradeCount, settings.aiAnalyst.batchEveryNTrades || 25);
  const records = await clientListTradeRecords(n, 0, 'desc');
  if (records.length < 3) {
    return { settings, run: null, error: 'Not enough trades for aggregate learning' };
  }

  const rollingStats = computeRollingStats(records);
  const result = await analyzeAggregateRecords(records, rollingStats, settings.aiAnalyst.model);
  if (!result.ok || !result.analysis) {
    return { settings, run: null, error: result.error ?? 'Aggregate analysis failed' };
  }

  const patch = sanitizePatch(result.analysis.settingsPatch);
  const runId = `agg-${Date.now()}`;
  let nextSettings = settings;
  let appliedPatches: AggregateLearningRun['appliedPatches'] = [];
  let backtestScore: number | undefined;
  let backtestApplied = false;

  if (Object.keys(patch).length > 0) {
    const { settings: candidate, applied } = applySettingsPatch(settings, patch, 2);
    let shouldApply = true;
    if (settings.aiAnalyst.requireBacktestForBatch) {
      const comparison = candidateBeatsCurrent(
        records,
        settings,
        candidate,
        settings.aiAnalyst.holdoutPercent,
      );
      backtestScore = comparison.candidateScore;
      shouldApply = comparison.applies;
    }
    if (shouldApply && settings.aiAnalyst.autoApply) {
      nextSettings = candidate;
      appliedPatches = applied;
      backtestApplied = true;
    }
  }

  const run: AggregateLearningRun = {
    id: runId,
    runAt: Date.now(),
    tradeCount: records.length,
    lessons: result.analysis.lessons,
    settingsPatch: patch,
    appliedPatches,
    backtestScore,
    backtestApplied,
  };
  await clientAppendAggregateRun(run);

  return { settings: nextSettings, run };
}

export function shouldTriggerAggregateLearning(
  totalTradeCount: number,
  batchEveryN: number,
): boolean {
  if (batchEveryN <= 0) return false;
  return totalTradeCount > 0 && totalTradeCount % batchEveryN === 0;
}
