import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AutoTradeStatsSnapshot, AutoTradeStatus, AiAnalystOverlayState, LatestTradeAnalysis, MaTrend, ProgressionSnapshot, QualityChecklist, SignalDebug, SignalResult } from '../../types';
import { getExnovaGuide, isTradeExpirySec } from '../../lib/settings/presets';
import { displayConfidence, maTrendLabel } from '../../lib/signals/signal-engine';
import { ExnovaGuideCard } from '../../options/ExnovaGuideCard';

interface OverlayProps {
  result: SignalResult | null;
  symbol: string;
  tradeExpirySec: number;
  wsConnected: boolean;
  candleCount: number;
  autoTradeEnabled: boolean;
  autoTradeDryRun: boolean;
  autoTradeStatus: AutoTradeStatus;
  autoTradeStats: AutoTradeStatsSnapshot;
  progressionEnabled: boolean;
  progressionSnapshot: ProgressionSnapshot;
  aiAnalystEnabled: boolean;
  latestAnalysis: LatestTradeAnalysis | null;
  aiAnalystState: AiAnalystOverlayState;
  onAutoTradeToggle: (enabled: boolean) => void;
}

type OverlayTab = 'signal' | 'ai';

const REQUIREMENT_ROWS: {
  key: keyof QualityChecklist;
  label: string;
  labelClass?: string;
}[] = [
  { key: 'rsi', label: 'RSI Extreme', labelClass: 'mtb-req-label-rsi' },
  { key: 'stochastic', label: 'Stochastic Cross' },
  { key: 'candlePattern', label: 'Candle Pattern' },
  { key: 'bollinger', label: 'Bollinger Touch' },
  { key: 'rejectionWick', label: 'Rejection Wick' },
];

function RequirementsList({
  checklist,
  maTrend,
}: {
  checklist: QualityChecklist;
  maTrend: MaTrend;
}) {
  const trendClass =
    maTrend === 'neutral' ? 'mtb-fail' : 'mtb-ok';

  return (
    <div className="mtb-requirements">
      <div className="mtb-requirements-title">Requirements</div>
      {REQUIREMENT_ROWS.map(({ key, label, labelClass }) => (
        <div key={key} className="mtb-req-item">
          <span className={labelClass}>{label}</span>
          <span className={checklist[key] ? 'mtb-ok' : 'mtb-fail'}>
            {checklist[key] ? '✓' : '✕'}
          </span>
        </div>
      ))}
      <div className="mtb-req-item">
        <span>Moving Average Trend</span>
        <span className={trendClass}>{maTrendLabel(maTrend)}</span>
      </div>
    </div>
  );
}

function formatScoreBreakdown(
  label: string,
  c: SignalDebug['higherConfidence'],
): string {
  return `${label}: RSI ${c.rsi} + Stoch ${c.stochastic} + Pattern ${c.candlePattern} + BB ${c.bollinger} + Wick ${c.rejectionWick} + MA ${c.movingAverage}`;
}

