import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type {
  AutoTradeStatsSnapshot,
  AutoTradeStatus,
  AiAnalystOverlayState,
  AutoTradingMode,
  LatestTradeAnalysis,
  ProgressionSnapshot,
  SignalResult,
  TradingMode,
} from '../../types';
import { AutoTradeSwitch } from './components/AutoTradeSwitch';
import { AiAnalystModelSelect } from './components/AiAnalystModelSelect';
import { AiAnalystSwitch } from './components/AiAnalystSwitch';
import { AiAutoTradeGate } from './components/AiAutoTradeGate';
import { AiDecisionPanel } from './components/AiDecisionPanel';
import { DecisionHero } from './components/DecisionHero';
import { LegacySignalPanel } from './components/LegacySignalPanel';
import { ManualConfirmBar } from './components/ManualConfirmBar';
import { MarketEvidencePanel } from './components/MarketEvidencePanel';
import { OverlayTabPanel, OverlayTabs, type OverlayTab } from './components/OverlayTabs';
import { SectionDivider } from './components/SectionDivider';
import { StatusFooter } from './components/StatusFooter';
import type { MarketSnapshot } from '@mtb/shared';

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
  tradingMode: TradingMode;
  autoTradingMode: AutoTradingMode;
  aiAutoTradeThreshold?: number;
  aiAutoTradeGateMessage?: string | null;
  aiBackendConfigured?: boolean;
  pendingManualTrade: { signal: 'HIGHER' | 'LOWER'; warmedUp: boolean } | null;
  onManualConfirm: () => void;
  onManualReject: () => void;
  onAutoTradeToggle: (enabled: boolean) => void;
  onAiAnalystToggle: (enabled: boolean) => void;
  onAiAnalystModelChange: (model: string) => void;
}

function AiAnalystPanel({
  enabled,
  state,
  latestAnalysis,
  verdictClass,
  onToggle,
  model,
  onModelChange,
  tradingMode,
}: {
  enabled: boolean;
  state: AiAnalystOverlayState;
  latestAnalysis: LatestTradeAnalysis | null;
  verdictClass: string;
  onToggle: (enabled: boolean) => void;
  model: string;
  onModelChange: (model: string) => void;
  tradingMode: TradingMode;
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
      <div className="mtb-ai-panel-header">
        <div className="mtb-ai-panel-title">AI Trade Analyst</div>
        <AiAnalystSwitch enabled={enabled} onToggle={onToggle} />
      </div>
      <p className="mtb-ai-panel-hint">
        Post-trade journal review via OpenRouter (extension API key). Does not affect
        live BUY/SELL decisions — those use your API server.
      </p>
      <div className="mtb-openrouter-key-banner">
        {tradingMode === 'AI' ? (
          <>
            Analyst OFF stops journal calls only. Live decisions still use the API server{' '}
            <code>OPENROUTER_API_KEY</code> (OpenRouter title: &quot;Master Trader Blitz
            API&quot;). Set Mode to LEGACY in Options to stop those calls.
          </>
        ) : (
          <>
            LEGACY mode — live signals use the local confidence engine only (no API server
            calls). Analyst journal still uses your extension OpenRouter key when enabled.
          </>
        )}
      </div>

      <div className="mtb-ai-status-grid">
        <div className="mtb-ai-status-row">
          <span>Analyst</span>
          <span className={enabled ? 'mtb-ok' : 'mtb-fail'}>
            {enabled ? '● On — uses OpenRouter credits' : '○ Off — no analyst API calls'}
          </span>
        </div>
        <div className="mtb-ai-status-row">
          <span>API key</span>
          <span className={state.apiKeyConfigured ? 'mtb-ok' : 'mtb-fail'}>
            {state.apiKeyConfigured ? '● Configured' : '○ Missing — .env.local + rebuild'}
          </span>
        </div>
      </div>

      <AiAnalystModelSelect model={model} onModelChange={onModelChange} />

      <div className="mtb-ai-status-grid">
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

      {state.lastError && <div className="mtb-ai-error">{state.lastError}</div>}

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
            : 'Turn on Analyst above to review closed trades (uses OpenRouter credits).'}
        </p>
      )}

      <p className="mtb-ai-hint mtb-ai-hint-muted">
        Full history: extension Options → Trade Journal
      </p>
    </div>
  );
}

