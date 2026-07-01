import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '../lib/settings/defaults';
import {
  applyPresetToSettings,
  getExnovaGuide,
  TRADE_EXPIRY_OPTIONS,
  type TradeExpirySec,
} from '../lib/settings/presets';
import { loadSettings, saveSettings } from '../lib/settings/storage';
import { findExnovaTab } from '../lib/exnova/find-exnova-tab';
import { PROGRESSION_PROFILE_IDS } from '../lib/progression/tables';
import { isOpenRouterConfigured } from '../lib/ai/openrouter-config';
import {
  OPENROUTER_MODEL_CUSTOM,
  OPENROUTER_MODEL_PRESETS,
  normalizeOpenRouterModel,
  resolveModelSelectValue,
} from '../lib/ai/openrouter-models';
import { processTradeAnalysis, saveTradeToJournal } from '../lib/ai/trade-analyst-processor';
import { runAggregateLearning } from '../lib/ai/aggregate-learning';
import { applySettingsPatch } from '../lib/ai/apply-suggestions';
import {
  computeJournalInsights,
  type JournalInsights,
} from '../lib/ai/journal-insights';
import {
  clientCountTradeRecords,
  clientListAggregateRuns,
  clientListTradeRecords,
} from '../lib/ai/trade-journal-client';
import type { AggregateLearningRun, AppSettings, ProgressionMaxLevel, TradeRecord } from '../types';
import { ExnovaGuideCard } from './ExnovaGuideCard';

function journalVerdict(row: TradeRecord): string {
  if (row.analysis?.verdict) return row.analysis.verdict;
  if (row.analysisError) return 'API error';
  return '—';
}

