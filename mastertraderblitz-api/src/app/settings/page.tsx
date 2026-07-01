'use client';

import { useEffect, useState } from 'react';
import {
  OPENROUTER_MODEL_CUSTOM,
  OPENROUTER_MODEL_PRESETS,
  normalizeOpenRouterModel,
  resolveModelSelectValue,
} from '@mtb/shared/openrouter-models';

interface AiSettingsForm {
  model: string;
  confidenceThreshold: number;
  autoTradeThreshold: number;
  maxLossStreak: number;
  cooldownBetweenTradesSec: number;
  allowedAssets: string;
  allowedExpiry: number[];
}

interface DecideRuntimeInfo {
  openrouterConfigured?: boolean;
  openrouterAppTitle?: string;
  lastDecisionAt?: number | null;
  decideCallCount?: number;
  callsPerHourEstimate?: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<AiSettingsForm>({
    model: 'google/gemini-3.5-flash',
    confidenceThreshold: 70,
    autoTradeThreshold: 85,
    maxLossStreak: 5,
    cooldownBetweenTradesSec: 5,
    allowedAssets: '',
    allowedExpiry: [5, 10, 15, 30],
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<DecideRuntimeInfo>({});
  const modelSelectValue = resolveModelSelectValue(form.model);

  const headers = {
    'Content-Type': 'application/json',
    'x-mtb-api-key': process.env.NEXT_PUBLIC_MTB_API_KEY ?? '',
  };

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then((r) => r.json())
      .then((d) => {
        setForm({
          model: normalizeOpenRouterModel(d.model),
          confidenceThreshold: d.confidenceThreshold,
          autoTradeThreshold: d.autoTradeThreshold,
          maxLossStreak: d.maxLossStreak,
          cooldownBetweenTradesSec: d.cooldownBetweenTradesSec,
          allowedAssets: (d.allowedAssets ?? []).join(', '),
          allowedExpiry: d.allowedExpiry ?? [5, 10, 15, 30],
        });
        setRuntime({
          openrouterConfigured: d.openrouterConfigured,
          openrouterAppTitle: d.openrouterAppTitle,
          lastDecisionAt: d.lastDecisionAt,
          decideCallCount: d.decideCallCount,
          callsPerHourEstimate: d.callsPerHourEstimate,
        });
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    setSaveError(null);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        model: normalizeOpenRouterModel(form.model),
        confidenceThreshold: form.confidenceThreshold,
        autoTradeThreshold: form.autoTradeThreshold,
        maxLossStreak: form.maxLossStreak,
        cooldownBetweenTradesSec: form.cooldownBetweenTradesSec,
        allowedAssets: form.allowedAssets
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        allowedExpiry: form.allowedExpiry,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSaveError(
        body?.error ??
          (res.status === 500
            ? 'Server error — stop dev, run npm run clean, then npm run dev'
            : `Save failed (${res.status})`),
      );
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <h2>AI Configuration</h2>
      <div className="form-grid">
        <label>
          OpenRouter Model
          <select
            value={modelSelectValue}
            onChange={(e) => {
              const next = e.target.value;
              if (next === OPENROUTER_MODEL_CUSTOM) return;
              setForm({ ...form, model: normalizeOpenRouterModel(next) });
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
          <label>
            Custom model slug
            <input
              value={form.model}
              placeholder="provider/model-name"
              onChange={(e) =>
                setForm({ ...form, model: normalizeOpenRouterModel(e.target.value) })
              }
            />
          </label>
        )}
        <label>
          Confidence Threshold (semi-auto)
          <input
            type="number"
            min={0}
            max={100}
            value={form.confidenceThreshold}
            onChange={(e) =>
              setForm({ ...form, confidenceThreshold: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Auto Trade Threshold (full auto)
          <input
            type="number"
            min={0}
            max={100}
            value={form.autoTradeThreshold}
            onChange={(e) =>
              setForm({ ...form, autoTradeThreshold: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Maximum Loss Streak
          <input
            type="number"
            min={1}
            max={50}
            value={form.maxLossStreak}
            onChange={(e) => setForm({ ...form, maxLossStreak: Number(e.target.value) })}
          />
        </label>
        <label>
          Cooldown Between Trades (sec)
          <input
            type="number"
            min={0}
            max={300}
            value={form.cooldownBetweenTradesSec}
            onChange={(e) =>
              setForm({ ...form, cooldownBetweenTradesSec: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Allowed Assets (comma-separated, empty = all)
          <input
            value={form.allowedAssets}
            onChange={(e) => setForm({ ...form, allowedAssets: e.target.value })}
          />
        </label>
        <button type="button" onClick={save}>
          Save Settings
        </button>
        {saved && <span className="positive">Saved</span>}
        {saveError && <span className="negative">{saveError}</span>}
        <div style={{ fontSize: '0.8rem', color: '#8a9bb0', marginTop: '8px' }}>
          <p style={{ margin: '0 0 6px' }}>
            OpenRouter API key is configured server-side via <code>OPENROUTER_API_KEY</code>.
            Live decisions bill as &quot;{runtime.openrouterAppTitle ?? 'Master Trader Blitz API'}
            &quot; on OpenRouter — not controlled by the extension Analyst toggle.
          </p>
          <p style={{ margin: '0 0 6px' }}>
            To stop live OpenRouter calls: switch extension Options to <strong>LEGACY</strong>{' '}
            or stop this API server.
          </p>
          {runtime.openrouterConfigured ? (
            <p style={{ margin: 0 }}>
              Session: {runtime.decideCallCount ?? 0} decide call(s)
              {runtime.lastDecisionAt
                ? ` · last ${new Date(runtime.lastDecisionAt).toLocaleString()}`
                : ' · none yet'}
              {runtime.callsPerHourEstimate != null
                ? ` · ~${runtime.callsPerHourEstimate}/hr`
                : ''}
            </p>
          ) : (
            <p style={{ margin: 0, color: '#f87171' }}>
              OPENROUTER_API_KEY not set — live decisions will fail until configured.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