function AdvancedPanel({
  debug,
  ind,
  signal,
  guide,
  expanded,
}: {
  debug: SignalDebug;
  ind: NonNullable<SignalResult['indicators']>;
  signal: string;
  guide: ReturnType<typeof getExnovaGuide>;
  expanded: boolean;
}) {
  if (!expanded) return null;

  const crossBar =
    debug.bullishCrossAgeBars !== null
      ? `Up bar ${debug.bullishCrossAgeBars + 1}`
      : debug.bearishCrossAgeBars !== null
        ? `Down bar ${debug.bearishCrossAgeBars + 1}`
        : '—';

  return (
    <div className="mtb-advanced">
      <div className="mtb-advanced-row">
        <span className="mtb-adv-rsi">RSI</span>
        <span>{debug.rsi.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span className="mtb-adv-stoch-k">Stoch K</span>
        <span>{ind.stochK.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span className="mtb-adv-stoch-d">Stoch D</span>
        <span>{ind.stochD.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span className="mtb-adv-adx">ADX</span>
        <span>{debug.adx.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span className="mtb-adv-plus-di">+DI</span>
        <span>{debug.plusDi.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span className="mtb-adv-minus-di">-DI</span>
        <span>{debug.minusDi.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span>Cross bar</span>
        <span>{crossBar}</span>
      </div>
      <div className="mtb-advanced-row">
        <span>Signal</span>
        <span>{signal}</span>
      </div>
      <div className="mtb-advanced-row mtb-advanced-score">
        <span>Score</span>
        <span>
          {formatScoreBreakdown('HIGHER', debug.higherConfidence)}
          <br />
          {formatScoreBreakdown('LOWER', debug.lowerConfidence)}
        </span>
      </div>
      <div className="mtb-advanced-reason">{debug.reason}</div>
      <ExnovaGuideCard guide={guide} compact />
    </div>
  );
}

function AiAnalystPanel({
  enabled,
  state,
  latestAnalysis,
  verdictClass,
}: {
  enabled: boolean;
  state: AiAnalystOverlayState;
  latestAnalysis: LatestTradeAnalysis | null;
  verdictClass: string;
}) {
  const activityLabel =
    state.activity === 'analyzing'
      ? 'Analyzing last trade…'
      : state.activity === 'done'
        ? 'Last analysis complete'
        : state.activity === 'error'
          ? 'Last analysis failed'
          : 'Waiting for next auto-trade close';

  return (
    <div className="mtb-ai-panel">
      <div className="mtb-ai-panel-title">AI Trade Analyst</div>

      <div className="mtb-ai-status-grid">
        <div className="mtb-ai-status-row">
          <span>Analyst</span>
          <span className={enabled ? 'mtb-ok' : 'mtb-fail'}>
            {enabled ? '● Enabled' : '○ Disabled — turn on in Options'}
          </span>
        </div>
        <div className="mtb-ai-status-row">
          <span>API key</span>
          <span className={state.apiKeyConfigured ? 'mtb-ok' : 'mtb-fail'}>
            {state.apiKeyConfigured ? '● Configured' : '○ Missing — .env.local + rebuild'}
          </span>
        </div>
        <div className="mtb-ai-status-row">
          <span>Model</span>
          <span className="mtb-ai-model">{state.model}</span>
        </div>
        <div className="mtb-ai-status-row">
          <span>Journal</span>
          <span>{state.journalCount} auto-trade(s) saved</span>
        </div>
        <div className="mtb-ai-status-row">
          <span>Status</span>
          <span
            className={
              state.activity === 'analyzing'
                ? 'mtb-ai-activity-busy'
                : state.activity === 'error'
                  ? 'mtb-fail'
                  : 'mtb-ai-activity-idle'
            }
          >
            {activityLabel}
          </span>
        </div>
      </div>

      {state.lastError && (
        <div className="mtb-ai-error">{state.lastError}</div>
      )}

      {latestAnalysis ? (
        <div className="mtb-ai-insight">
          <div className="mtb-ai-insight-title">Latest insight</div>
          <div className={`mtb-ai-verdict ${verdictClass}`}>
            {latestAnalysis.outcome.toUpperCase()} · {latestAnalysis.verdict.replace(/_/g, ' ')}
          </div>
          <div className="mtb-ai-summary">{latestAnalysis.summary}</div>
          {latestAnalysis.lessons.length > 0 && (
            <ul className="mtb-ai-lessons">
              {latestAnalysis.lessons.map((lesson) => (
                <li key={lesson}>{lesson}</li>
              ))}
            </ul>
          )}
          {latestAnalysis.appliedPatches.length > 0 && (
            <div className="mtb-ai-applied">
              Applied:{' '}
              {latestAnalysis.appliedPatches
                .map((p) => `${p.path} → ${String(p.after)}`)
                .join(', ')}
            </div>
          )}
        </div>
      ) : (
        <p className="mtb-ai-hint">
          {enabled
            ? 'When an auto-attributed trade closes, OpenRouter analyzes it here.'
            : 'Enable AI analyst in extension Options to start learning from closes.'}
        </p>
      )}

      <p className="mtb-ai-hint mtb-ai-hint-muted">
        Full history: extension Options → Trade Journal
      </p>
    </div>
  );
}

export function Overlay({
  result,
  symbol,
  tradeExpirySec,
  wsConnected,
  candleCount,
  autoTradeEnabled,
  autoTradeDryRun,
  autoTradeStatus,
  autoTradeStats,
  progressionEnabled,
  progressionSnapshot,
  aiAnalystEnabled,
  latestAnalysis,
  aiAnalystState,
  onAutoTradeToggle,
}: OverlayProps) {
  const signal = result?.signal ?? 'WAIT';
  const confirming = result?.confirming ?? false;
  const holdRemaining = result?.holdSecondsRemaining ?? 0;
  const pendingSignal = result?.rawSignal ?? 'WAIT';
  const ind = result?.indicators;
  const pattern = result?.pattern;
  const dualConfidence = result?.dualConfidence;
  const higherPct = displayConfidence(dualConfidence?.higher.total ?? 0);
  const lowerPct = displayConfidence(dualConfidence?.lower.total ?? 0);
  const activeCheck = result?.activeCheck ?? {
    rsi: false,
    stochastic: false,
    candlePattern: false,
    bollinger: false,
    rejectionWick: false,
    movingAverageTrend: false,
  };
  const debug = result?.debug;
  const maTrend = ind?.maTrend ?? debug?.maTrend ?? 'neutral';
  const guide = getExnovaGuide(
    isTradeExpirySec(tradeExpirySec) ? tradeExpirySec : 5,
  );

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<OverlayTab>('signal');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPos({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const signalClass =
    signal === 'HIGHER'
      ? 'mtb-signal-higher'
      : signal === 'LOWER'
        ? 'mtb-signal-lower'
        : confirming
          ? 'mtb-signal-confirming'
          : 'mtb-signal-wait';

  const signalLabel = confirming ? 'WAIT' : signal;
  const isPremium =
    (signal === 'HIGHER' && higherPct >= 90) ||
    (signal === 'LOWER' && lowerPct >= 90);
  const waitSubtitle =
    !confirming && signal === 'WAIT' && debug?.reason
      ? debug.reason
      : null;

  const autoTradeLine =
    autoTradeEnabled && autoTradeStatus.action !== 'none'
      ? autoTradeStatus.message
      : null;

  const wlTitle = `Auto-trade session wins/losses · Best win streak ${autoTradeStats.longestWinStreak} · Best loss streak ${autoTradeStats.longestLossStreak}`;

  const wlDisplay = (
    <>
      W/L{' '}
      <span className="mtb-wl-wins">{autoTradeStats.wins}</span>/
      <span className="mtb-wl-losses">{autoTradeStats.losses}</span>
      {(autoTradeStats.longestWinStreak > 0 ||
        autoTradeStats.longestLossStreak > 0) && (
        <span className="mtb-wl-streaks">
          {' '}
          · W×{autoTradeStats.longestWinStreak} · L×{autoTradeStats.longestLossStreak}
        </span>
      )}
      {autoTradeStats.pendingCount > 0 && (
        <span className="mtb-wl-pending"> · pending</span>
      )}
    </>
  );

  const progressionLine = progressionEnabled
    ? `${progressionSnapshot.profileId} · Level ${progressionSnapshot.level} · Stake: ${progressionSnapshot.stake}`
    : null;

  const verdictClass =
    latestAnalysis?.verdict === 'good_entry'
      ? 'mtb-ai-verdict-good'
      : latestAnalysis?.verdict === 'bad_entry'
        ? 'mtb-ai-verdict-bad'
        : 'mtb-ai-verdict-neutral';

  return (
    <div
      className="mtb-overlay"
      data-collapsed={panelCollapsed}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div
        className="mtb-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <span className="mtb-title">Master Trader Blitz</span>
        <label
          className="mtb-auto-switch"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="mtb-auto-switch-label">Auto</span>
          <input
            type="checkbox"
            className="mtb-switch-input"
            checked={autoTradeEnabled}
            onChange={(e) => onAutoTradeToggle(e.target.checked)}
            aria-label={
              autoTradeEnabled
                ? autoTradeDryRun
                  ? 'Auto-trade on (dry run)'
                  : 'Auto-trade on'
                : 'Auto-trade off'
            }
          />
          <span className="mtb-switch-track" aria-hidden="true" />
        </label>
        <button
          type="button"
          className="mtb-collapse"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPanelCollapsed((c) => !c)}
          aria-label={panelCollapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!panelCollapsed}
        >
          {panelCollapsed ? '+' : '−'}
        </button>
        <span className={`mtb-ws ${wsConnected ? 'mtb-ws-on' : 'mtb-ws-off'}`}>
          {wsConnected ? 'WS' : 'WS off'}
        </span>
      </div>

      {!panelCollapsed && (
        <div className="mtb-tabs" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`mtb-tab ${activeTab === 'signal' ? 'mtb-tab-active' : ''}`}
            onClick={() => setActiveTab('signal')}
          >
            Signal
          </button>
          <button
            type="button"
            className={`mtb-tab ${activeTab === 'ai' ? 'mtb-tab-active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Analyst
            {aiAnalystState.activity === 'analyzing' && (
              <span className="mtb-tab-badge" aria-hidden="true" />
            )}
          </button>
        </div>
      )}

      {panelCollapsed ? (
        <div className="mtb-overlay-scroll">
          <div className="mtb-compact-bar">
            <span className={`mtb-compact-signal ${signalClass}`}>
              {confirming && pendingSignal !== 'WAIT' ? pendingSignal : signalLabel}
            </span>
            {progressionEnabled && (
              <span className="mtb-compact-stake" title="Current progression stake">
                L{progressionSnapshot.level} ${progressionSnapshot.stake}
              </span>
            )}
            <span className="mtb-compact-wl" title={wlTitle}>
              {wlDisplay}
            </span>
            {aiAnalystState.activity === 'analyzing' && (
              <span className="mtb-compact-ai" title="AI analyzing trade">
                AI…
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mtb-overlay-scroll">
          {activeTab === 'ai' ? (
            <AiAnalystPanel
              enabled={aiAnalystEnabled}
              state={aiAnalystState}
              latestAnalysis={latestAnalysis}
              verdictClass={verdictClass}
            />
          ) : (
            <>
          {progressionEnabled && (
            <div
              className={`mtb-progression${progressionSnapshot.stopped ? ' mtb-progression-stopped' : ''}`}
            >
              <div className="mtb-progression-title">Current Progression</div>
              <div className="mtb-progression-line">{progressionLine}</div>
            </div>
          )}

          {progressionEnabled && progressionSnapshot.lastWarning && (
            <div
              className={`mtb-progression-alert${
                progressionSnapshot.stopped ? ' mtb-progression-alert-stop' : ''
              }`}
            >
              {progressionSnapshot.lastWarning}
            </div>
          )}

          <div className={`mtb-signal-hero ${signalClass}`}>{signalLabel}</div>

          {confirming && pendingSignal !== 'WAIT' && (
            <div className="mtb-confirming">
              Confirming {pendingSignal} — {holdRemaining}s
            </div>
          )}

          {waitSubtitle && (
            <div className="mtb-wait-subtitle">{waitSubtitle}</div>
          )}

          {autoTradeLine && (
            <div
              className={`mtb-auto-trade ${autoTradeStatus.action === 'error' ? 'mtb-auto-trade-error' : ''}`}
            >
              Auto: {autoTradeLine}
            </div>
          )}

          {isPremium && (
            <div className="mtb-premium-badge">Premium Setup</div>
          )}

          {ind && (
            <>
              <div className="mtb-dual-confidence">
                <div
                  className={`mtb-dual-row mtb-dual-higher ${
                    signal === 'HIGHER' ? 'mtb-dual-active' : ''
                  } ${signal === 'HIGHER' && higherPct >= 90 ? 'mtb-dual-premium' : ''}`}
                >
                  <span className="mtb-dual-label">🟢 HIGHER</span>
                  <span className="mtb-dual-pct">{higherPct}%</span>
                </div>
                <div
                  className={`mtb-dual-row mtb-dual-lower ${
                    signal === 'LOWER' ? 'mtb-dual-active' : ''
                  } ${signal === 'LOWER' && lowerPct >= 90 ? 'mtb-dual-premium' : ''}`}
                >
                  <span className="mtb-dual-label">🔴 LOWER</span>
                  <span className="mtb-dual-pct">{lowerPct}%</span>
                </div>
              </div>

              <RequirementsList checklist={activeCheck} maTrend={maTrend} />

              {pattern && pattern.pattern !== 'None' && (
                <div className="mtb-pattern-block">
                  <div className="mtb-pattern-label">Pattern</div>
                  <div className="mtb-pattern-name">{pattern.pattern}</div>
                </div>
              )}

              {debug && (
                <>
                  <button
                    type="button"
                    className="mtb-advanced-toggle"
                    onClick={() => setAdvancedOpen((o) => !o)}
                  >
                    Advanced {advancedOpen ? '▲' : '▼'}
                  </button>
                  <AdvancedPanel
                    debug={debug}
                    ind={ind}
                    signal={signalLabel}
                    guide={guide}
                    expanded={advancedOpen}
                  />
                </>
              )}
            </>
          )}

          <div className="mtb-status">
            <span className="mtb-wl" title={wlTitle}>
              {wlDisplay}
            </span>
            <span title="active_id">{symbol}</span>
            <span>{tradeExpirySec}s</span>
            <span>
              {ind
                ? `${ind.warmupCurrent}/${ind.warmupRequired} warmup`
                : `${candleCount} bars`}
            </span>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