function ProgressionBlock({
  enabled,
  snapshot,
}: {
  enabled: boolean;
  snapshot: ProgressionSnapshot;
}) {
  if (!enabled) return null;

  const line = `${snapshot.profileId} · Level ${snapshot.level} · Stake: ${snapshot.stake}`;

  return (
    <>
      <div
        className={`mtb-progression${snapshot.stopped ? ' mtb-progression-stopped' : ''}`}
      >
        <div className="mtb-progression-title">Current Progression</div>
        <div className="mtb-progression-line">{line}</div>
      </div>
      {snapshot.lastWarning && (
        <div
          className={`mtb-progression-alert${
            snapshot.stopped ? ' mtb-progression-alert-stop' : ''
          }`}
        >
          {snapshot.lastWarning}
        </div>
      )}
    </>
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
  tradingMode,
  autoTradingMode,
  aiAutoTradeThreshold,
  aiAutoTradeGateMessage,
  aiBackendConfigured,
  pendingManualTrade,
  onManualConfirm,
  onManualReject,
  onAutoTradeToggle,
  onAiAnalystToggle,
  onAiAnalystModelChange,
}: OverlayProps) {
  const isAiMode = tradingMode === 'AI';
  const aiDecision = result?.aiDecision;
  const aiSnapshot = result?.aiSnapshot as MarketSnapshot | null | undefined;
  const signal = result?.signal ?? 'WAIT';
  const confirming = result?.confirming ?? false;
  const holdRemaining = result?.holdSecondsRemaining ?? 0;
  const pendingSignal = result?.rawSignal ?? 'WAIT';
  const ind = result?.indicators;

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<OverlayTab>('signal');
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

  const verdictClass =
    latestAnalysis?.verdict === 'good_entry'
      ? 'mtb-ai-verdict-good'
      : latestAnalysis?.verdict === 'bad_entry'
        ? 'mtb-ai-verdict-bad'
        : 'mtb-ai-verdict-neutral';

  const compactDecisionLabel = isAiMode
    ? aiDecision
      ? `${aiDecision.decision} ${aiDecision.confidence}%`
      : signalLabel
    : confirming && pendingSignal !== 'WAIT'
      ? pendingSignal
      : signalLabel;

  const compactDecisionClass = isAiMode
    ? aiDecision?.decision === 'BUY'
      ? 'mtb-signal-higher'
      : aiDecision?.decision === 'SELL'
        ? 'mtb-signal-lower'
        : 'mtb-signal-wait'
    : signalClass;

  const signalTabFooter =
    activeTab === 'signal' ? (
      <StatusFooter
        autoTradeStats={autoTradeStats}
        symbol={symbol}
        tradeExpirySec={tradeExpirySec}
        indicators={ind}
        candleCount={candleCount}
        autoTradingMode={isAiMode ? autoTradingMode : undefined}
        aiAutoTradeThreshold={isAiMode ? aiAutoTradeThreshold : undefined}
        isAiMode={isAiMode}
        aiBackendConfigured={aiBackendConfigured}
      />
    ) : null;

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
        <div className="mtb-header-controls">
          <AutoTradeSwitch
            enabled={autoTradeEnabled}
            dryRun={autoTradeDryRun}
            onToggle={onAutoTradeToggle}
          />
          <button
            type="button"
            className="mtb-collapse"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPanelCollapsed(!panelCollapsed);
            }}
            aria-label={panelCollapsed ? 'Expand' : 'Collapse'}
            aria-expanded={!panelCollapsed}
          >
            {panelCollapsed ? '+' : '−'}
          </button>
          <span className={`mtb-ws ${wsConnected ? 'mtb-ws-on' : 'mtb-ws-off'}`}>
            {wsConnected ? 'WS' : 'WS off'}
          </span>
        </div>
      </div>

      {panelCollapsed ? (
        <div className="mtb-overlay-scroll">
          <div className="mtb-compact-bar">
            <span className={`mtb-compact-signal ${compactDecisionClass}`}>
              {compactDecisionLabel}
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
        <OverlayTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tradingMode={tradingMode}
          aiAnalystEnabled={aiAnalystEnabled}
          aiAnalystState={aiAnalystState}
          footer={signalTabFooter}
        >
          <OverlayTabPanel value="ai">
            <AiAnalystPanel
              enabled={aiAnalystEnabled}
              state={aiAnalystState}
              latestAnalysis={latestAnalysis}
              verdictClass={verdictClass}
              onToggle={onAiAnalystToggle}
              model={aiAnalystState.model}
              onModelChange={onAiAnalystModelChange}
              tradingMode={tradingMode}
            />
          </OverlayTabPanel>

          <OverlayTabPanel value="signal">
            <ProgressionBlock enabled={progressionEnabled} snapshot={progressionSnapshot} />

            {isAiMode && result ? (
                <>
                  <DecisionHero
                    aiDecision={aiDecision}
                    loading={result.aiLoading}
                    confirming={confirming}
                    pendingSignal={pendingSignal}
                    holdRemaining={holdRemaining}
                  />

                  <div className="mtb-status-stack">
                    <AiAutoTradeGate message={aiAutoTradeGateMessage ?? null} />

                    <div
                      className={`mtb-auto-trade${
                        autoTradeLine ? '' : ' mtb-auto-trade-empty'
                      }${autoTradeStatus.action === 'error' ? ' mtb-auto-trade-error' : ''}`}
                    >
                      {autoTradeLine ? `Auto: ${autoTradeLine}` : '\u00a0'}
                    </div>
                  </div>

                  {pendingManualTrade && autoTradingMode === 'manual' && (
                    <ManualConfirmBar
                      pendingSignal={pendingManualTrade.signal}
                      onConfirm={onManualConfirm}
                      onReject={onManualReject}
                    />
                  )}

                  <SectionDivider />

                  <MarketEvidencePanel snapshot={aiSnapshot} />

                  <SectionDivider />

                  <AiDecisionPanel
                    aiDecision={aiDecision}
                    error={result.aiError}
                    loading={result.aiLoading}
                  />
                </>
              ) : result ? (
                <LegacySignalPanel
                  result={result}
                  tradeExpirySec={tradeExpirySec}
                  autoTradeLine={autoTradeLine}
                  autoTradeError={autoTradeStatus.action === 'error'}
                />
              ) : null}
          </OverlayTabPanel>
        </OverlayTabs>
      )}
    </div>
  );
}
