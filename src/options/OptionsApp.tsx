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
import type { AppSettings } from '../types';
import { ExnovaGuideCard } from './ExnovaGuideCard';

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
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

  const expiry = settings.market.tradeExpirySec;
  const guide = getExnovaGuide(expiry);

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

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

  const handleTestClick = async () => {
    setProbeResult(null);
    try {
      const tab = await findExnovaTab();
      if (!tab?.id) {
        setProbeResult('No Exnova tab found.');
        return;
      }
      const result = (await chrome.tabs.sendMessage(tab.id, {
        type: 'mtb-test-click',
        signal: 'HIGHER',
      })) as { ok: boolean; message: string };
      setProbeResult(result.message);
    } catch {
      setProbeResult('Test click failed — refresh Exnova tab and reload extension.');
    }
    setTimeout(() => setProbeResult(null), 6000);
  };

  const handlePingHelper = async () => {
    setProbeResult(null);
    try {
      const result = (await chrome.runtime.sendMessage({
        type: 'mtb-click-helper-ping',
      })) as { ok: boolean; message: string };
      if (result.ok) {
        setProbeResult(`Native helper OK: ${result.message}`);
      } else if (result.message.includes('not found')) {
        setProbeResult(
          `Native helper not registered. In PowerShell run: cd helper ; .\\install-native-helper.ps1 — then reload extension from dist/`,
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
        <p>Dual-confidence scoring — saved locally via Chrome Storage</p>
      </header>

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
        <label className="opt-field">
          <span>Click engine</span>
          <select
            value={settings.autoTrade.clickEngine}
            disabled={!settings.autoTrade.enabled}
            onChange={(e) =>
              update({
                autoTrade: {
                  ...settings.autoTrade,
                  clickEngine: e.target.value as AppSettings['autoTrade']['clickEngine'],
                },
              })
            }
          >
            <option value="debugger">Chrome debugger (trusted, recommended)</option>
            <option value="native">Native helper (OS-level clicks)</option>
            <option value="synthetic">Synthetic (legacy — usually ignored by Exnova)</option>
          </select>
        </label>
        <p className="opt-hint">
          Exnova ignores synthetic JavaScript clicks. Use <strong>Chrome debugger</strong> for
          trusted clicks without a separate app (Chrome shows a short “controlled by automation”
          banner). Use <strong>Native helper</strong> only if debugger is blocked — see{' '}
          <code>helper/README.md</code>.
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
          onClick={() => void handleTestClick()}
        >
          Test HIGHER click on Exnova tab
        </button>
        {settings.autoTrade.clickEngine === 'native' && (
          <>
            <p className="opt-hint">
              Extension ID: <code>{extensionId}</code>. Python alone is not enough — register the
              native host once: open PowerShell in the project <code>helper</code> folder and run{' '}
              <code>.\install-native-helper.ps1</code>, then reload this extension from{' '}
              <code>dist/</code>.
            </p>
            <button type="button" className="opt-btn" onClick={() => void handlePingHelper()}>
              Ping native helper
            </button>
          </>
        )}
        {probeResult && <p className="opt-toast">{probeResult}</p>}
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
          Hold: wait before confirming HIGHER/LOWER (0 = instant). Cooldown:
          keep signal visible before accepting a new one.
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
        <h2>Advanced filters (disabled)</h2>
        <p className="opt-hint">
          Bollinger and rejection wick contribute to confidence scoring. ADX and
          EMA settings are kept for future use.
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
          <NumField
            label="EMA Fast"
            value={settings.ema.fastPeriod}
            min={2}
            max={200}
            onChange={(v) => update({ ema: { ...settings.ema, fastPeriod: v } })}
          />
          <NumField
            label="EMA Slow"
            value={settings.ema.slowPeriod}
            min={2}
            max={200}
            onChange={(v) => update({ ema: { ...settings.ema, slowPeriod: v } })}
          />
        </div>
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
