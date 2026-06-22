import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AutoTradeStatus, QualityChecklist, SignalDebug, SignalResult } from '../../types';
import { getExnovaGuide, isTradeExpirySec } from '../../lib/settings/presets';
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
  onAutoTradeToggle: (enabled: boolean) => void;
}

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

function RequirementsList({ checklist }: { checklist: QualityChecklist }) {
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
    </div>
  );
}

function formatScoreBreakdown(
  label: string,
  c: SignalDebug['higherConfidence'],
): string {
  return `${label}: RSI ${c.rsi} + Stoch ${c.stochastic} + Pattern ${c.candlePattern} + BB ${c.bollinger} + Wick ${c.rejectionWick}`;
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

export function Overlay({
  result,
  symbol,
  tradeExpirySec,
  wsConnected,
  candleCount,
  autoTradeEnabled,
  autoTradeDryRun,
  autoTradeStatus,
  onAutoTradeToggle,
}: OverlayProps) {
  const signal = result?.signal ?? 'WAIT';
  const confirming = result?.confirming ?? false;
  const holdRemaining = result?.holdSecondsRemaining ?? 0;
  const pendingSignal = result?.rawSignal ?? 'WAIT';
  const ind = result?.indicators;
  const pattern = result?.pattern;
  const dualConfidence = result?.dualConfidence;
  const higherPct = dualConfidence?.higher.total ?? 0;
  const lowerPct = dualConfidence?.lower.total ?? 0;
  const activeCheck = result?.activeCheck ?? {
    rsi: false,
    stochastic: false,
    candlePattern: false,
    bollinger: false,
    rejectionWick: false,
  };
  const debug = result?.debug;
  const guide = getExnovaGuide(
    isTradeExpirySec(tradeExpirySec) ? tradeExpirySec : 5,
  );

  const [panelCollapsed, setPanelCollapsed] = useState(false);
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
        <div
          className="mtb-auto-switch"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="mtb-auto-switch-label">Auto</span>
          <button
            type="button"
            role="switch"
            aria-checked={autoTradeEnabled}
            aria-label={
              autoTradeEnabled
                ? autoTradeDryRun
                  ? 'Auto-trade on (dry run)'
                  : 'Auto-trade on'
                : 'Auto-trade off'
            }
            className={`mtb-switch ${autoTradeEnabled ? 'mtb-switch-on' : ''}`}
            onClick={() => onAutoTradeToggle(!autoTradeEnabled)}
          >
            <span className="mtb-switch-thumb" />
          </button>
        </div>
        <button
          type="button"
          className="mtb-collapse"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setPanelCollapsed((c) => !c)}
          aria-label={panelCollapsed ? 'Expand' : 'Collapse'}
        >
          {panelCollapsed ? '+' : '−'}
        </button>
        <span className={`mtb-ws ${wsConnected ? 'mtb-ws-on' : 'mtb-ws-off'}`}>
          {wsConnected ? 'WS' : 'WS off'}
        </span>
      </div>

      {!panelCollapsed && (
        <>
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

              <RequirementsList checklist={activeCheck} />

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
  );
}
