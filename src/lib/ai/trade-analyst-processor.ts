import type { LatestTradeAnalysis, TradeAnalysis, TradeRecord } from '../../types';
import { applySettingsPatch, sanitizePatch } from './apply-suggestions';
import { analyzeTradeRecord } from './openrouter-client';
import { writeLatestAnalysis } from './analysis-storage';
import {
  clientAppendTradeRecord,
  clientCountTradeRecords,
  clientUpdateTradeRecord,
} from './trade-journal-client';
import {
  runAggregateLearning,
  shouldTriggerAggregateLearning,
} from './aggregate-learning';
import { loadSettings, saveSettings } from '../settings/storage';
import { isOpenRouterConfigured } from './openrouter-config';

let queue: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((err) => {
    console.error('[MTB AI]', err);
  });
}

export async function saveTradeToJournal(record: TradeRecord): Promise<void> {
  await clientAppendTradeRecord(record);
}

export async function processTradeAnalysis(record: TradeRecord): Promise<{
  ok: boolean;
  error?: string;
}> {
  const settings = await loadSettings();
  if (!settings.aiAnalyst.enabled) {
    return { ok: false, error: 'AI analyst disabled in settings' };
  }
  if (record.entry.dryRun) {
    return { ok: false, error: 'Dry-run trades are not analyzed' };
  }
  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      error: 'OpenRouter API key missing — add VITE_OPENROUTER_API_KEY to .env.local and rebuild',
    };
  }

  const result = await analyzeTradeRecord(record, settings.aiAnalyst.model);
  if (!result.ok || !result.analysis) {
    const error = result.error ?? 'Analysis failed';
    console.warn('[MTB AI] Analysis failed:', error, result.rawText?.slice(0, 200));
    await clientUpdateTradeRecord({ ...record, analysisError: error });
    return { ok: false, error };
  }

  const patch = sanitizePatch(result.analysis.settingsPatch);
  let appliedPatches: TradeAnalysis['appliedPatches'] = [];
  let nextSettings = settings;

  if (settings.aiAnalyst.autoApply && Object.keys(patch).length > 0) {
    const applied = applySettingsPatch(settings, patch, 2);
    if (applied.applied.length > 0) {
      nextSettings = applied.settings;
      appliedPatches = applied.applied;
      await saveSettings(nextSettings);
    }
  }

  const analysis: TradeAnalysis = {
    verdict: result.analysis.verdict,
    summary: result.analysis.summary,
    lessons: result.analysis.lessons,
    settingsPatch: patch,
    appliedPatches,
    model: settings.aiAnalyst.model,
    analyzedAt: Date.now(),
  };

  const completed: TradeRecord = { ...record, analysis, analysisError: undefined };
  await clientUpdateTradeRecord(completed);

  const latest: LatestTradeAnalysis = {
    tradeId: record.id,
    verdict: analysis.verdict,
    summary: analysis.summary,
    lessons: analysis.lessons,
    appliedPatches: analysis.appliedPatches,
    outcome: record.outcome,
    signal: record.signal,
    analyzedAt: analysis.analyzedAt,
  };
  await writeLatestAnalysis(latest);

  const total = await clientCountTradeRecords();
  if (shouldTriggerAggregateLearning(total, settings.aiAnalyst.batchEveryNTrades)) {
    const agg = await runAggregateLearning(nextSettings, total);
    if (agg.run?.backtestApplied && agg.settings !== nextSettings) {
      await saveSettings(agg.settings);
    }
  }

  return { ok: true };
}

export function queueTradeAnalysis(record: TradeRecord): void {
  enqueue(async () => {
    await processTradeAnalysis(record);
  });
}

export function logMissingApiKeyOnce(): void {
  console.warn(
    '[MTB AI] OpenRouter API key missing — add VITE_OPENROUTER_API_KEY to .env.local and rebuild.',
  );
}