function journalSummary(row: TradeRecord): string {
  if (row.analysis?.summary) return row.analysis.summary;
  if (row.analysisError) return row.analysisError;
  return '—';
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="opt-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function OptionsApp() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [presetToast, setPresetToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [journalRecords, setJournalRecords] = useState<TradeRecord[]>([]);
  const [journalDetail, setJournalDetail] = useState<TradeRecord | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalInsights, setJournalInsights] = useState<JournalInsights | null>(null);
  const [latestAggregateRun, setLatestAggregateRun] = useState<AggregateLearningRun | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const apiKeyConfigured = isOpenRouterConfigured();
  const modelSelectValue = resolveModelSelectValue(settings.aiAnalyst.model);

  const expiry = settings.market.tradeExpirySec;
  const guide = getExnovaGuide(expiry);

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const loadJournal = async () => {
    setJournalLoading(true);
    try {
      const [records, runs] = await Promise.all([
        clientListTradeRecords(500, 0, 'desc'),
        clientListAggregateRuns(1, 0, 'desc'),
      ]);
      setJournalRecords(records);
      setJournalInsights(records.length > 0 ? computeJournalInsights(records) : null);
      setLatestAggregateRun(runs[0] ?? null);
    } catch {
      setJournalRecords([]);
      setJournalInsights(null);
      setLatestAggregateRun(null);
    } finally {
      setJournalLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) void loadJournal();
  }, [loading]);

  const update = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleExpiryChange = (next: TradeExpirySec) => {
    const applied = applyPresetToSettings(settings, next);
    setSettings(applied);
    setSaved(false);
    setPresetToast(`Applied recommended settings for ${next}s`);
    setTimeout(() => setPresetToast(null), 2500);
  };

  const handleSave = async () => {
    const next = await saveSettings(settings);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaved(false);
  };

  const handleResetAutoStats = async () => {
    setProbeResult(null);
    try {
      const tab = await findExnovaTab();
      if (!tab?.id) {
        setProbeResult('No Exnova tab found — open trade.exnova.com first.');
        return;
      }
      await chrome.tabs.sendMessage(tab.id, { type: 'mtb-reset-auto-stats' });
      setProbeResult('Session W/L counter reset.');
    } catch {
      setProbeResult('Reset failed — refresh the Exnova tab.');
    }
    setTimeout(() => setProbeResult(null), 4000);
  };

  const handleProbeButtons = async () => {
    setProbeResult(null);
    try {
      const tab = await findExnovaTab();
      if (!tab?.id) {
        setProbeResult(
          'No Exnova tab found — open https://trade.exnova.com in a browser tab first.',
        );
        return;
      }
      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: 'mtb-probe-buttons',
      })) as {
        higher: boolean;
        lower: boolean;
        canvasFound: boolean;
        method: string;
        message: string;
      };
      setProbeResult(result.message);
    } catch {
      setProbeResult(
        'Probe failed — refresh the Exnova tab and reload the extension in chrome://extensions.',
      );
    }
    setTimeout(() => setProbeResult(null), 5000);
  };

  const handleTestClick = async (signal: 'HIGHER' | 'LOWER' = 'HIGHER') => {
    setProbeResult(null);
    try {
      const result = (await chrome.runtime.sendMessage({
        type: 'mtb-trusted-click',
        engine: 'native',
        signal,
      })) as { ok: boolean; message: string };
      setProbeResult(result.message);
    } catch {
      setProbeResult('Test click failed — refresh Exnova tab and reload extension.');
    }
    setTimeout(() => setProbeResult(null), 6000);
  };

  const sendExnovaMessage = async (
    type: string,
  ): Promise<{ ok: boolean; message?: string } | undefined> => {
    const tab = await findExnovaTab();
    if (!tab?.id) {
      setProbeResult('No Exnova tab found — open trade.exnova.com first.');
      return undefined;
    }
    return (await chrome.tabs.sendMessage(tab.id, { type })) as {
      ok: boolean;
      message?: string;
    };
  };

  const handleTestProgressionAmount = async () => {
    setProbeResult(null);
    try {
      const result = await sendExnovaMessage('mtb-test-progression-amount');
      setProbeResult(result?.message ?? (result?.ok ? 'Amount update sent.' : 'Test failed.'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setProbeResult(
        msg.includes('Receiving end does not exist')
          ? 'Exnova tab not connected — open trade.exnova.com and refresh the tab, then reload the extension from dist/.'
          : 'Test amount failed — refresh the Exnova tab.',
      );
    }
    setTimeout(() => setProbeResult(null), 6000);
  };

  const handleExportJournalJson = async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'mtb-journal-export-json',
      })) as { ok?: boolean; json?: string };
      if (response?.ok && response.json) {
        const blob = new Blob([response.json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mtb-trade-journal-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setProbeResult('Journal export failed.');
      setTimeout(() => setProbeResult(null), 4000);
    }
  };

  const handleExportJournalCsv = async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'mtb-journal-export-csv',
      })) as { ok?: boolean; csv?: string };
      if (response?.ok && response.csv) {
        const blob = new Blob([response.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mtb-trade-journal-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setProbeResult('Journal export failed.');
      setTimeout(() => setProbeResult(null), 4000);
    }
  };

  const handleClearJournal = async () => {
    if (!window.confirm('Clear all trade journal history?')) return;
    try {
      await chrome.runtime.sendMessage({ type: 'mtb-journal-clear' });
      setJournalRecords([]);
      setJournalDetail(null);
      setJournalInsights(null);
      setLatestAggregateRun(null);
      setProbeResult('Trade journal cleared.');
    } catch {
      setProbeResult('Failed to clear journal.');
    }
    setTimeout(() => setProbeResult(null), 4000);
  };

  const handleResetProgression = async () => {
    setProbeResult(null);
    try {
      const result = await sendExnovaMessage('mtb-reset-progression');
      if (result?.ok) {
        setProbeResult('Progression reset to Level 1.');
      }
    } catch {
      setProbeResult('Reset failed — refresh the Exnova tab.');
    }
    setTimeout(() => setProbeResult(null), 4000);
  };

  const handleReanalyzeTrade = async (record: TradeRecord) => {
    setProbeResult(null);
    await saveTradeToJournal(record);
    const result = await processTradeAnalysis(record);
    if (result.ok) {
      setProbeResult('Analysis complete — refresh journal.');
      await loadJournal();
      const updated = (await chrome.runtime.sendMessage({
        type: 'mtb-journal-get',
        id: record.id,
      })) as { ok?: boolean; record?: TradeRecord };
      if (updated?.record) setJournalDetail(updated.record);
    } else {
      setProbeResult(result.error ?? 'Analysis failed.');
      await loadJournal();
    }
    setTimeout(() => setProbeResult(null), 6000);
  };

  const handleTestModel = async () => {
    setProbeResult(null);
    if (!settings.aiAnalyst.enabled) {
      setProbeResult('Enable AI analyst first — test model uses OpenRouter credits.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    const model = normalizeOpenRouterModel(settings.aiAnalyst.model);
    try {
      const result = (await chrome.runtime.sendMessage({
        type: 'mtb-openrouter-test-model',
        model,
      })) as { ok?: boolean; message?: string };
      setProbeResult(
        result?.ok ? (result.message ?? 'Model OK') : (result?.message ?? 'Model test failed'),
      );
    } catch {
      setProbeResult('Model test failed — reload extension and try again.');
    }
    setTimeout(() => setProbeResult(null), 8000);
  };

  const handleRunBatchAnalysis = async () => {
    if (!settings.aiAnalyst.enabled) {
      setProbeResult('Enable AI analyst first.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    if (!apiKeyConfigured) {
      setProbeResult('OpenRouter API key missing — rebuild after adding .env.local key.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    setBatchRunning(true);
    setProbeResult('Running batch analysis…');
    try {
      const count = await clientCountTradeRecords();
      if (count < 3) {
        setProbeResult('Need at least 3 closed trades for batch analysis.');
        return;
      }
      const current = await loadSettings();
      const result = await runAggregateLearning(current, count);
      if (result.error && !result.run) {
        setProbeResult(result.error);
        return;
      }
      if (result.settings !== current) {
        const saved = await saveSettings(result.settings);
        setSettings(saved);
      }
      if (result.run) {
        setLatestAggregateRun(result.run);
        const applied = result.run.backtestApplied && result.run.appliedPatches.length > 0;
        setProbeResult(
          applied
            ? `Batch analysis applied ${result.run.appliedPatches.length} setting change(s).`
            : result.run.settingsPatch && Object.keys(result.run.settingsPatch).length > 0
              ? 'Batch analysis complete — review suggested patch below.'
              : 'Batch analysis complete — no setting changes suggested.',
        );
      } else {
        setProbeResult('Batch analysis complete.');
      }
      await loadJournal();
    } catch (err) {
      setProbeResult(err instanceof Error ? err.message : 'Batch analysis failed.');
    } finally {
      setBatchRunning(false);
      setTimeout(() => setProbeResult(null), 8000);
    }
  };

  const handleApplySuggestedPatch = async () => {
    const run = latestAggregateRun;
    const patch = run?.settingsPatch ?? {};
    if (!run || Object.keys(patch).length === 0) {
      setProbeResult('No suggested patch from the latest batch run.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    const preview = applySettingsPatch(settings, patch, 2);
    if (preview.applied.length === 0) {
      setProbeResult('Suggested patch matches current settings — nothing to apply.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    const summary = preview.applied
      .map((p) => `${p.path}: ${JSON.stringify(p.before)} → ${JSON.stringify(p.after)}`)
      .join('\n');
    if (!window.confirm(`Apply suggested settings patch?\n\n${summary}`)) return;
    const saved = await saveSettings(preview.settings);
    setSettings(saved);
    setProbeResult('Suggested patch applied.');
    setTimeout(() => setProbeResult(null), 4000);
  };

  const handleRetryFailedAnalyses = async () => {
    const failed = journalRecords.filter((row) => row.analysisError && !row.analysis);
    if (failed.length === 0) {
      setProbeResult('No failed analyses to retry.');
      setTimeout(() => setProbeResult(null), 4000);
      return;
    }
    setRetryingFailed(true);
    setProbeResult(`Retrying ${failed.length} failed analysis(es)…`);
    let okCount = 0;
    for (const record of failed) {
      const result = await processTradeAnalysis(record);
      if (result.ok) okCount += 1;
    }
    await loadJournal();
    setRetryingFailed(false);
    setProbeResult(`Retry complete: ${okCount}/${failed.length} succeeded.`);
    setTimeout(() => setProbeResult(null), 8000);
  };

  const handlePingHelper = async () => {
    setProbeResult(null);
    try {
      const result = (await chrome.runtime.sendMessage({
        type: 'mtb-click-helper-ping',
      })) as {
        ok: boolean;
        message: string;
        higher?: { x: number; y: number };
        lower?: { x: number; y: number };
        amount?: { x: number; y: number };
        updatedAt?: string;
      };
      if (result.ok) {
        if (result.higher && result.lower) {
          const amountLine = result.amount
            ? `AMOUNT @ ${result.amount.x}, ${result.amount.y}`
            : 'AMOUNT not calibrated — drag amber marker in calibrator';
          setProbeResult(
            `Native helper OK — HIGHER @ ${result.higher.x}, ${result.higher.y} · LOWER @ ${result.lower.x}, ${result.lower.y} · ${amountLine}`,
          );
        } else {
          setProbeResult(`Native helper OK: ${result.message}`);
        }
      } else if (result.message.includes('not found')) {
        setProbeResult(
          'Native helper not registered. Build helper/vb/MtbClickHelper, then run helper\\install-native-helper.ps1 and reload extension from dist/.',
        );
      } else {
        setProbeResult(`Native helper: ${result.message}`);
      }
    } catch {
      setProbeResult('Native helper ping failed.');
    }
    setTimeout(() => setProbeResult(null), 8000);
  };

  const extensionId = chrome.runtime.id;

  if (loading) return <div className="opt-page">Loading…</div>;

  return (
    <div className="opt-page">
      <header className="opt-header">
        <h1>Master Trader Blitz</h1>
        <p>V2 AI decision platform — saved locally via Chrome Storage</p>
      </header>

      <section className="opt-section">
        <h2>Trading Mode (V2)</h2>
        <label className="opt-field opt-field-select">
          <span>Mode</span>
          <select
            value={settings.tradingMode}
            onChange={(e) =>
              update({
                tradingMode: e.target.value === 'AI' ? 'AI' : 'LEGACY',
              })
            }
          >
            <option value="LEGACY">LEGACY — confidence engine</option>
            <option value="AI">AI — backend decision engine</option>
          </select>
        </label>
        <p className="opt-hint">Reload the Exnova tab after switching mode.</p>
        <label className="opt-field">
          <span>API Base URL</span>
          <input
            type="url"
            value={settings.aiBackend.apiBaseUrl}
            onChange={(e) =>
              update({
                aiBackend: { ...settings.aiBackend, apiBaseUrl: e.target.value },
              })
            }
            placeholder="http://localhost:3001"
          />
        </label>
        <label className="opt-field">
          <span>API Key</span>
          <input
            type="password"
            value={settings.aiBackend.apiKey}
            onChange={(e) =>
              update({
                aiBackend: { ...settings.aiBackend, apiKey: e.target.value },
              })
            }
            placeholder="MTB_API_KEY"
          />
        </label>
        <label className="opt-field opt-field-select">
          <span>Auto Trading Mode</span>
          <select
            value={settings.autoTradingMode}
            onChange={(e) =>
              update({
                autoTradingMode: e.target.value as AppSettings['autoTradingMode'],
              })
            }
          >
            <option value="manual">Manual — confirm in overlay</option>
            <option value="semi">Semi Auto — above confidence threshold</option>
            <option value="full">Full Auto — above auto-trade threshold</option>
          </select>
        </label>
        <div className="opt-grid">
          <NumField
            label="AI Confidence Threshold (semi auto)"
            value={settings.aiConfidenceThreshold}
            min={0}
            max={100}
            onChange={(v) => update({ aiConfidenceThreshold: v })}
          />
          <NumField
            label="AI Auto Trade Threshold (full auto)"
            value={settings.aiAutoTradeThreshold}
            min={0}
            max={100}
            onChange={(v) => update({ aiAutoTradeThreshold: v })}
          />
        </div>
        <p className="opt-hint">
          Semi auto uses <strong>Confidence Threshold</strong>. Full auto uses{' '}
          <strong>Auto Trade Threshold</strong> (not the confidence field). The AI must
          return BUY or SELL — WAIT never clicks.
        </p>
        <p className="opt-hint">
          LEGACY mode uses the existing weighted confidence engine. AI mode sends market
          snapshots to mastertraderblitz-api for BUY/SELL/WAIT decisions.
        </p>
        <p className="opt-hint opt-hint-warn">
          <strong>OpenRouter credits:</strong> AI mode calls OpenRouter on every closed bar
          via the API server key (<code>OPENROUTER_API_KEY</code> in{' '}
          <code>mastertraderblitz-api/.env.local</code>). This is separate from the Analyst
          toggle. Switch to <strong>LEGACY</strong> or stop the API server to halt usage.
          Filter OpenRouter activity by app title &quot;Master Trader Blitz API&quot;.
        </p>
        <p className="opt-hint opt-hint-warn">
          After switching between LEGACY and AI, reload your Exnova tab (trade.exnova.com)
          so the overlay picks up the new mode.
        </p>
      </section>

      <section className="opt-section">
        <h2>Exnova platform setup</h2>
        <label className="opt-field opt-field-select">
          <span>Trade expiry</span>
          <select
            value={expiry}
            onChange={(e) =>
              handleExpiryChange(Number(e.target.value) as TradeExpirySec)
            }
          >
            {TRADE_EXPIRY_OPTIONS.map((sec) => (
              <option key={sec} value={sec}>
                {sec} seconds
              </option>
            ))}
          </select>
        </label>
        {presetToast && <p className="opt-toast">{presetToast}</p>}
        <ExnovaGuideCard guide={guide} />
      </section>

      <section className="opt-section">
        <h2>RSI</h2>
        <div className="opt-grid">
          <NumField
            label="Period"
            value={settings.rsi.period}
            min={2}
            max={100}
            onChange={(v) =>
              update({ rsi: { ...settings.rsi, period: v } })
            }
          />
          <NumField
            label="Overbought"
            value={settings.rsi.overbought}
            min={50}
            max={100}
            onChange={(v) =>
              update({ rsi: { ...settings.rsi, overbought: v } })
            }
          />
          <NumField
            label="Oversold"
            value={settings.rsi.oversold}
            min={0}
            max={50}
            onChange={(v) =>
              update({ rsi: { ...settings.rsi, oversold: v } })
            }
          />
        </div>
        <p className="opt-hint">
          HIGHER when RSI ≤ oversold. LOWER when RSI ≥ overbought.
        </p>
      </section>

      <section className="opt-section">
        <h2>Stochastic Oscillator</h2>
        <div className="opt-grid">
          <NumField
            label="K Period"
            value={settings.stochastic.kPeriod}
            min={2}
            max={50}
            onChange={(v) =>
              update({ stochastic: { ...settings.stochastic, kPeriod: v } })
            }
          />
          <NumField
            label="D Period"
            value={settings.stochastic.dPeriod}
            min={1}
            max={20}
            onChange={(v) =>
              update({ stochastic: { ...settings.stochastic, dPeriod: v } })
            }
          />
          <NumField
            label="Smoothing"
            value={settings.stochastic.smoothing}
            min={1}
            max={20}
            onChange={(v) =>
              update({ stochastic: { ...settings.stochastic, smoothing: v } })
            }
          />
          <NumField
            label="Cross validity (bars)"
            value={settings.stochastic.crossValidityBars}
            min={1}
            max={20}
            onChange={(v) =>
              update({
                stochastic: { ...settings.stochastic, crossValidityBars: v },
              })
            }
          />
        </div>
        <p className="opt-hint">
          Yellow (K) crosses purple (D). Cross up/down stays valid for the
          configured bar window.
        </p>
      </section>

      {settings.tradingMode === 'LEGACY' && (
      <section className="opt-section">
        <h2>Signal</h2>
        <label className="opt-field opt-field-select">
          <span>Minimum Signal Confidence</span>
          <select
            value={settings.market.minimumSignalConfidence}
            onChange={(e) =>
              update({
                market: {
                  ...settings.market,
                  minimumSignalConfidence: Number(
                    e.target.value,
                  ) as AppSettings['market']['minimumSignalConfidence'],
                },
              })
            }
          >
            {[50, 60, 70, 80, 90].map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </label>
        <label className="opt-field opt-field-select">
          <span>Minimum Edge</span>
          <select
            value={settings.market.minimumSignalEdge}
            onChange={(e) =>
              update({
                market: {
                  ...settings.market,
                  minimumSignalEdge: Number(
                    e.target.value,
                  ) as AppSettings['market']['minimumSignalEdge'],
                },
              })
            }
          >
            {[3, 5, 10].map((pct) => (
              <option key={pct} value={pct}>
                {pct}%
              </option>
            ))}
          </select>
        </label>
        <p className="opt-hint">
          HIGHER or LOWER must reach the confidence threshold to fire. When both
          sides exceed the threshold, the minimum edge gap decides the winner;
          otherwise the signal stays WAIT (conflicting evidence).
        </p>
      </section>
      )}

      <section className="opt-section">
        <h2>Auto-Trade</h2>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.autoTrade.enabled}
            onChange={(e) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  enabled: e.target.checked,
                },
              })
            }
          />
          Enable auto-click on Exnova
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.autoTrade.dryRun}
            disabled={!settings.autoTrade.enabled}
            onChange={(e) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  dryRun: e.target.checked,
                },
              })
            }
          />
          Dry run (log only, do not click)
        </label>
        <label className="opt-field opt-field-select">
          <span>Auto-click direction</span>
          <select
            value={settings.autoTrade.directionFilter}
            disabled={!settings.autoTrade.enabled}
            onChange={(e) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  directionFilter: e.target.value as AppSettings['autoTrade']['directionFilter'],
                },
              })
            }
          >
            <option value="both">Both HIGHER and LOWER</option>
            <option value="higher">HIGHER only</option>
            <option value="lower">LOWER only</option>
          </select>
        </label>
        <p className="opt-hint">
          Limits which Exnova button auto-click will press when a signal confirms.
          Manual confirm in AI mode respects the same filter.
        </p>
        <p className="opt-field opt-field-static">
          <span>Click engine</span>
          <strong>Native helper (OS-level clicks)</strong>
        </p>
        <p className="opt-hint">
          Auto-clicks use the VB native helper with calibrated screen coordinates.
          Run the calibrator to drag HIGHER/LOWER markers onto Exnova buttons.
        </p>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.autoTrade.useCanvas}
            disabled={!settings.autoTrade.enabled}
            onChange={(e) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  useCanvas: e.target.checked,
                },
              })
            }
          />
          Use canvas clicks (#glcanvas) when DOM buttons missing
        </label>
        <div className="opt-grid">
          <NumField
            label="HIGHER X %"
            value={settings.autoTrade.canvas.higherXPercent}
            min={0}
            max={100}
            step={0.5}
            onChange={(v) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  canvas: { ...settings.autoTrade.canvas, higherXPercent: v },
                },
              })
            }
          />
          <NumField
            label="HIGHER Y %"
            value={settings.autoTrade.canvas.higherYPercent}
            min={0}
            max={100}
            step={0.5}
            onChange={(v) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  canvas: { ...settings.autoTrade.canvas, higherYPercent: v },
                },
              })
            }
          />
          <NumField
            label="LOWER X %"
            value={settings.autoTrade.canvas.lowerXPercent}
            min={0}
            max={100}
            step={0.5}
            onChange={(v) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  canvas: { ...settings.autoTrade.canvas, lowerXPercent: v },
                },
              })
            }
          />
          <NumField
            label="LOWER Y %"
            value={settings.autoTrade.canvas.lowerYPercent}
            min={0}
            max={100}
            step={0.5}
            onChange={(v) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  canvas: { ...settings.autoTrade.canvas, lowerYPercent: v },
                },
              })
            }
          />
        </div>
        <p className="opt-hint">
          Exnova draws Higher/Lower on the WebGL canvas. Position is percent of
          the visible canvas (0,0 = top-left). Defaults target the right-side
          Blitz panel — adjust if probe misses. Calibrate: note cursor position
          over each button vs canvas size.
        </p>
        <p className="opt-hint">
          When a confirmed HIGHER or LOWER signal fires, clicks the matching
          Exnova button using your current stake and expiry. Test with dry run
          first. Probe searches any open trade.exnova.com tab (Options page can
          stay open). Verify Exnova terms of use before enabling live clicks.
        </p>
        <p className="opt-hint">
          Session W/L counts auto-clicked Blitz trades only, detected via WebSocket
          when positions close. Toggling Auto does not reset the counter.
        </p>
        <button
          type="button"
          className="opt-btn"
          onClick={() => void handleResetAutoStats()}
        >
          Reset session W/L
        </button>
        <button
          type="button"
          className="opt-btn"
          onClick={() => void handleProbeButtons()}
        >
          Probe buttons on Exnova tab
        </button>
        <button
          type="button"
          className="opt-btn"
          disabled={!settings.autoTrade.enabled || settings.autoTrade.dryRun}
          onClick={() => void handleTestClick('HIGHER')}
        >
          Test HIGHER click
        </button>
        <button
          type="button"
          className="opt-btn"
          disabled={!settings.autoTrade.enabled || settings.autoTrade.dryRun}
          onClick={() => void handleTestClick('LOWER')}
        >
          Test LOWER click
        </button>
        <p className="opt-hint">
          Extension ID: <code>{extensionId}</code>. Steps: (1) build{' '}
          <code>helper/vb/MtbClickHelper</code>, (2) run{' '}
          <code>helper\install-native-helper.ps1</code>, (3) run{' '}
          <code>helper\run-calibrator.bat</code> (or double-click MtbClickHelper.exe), drag markers over Exnova HIGHER/LOWER/AMOUNT, Save, (4)
          Ping below, (5) Test click with dry run off.
        </p>
        <button type="button" className="opt-btn" onClick={() => void handlePingHelper()}>
          Ping native helper
        </button>
        {probeResult && <p className="opt-toast">{probeResult}</p>}
      </section>

      <section className="opt-section">
        <h2>Progression Manager</h2>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  enabled: e.target.checked,
                },
              })
            }
          />
          Enable progression manager
        </label>
        <label className="opt-field opt-field-select">
          <span>Progression type</span>
          <select
            value={settings.progression.profileId}
            disabled={!settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  profileId: e.target.value as AppSettings['progression']['profileId'],
                },
              })
            }
          >
            <optgroup label="Standard (D) — 82% payout">
              {PROGRESSION_PROFILE_IDS.filter((id) => id.startsWith('D') && id !== 'Custom').map(
                (id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ),
              )}
            </optgroup>
            <optgroup label="Aggressive (AD) — 82% payout">
              {PROGRESSION_PROFILE_IDS.filter((id) => id.startsWith('AD')).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </optgroup>
            <option value="Custom">Custom</option>
          </select>
        </label>
        <p className="opt-hint">
          D = standard double-profit progression. AD = aggressive double-profit progression (10
          levels). Win resets to L1; loss advances one level.
        </p>
        {settings.progression.profileId === 'Custom' && (
          <div className="opt-grid">
            {settings.progression.customLevels.map((level, index) => (
              <NumField
                key={index}
                label={`Level ${index + 1}`}
                value={level}
                min={1}
                disabled={!settings.progression.enabled}
                onChange={(v) => {
                  const customLevels = [...settings.progression.customLevels];
                  customLevels[index] = v;
                  update({
                    progression: { ...settings.progression, customLevels },
                  });
                }}
              />
            ))}
          </div>
        )}
        <label className="opt-field opt-field-select">
          <span>Maximum progression level</span>
          <select
            value={settings.progression.maxLevel}
            disabled={!settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  maxLevel: Number(e.target.value) as ProgressionMaxLevel,
                },
              })
            }
          >
            {([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((level) => (
              <option key={level} value={level}>
                L{level}
              </option>
            ))}
          </select>
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.progression.resetOnWin}
            disabled={!settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  resetOnWin: e.target.checked,
                },
              })
            }
          />
          Auto reset after win
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.progression.advanceOnLoss}
            disabled={!settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  advanceOnLoss: e.target.checked,
                },
              })
            }
          />
          Auto advance after loss
        </label>
        <label className="opt-field opt-field-select">
          <span>Amount entry mode</span>
          <select
            value={settings.progression.amountEntryMode}
            disabled={!settings.progression.enabled}
            onChange={(e) =>
              update({
                progression: {
                  ...settings.progression,
                  amountEntryMode: e.target.value as AppSettings['progression']['amountEntryMode'],
                },
              })
            }
          >
            <option value="hybrid">Hybrid (click + Python paste)</option>
            <option value="keypad">Keypad clicks (mouse only)</option>
          </select>
        </label>
        <p className="opt-hint">
          Progression only reacts to auto-clicked trades detected via WebSocket when
          positions close. Hybrid mode clicks AMOUNT, then pastes the stake with Python (Ctrl+V).
        </p>
        <p className="opt-hint">
          One-time setup (from project root): <code>pip install -r helper\requirements.txt</code>
          {' '}— or from <code>helper\</code>: <code>pip install -r requirements.txt</code>. Then run{' '}
          <code>helper\run-calibrator.bat</code> for HIGHER, LOWER, AMOUNT. Manual paste test:{' '}
          <code>helper\run-paste-test.bat 488</code>
        </p>
        <button
          type="button"
          className="opt-btn"
          disabled={!settings.progression.enabled}
          onClick={() => void handleTestProgressionAmount()}
        >
          Test amount update
        </button>
        <button
          type="button"
          className="opt-btn"
          onClick={() => void handleResetProgression()}
        >
          Reset progression
        </button>
      </section>

      <section className="opt-section">
        <h2>Market</h2>
        <div className="opt-grid">
          <NumField
            label="Bar Interval (seconds)"
            value={settings.market.candleIntervalSec}
            min={1}
            max={60}
            onChange={(v) =>
              update({
                market: {
                  ...settings.market,
                  candleIntervalSec: v,
                  tradeExpirySec: [5, 10, 15, 30].includes(v)
                    ? (v as TradeExpirySec)
                    : settings.market.tradeExpirySec,
                },
              })
            }
          />
          <NumField
            label="Signal Hold (seconds)"
            value={settings.market.signalHoldSec}
            min={0}
            max={30}
            onChange={(v) =>
              update({ market: { ...settings.market, signalHoldSec: v } })
            }
          />
          <NumField
            label="Signal Cooldown (seconds)"
            value={settings.market.signalCooldownSec}
            min={0}
            max={60}
            onChange={(v) =>
              update({ market: { ...settings.market, signalCooldownSec: v } })
            }
          />
        </div>
        <p className="opt-hint">
          Hold: wait before confirming HIGHER/LOWER (0 = instant). Cooldown is the
          minimum gap between auto-clicks (never less than trade expiry). New
          trades are also blocked while a previous trade is still open. When
          progression is enabled, stake is applied before each auto-click.
        </p>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.market.signalDebugMode}
            onChange={(e) =>
              update({
                market: {
                  ...settings.market,
                  signalDebugMode: e.target.checked,
                },
              })
            }
          />
          Signal debug mode (overlay)
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.devLogWs}
            onChange={(e) => update({ devLogWs: e.target.checked })}
          />
          Log WebSocket message shapes to console (dev)
        </label>
      </section>

      <section className="opt-section opt-section-muted">
        <h2>Moving Average</h2>
        <p className="opt-hint">
          Trend filter adds up to +10 confidence when aligned. Match your Exnova
          cyan/purple MA settings for trend alignment.
        </p>
        <div className="opt-grid">
          <NumField
            label="Fast MA Period"
            value={settings.movingAverage.fastPeriod}
            min={2}
            max={200}
            onChange={(v) =>
              update({
                movingAverage: { ...settings.movingAverage, fastPeriod: v },
              })
            }
          />
          <NumField
            label="Slow MA Period"
            value={settings.movingAverage.slowPeriod}
            min={2}
            max={200}
            onChange={(v) =>
              update({
                movingAverage: { ...settings.movingAverage, slowPeriod: v },
              })
            }
          />
          <label className="opt-field">
            <span className="opt-label">MA Type</span>
            <select
              className="opt-select"
              value={settings.movingAverage.type}
              onChange={(e) =>
                update({
                  movingAverage: {
                    ...settings.movingAverage,
                    type: e.target.value as AppSettings['movingAverage']['type'],
                  },
                })
              }
            >
              <option value="ema">EMA</option>
              <option value="sma">SMA</option>
            </select>
          </label>
        </div>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.movingAverage.requireTrendAlignment}
            onChange={(e) =>
              update({
                movingAverage: {
                  ...settings.movingAverage,
                  requireTrendAlignment: e.target.checked,
                },
              })
            }
          />
          Require trend alignment (block counter-trend entries)
        </label>
        <p className="opt-hint">
          When enabled, HIGHER requires MA trend up and LOWER requires MA trend down.
          Filters many counter-trend losses but also skips some counter-trend wins.
        </p>
      </section>

      <section className="opt-section">
        <h2>CCI</h2>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.cci.enabled}
            onChange={(e) =>
              update({
                cci: { ...settings.cci, enabled: e.target.checked },
              })
            }
          />
          CCI Enabled
        </label>
        <div className="opt-grid">
          <NumField
            label="CCI Period"
            value={settings.cci.period}
            min={2}
            max={100}
            onChange={(v) => update({ cci: { ...settings.cci, period: v } })}
          />
          <NumField
            label="CCI Overbought"
            value={settings.cci.overbought}
            min={1}
            max={500}
            onChange={(v) =>
              update({ cci: { ...settings.cci, overbought: v } })
            }
          />
          <NumField
            label="CCI Oversold"
            value={settings.cci.oversold}
            min={-500}
            max={-1}
            onChange={(v) => update({ cci: { ...settings.cci, oversold: v } })}
          />
        </div>
        <p className="opt-hint">
          Adds confidence when CCI is at or below the oversold level for HIGHER,
          or at or above the overbought level for LOWER.
        </p>
      </section>

      <section className="opt-section opt-section-muted">
        <h2>Advanced filters</h2>
        <p className="opt-hint">
          Bollinger and rejection wick contribute to confidence scoring. ADX and
          DI alignment add confidence boosters in the overlay.
        </p>
        <div className="opt-grid">
          <NumField
            label="BB Period"
            value={settings.bollinger.period}
            min={2}
            max={100}
            onChange={(v) =>
              update({ bollinger: { ...settings.bollinger, period: v } })
            }
          />
          <NumField
            label="ADX Period"
            value={settings.adx.period}
            min={2}
            max={100}
            onChange={(v) => update({ adx: { ...settings.adx, period: v } })}
          />
          <NumField
            label="ADX Threshold"
            value={settings.adx.threshold}
            min={5}
            max={100}
            onChange={(v) =>
              update({ adx: { ...settings.adx, threshold: v } })
            }
          />
        </div>
      </section>

      <section className="opt-section">
        <h2>AI Trade Analyst</h2>
        <p className="opt-hint">
          Analyzes each closed auto-trade via OpenRouter and can auto-apply small
          setting tweaks. Uses extension API key (<code>VITE_OPENROUTER_API_KEY</code>).
          You can also toggle <strong>Analyst</strong> on the overlay AI Analyst tab.
          This is separate from AI trading decisions (API server). On OpenRouter, analyst
          calls appear as &quot;Master Trader Blitz&quot;; live decisions as &quot;Master
          Trader Blitz API&quot;.
        </p>
        <p className={apiKeyConfigured ? 'opt-toast' : 'opt-hint opt-hint-warn'}>
          API key:{' '}
          {apiKeyConfigured
            ? 'configured (from .env.local build)'
            : 'missing — add VITE_OPENROUTER_API_KEY to .env.local and run npm run build'}
        </p>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.aiAnalyst.enabled}
            onChange={(e) =>
              update({
                aiAnalyst: { ...settings.aiAnalyst, enabled: e.target.checked },
              })
            }
          />
          Enable AI analyst on auto-trade closes
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.aiAnalyst.autoApplyPerTrade}
            onChange={(e) =>
              update({
                aiAnalyst: { ...settings.aiAnalyst, autoApplyPerTrade: e.target.checked },
              })
            }
          />
          Auto-apply per-trade suggestions (not recommended during drawdowns)
        </label>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.aiAnalyst.autoApplyBatch}
            onChange={(e) =>
              update({
                aiAnalyst: { ...settings.aiAnalyst, autoApplyBatch: e.target.checked },
              })
            }
          />
          Auto-apply batch suggestions (after backtest gate passes)
        </label>
        <label className="opt-field">
          <span>OpenRouter model</span>
          <select
            value={modelSelectValue}
            onChange={(e) => {
              const next = e.target.value;
              if (next === OPENROUTER_MODEL_CUSTOM) {
                update({ aiAnalyst: { ...settings.aiAnalyst, model: settings.aiAnalyst.model } });
                return;
              }
              update({
                aiAnalyst: { ...settings.aiAnalyst, model: normalizeOpenRouterModel(next) },
              });
            }}
          >
            {OPENROUTER_MODEL_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value={OPENROUTER_MODEL_CUSTOM}>Custom…</option>
          </select>
        </label>
        {modelSelectValue === OPENROUTER_MODEL_CUSTOM && (
          <label className="opt-field">
            <span>Custom model slug</span>
            <input
              type="text"
              value={settings.aiAnalyst.model}
              placeholder="provider/model-name"
              onChange={(e) =>
                update({
                  aiAnalyst: {
                    ...settings.aiAnalyst,
                    model: normalizeOpenRouterModel(e.target.value),
                  },
                })
              }
            />
          </label>
        )}
        <p className="opt-hint">
          Use full OpenRouter slug — browse{' '}
          <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">
            openrouter.ai/models
          </a>
        </p>
        <div className="opt-actions" style={{ marginBottom: '12px' }}>
          <button
            type="button"
            className="opt-btn"
            disabled={!apiKeyConfigured || !settings.aiAnalyst.enabled}
            onClick={() => void handleTestModel()}
          >
            Test model
          </button>
        </div>
        <div className="opt-grid">
          <NumField
            label="Batch learning every N trades (0=off)"
            value={settings.aiAnalyst.batchEveryNTrades}
            min={0}
            max={500}
            onChange={(v) =>
              update({
                aiAnalyst: { ...settings.aiAnalyst, batchEveryNTrades: v },
              })
            }
          />
          <NumField
            label="Backtest holdout %"
            value={settings.aiAnalyst.holdoutPercent}
            min={5}
            max={50}
            onChange={(v) =>
              update({
                aiAnalyst: { ...settings.aiAnalyst, holdoutPercent: v },
              })
            }
          />
        </div>
        <label className="opt-checkbox">
          <input
            type="checkbox"
            checked={settings.aiAnalyst.requireBacktestForBatch}
            onChange={(e) =>
              update({
                aiAnalyst: {
                  ...settings.aiAnalyst,
                  requireBacktestForBatch: e.target.checked,
                },
              })
            }
          />
          Require backtest improvement before batch setting changes
        </label>
      </section>

      <section className="opt-section opt-section-muted">
        <h2>Trade Journal</h2>
        <p className="opt-hint">
          Auto-attributed trades only. Stored in IndexedDB on this browser profile.
        </p>
        {journalInsights && (
          <div className="opt-journal-insights" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Journal insights</h3>
            <div className="opt-grid">
              <p className="opt-hint" style={{ margin: 0 }}>
                W/L: {journalInsights.wins}/{journalInsights.losses} (
                {(journalInsights.winRate * 100).toFixed(0)}%)
              </p>
              <p className="opt-hint" style={{ margin: 0 }}>
                Streaks: W×{journalInsights.maxWinStreak} / L×{journalInsights.maxLossStreak}
              </p>
              <p className="opt-hint" style={{ margin: 0 }}>
                HIGHER: {journalInsights.higherWins}W / {journalInsights.higherLosses}L
              </p>
              <p className="opt-hint" style={{ margin: 0 }}>
                LOWER: {journalInsights.lowerWins}W / {journalInsights.lowerLosses}L
              </p>
              <p className="opt-hint" style={{ margin: 0 }}>
                Counter-trend losses: {journalInsights.counterTrendLosses}
              </p>
              <p className="opt-hint" style={{ margin: 0 }}>
                AI verdicts: {journalInsights.goodEntryCount} good /{' '}
                {journalInsights.badEntryCount} bad
              </p>
            </div>
            {journalInsights.topThemes.length > 0 && (
              <p className="opt-hint" style={{ marginTop: '8px' }}>
                Top loss themes: {journalInsights.topThemes.join('; ')}
              </p>
            )}
            {latestAggregateRun && (
              <div style={{ marginTop: '12px' }}>
                <p className="opt-hint" style={{ margin: '0 0 4px' }}>
                  Latest batch ({new Date(latestAggregateRun.runAt).toLocaleString()},{' '}
                  {latestAggregateRun.tradeCount} trades)
                  {latestAggregateRun.backtestApplied
                    ? ' — applied after backtest'
                    : Object.keys(latestAggregateRun.settingsPatch).length > 0
                      ? ' — patch pending review'
                      : ' — no patch suggested'}
                </p>
                {latestAggregateRun.lessons.length > 0 && (
                  <ul className="opt-hint" style={{ margin: '4px 0', paddingLeft: '18px' }}>
                    {latestAggregateRun.lessons.map((lesson) => (
                      <li key={lesson}>{lesson}</li>
                    ))}
                  </ul>
                )}
                {Object.keys(latestAggregateRun.settingsPatch).length > 0 && (
                  <pre className="opt-hint" style={{ margin: '4px 0', fontSize: '11px' }}>
                    {JSON.stringify(latestAggregateRun.settingsPatch, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
        <div className="opt-actions" style={{ marginBottom: '12px' }}>
          <button type="button" className="opt-btn" onClick={() => void loadJournal()}>
            Refresh
          </button>
          <button
            type="button"
            className="opt-btn"
            disabled={batchRunning || !settings.aiAnalyst.enabled || !apiKeyConfigured}
            onClick={() => void handleRunBatchAnalysis()}
          >
            {batchRunning ? 'Analyzing…' : 'Run batch analysis now'}
          </button>
          <button
            type="button"
            className="opt-btn"
            disabled={
              !latestAggregateRun ||
              Object.keys(latestAggregateRun.settingsPatch ?? {}).length === 0
            }
            onClick={() => void handleApplySuggestedPatch()}
          >
            Apply suggested patch
          </button>
          <button type="button" className="opt-btn" onClick={() => void handleExportJournalJson()}>
            Export JSON
          </button>
          <button type="button" className="opt-btn" onClick={() => void handleExportJournalCsv()}>
            Export CSV
          </button>
          <button type="button" className="opt-btn" onClick={() => void handleClearJournal()}>
            Clear history
          </button>
          <button
            type="button"
            className="opt-btn"
            disabled={retryingFailed || !settings.aiAnalyst.enabled}
            onClick={() => void handleRetryFailedAnalyses()}
          >
            {retryingFailed ? 'Retrying…' : 'Retry failed analyses'}
          </button>
        </div>
        {journalLoading ? (
          <p className="opt-hint">Loading journal…</p>
        ) : journalRecords.length === 0 ? (
          <p className="opt-hint">No closed auto-trades recorded yet.</p>
        ) : (
          <div className="opt-journal-table-wrap">
            <table className="opt-journal-table">
              <thead>
                <tr>
                  <th>Closed</th>
                  <th>Signal</th>
                  <th>Outcome</th>
                  <th>Stake</th>
                  <th>Verdict</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {journalRecords.map((row) => (
                  <tr
                    key={row.id}
                    className="opt-journal-row"
                    onClick={() => setJournalDetail(row)}
                  >
                    <td>{new Date(row.closedAt).toLocaleString()}</td>
                    <td>{row.signal}</td>
                    <td>{row.outcome}</td>
                    <td>{row.stake}</td>
                    <td>{journalVerdict(row)}</td>
                    <td title={journalSummary(row)}>{journalSummary(row).slice(0, 80)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {journalDetail && (
          <div className="opt-journal-detail">
            <h3>Trade detail</h3>
            {journalDetail.analysisError && (
              <p className="opt-hint opt-hint-warn">Analysis error: {journalDetail.analysisError}</p>
            )}
            {(!journalDetail.analysis || journalDetail.analysisError) &&
              settings.aiAnalyst.enabled && (
              <button
                type="button"
                className="opt-btn opt-btn-primary"
                style={{ marginBottom: '8px' }}
                onClick={() => void handleReanalyzeTrade(journalDetail)}
              >
                Retry analysis
              </button>
            )}
            <pre>{JSON.stringify(journalDetail, null, 2)}</pre>
            <button type="button" className="opt-btn" onClick={() => setJournalDetail(null)}>
              Close
            </button>
          </div>
        )}
      </section>

      <div className="opt-actions">
        <button type="button" className="opt-btn opt-btn-primary" onClick={handleSave}>
          Save Settings
        </button>
        <button type="button" className="opt-btn" onClick={handleReset}>
          Reset Defaults
        </button>
        {saved && <span className="opt-saved">Saved — active tabs updated</span>}
      </div>
    </div>
  );
}
