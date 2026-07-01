import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type {
  EnhancerFlags,
  MaTrend,
  QualityChecklist,
  SignalDebug,
  SignalResult,
} from '../../../types';
import { getExnovaGuide, isTradeExpirySec } from '../../../lib/settings/presets';
import { displayConfidence, maTrendLabel } from '../../../lib/signals/signal-engine';
import { ExnovaGuideCard } from '../../../options/ExnovaGuideCard';

const CORE_REQUIREMENT_ROWS: {
  key: keyof QualityChecklist;
  label: string;
  labelClass?: string;
}[] = [
  { key: 'rsi', label: 'RSI Extreme', labelClass: 'mtb-req-label-rsi' },
  { key: 'stochastic', label: 'Stochastic Cross' },
  { key: 'candlePattern', label: 'Candle Pattern' },
];

const BOOSTER_CHECKLIST_ROWS: {
  key: keyof QualityChecklist;
  label: string;
}[] = [
  { key: 'bollinger', label: 'Bollinger Touch' },
  { key: 'rejectionWick', label: 'Rejection Wick' },
];

const BOOSTER_FLAG_ROWS: {
  key: keyof EnhancerFlags;
  label: string;
}[] = [
  { key: 'cci', label: 'CCI' },
  { key: 'fractal', label: 'Fractal' },
  { key: 'adxStrength', label: 'ADX Strength' },
  { key: 'diConfirmation', label: 'DI Trend' },
  { key: 'crossFreshness', label: 'Cross Freshness' },
];

function activeEnhancerFlags(debug: SignalDebug, signal: string): EnhancerFlags {
  if (signal === 'HIGHER') return debug.higherEnhancerFlags;
  if (signal === 'LOWER') return debug.lowerEnhancerFlags;
  return debug.higherConfidence.total >= debug.lowerConfidence.total
    ? debug.higherEnhancerFlags
    : debug.lowerEnhancerFlags;
}

function RequirementsList({
  checklist,
  maTrend,
  enhancerFlags,
}: {
  checklist: QualityChecklist;
  maTrend: MaTrend;
  enhancerFlags: EnhancerFlags;
}) {
  const trendClass = maTrend === 'neutral' ? 'mtb-fail' : 'mtb-ok';

  return (
    <div className="mtb-requirements">
      <div className="mtb-req-group">
        <div className="mtb-req-group-title">Core Signals</div>
        {CORE_REQUIREMENT_ROWS.map(({ key, label, labelClass }) => (
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

      <div className="mtb-req-group mtb-req-group-boosters">
        <div className="mtb-req-group-title">Confidence Boosters</div>
        <div className="mtb-req-booster-grid">
          {BOOSTER_CHECKLIST_ROWS.map(({ key, label }) => (
            <div key={key} className="mtb-req-item">
              <span>{label}</span>
              <span className={checklist[key] ? 'mtb-ok' : 'mtb-fail'}>
                {checklist[key] ? '✓' : '✕'}
              </span>
            </div>
          ))}
          {BOOSTER_FLAG_ROWS.map(({ key, label }) => (
            <div key={key} className="mtb-req-item">
              <span>{label}</span>
              <span className={enhancerFlags[key] ? 'mtb-ok' : 'mtb-fail'}>
                {enhancerFlags[key] ? '✓' : '✕'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatScoreBreakdown(
  label: string,
  c: SignalDebug['higherConfidence'],
): string {
  const core = `${label}: RSI ${c.rsi} + Stoch ${c.stochastic} + Pattern ${c.candlePattern} + BB ${c.bollinger} + Wick ${c.rejectionWick} + MA ${c.movingAverage}`;
  const enhParts: string[] = [];
  if (c.cci) enhParts.push(`CCI ${c.cci}`);
  if (c.fractal) enhParts.push(`Fractal ${c.fractal}`);
  if (c.adxStrength) enhParts.push(`ADX ${c.adxStrength}`);
  if (c.diConfirmation) enhParts.push(`DI ${c.diConfirmation}`);
  if (c.crossFreshness) enhParts.push(`Cross ${c.crossFreshness}`);
  if (enhParts.length === 0) return core;
  return `${core} + ${enhParts.join(' + ')}`;
}

function AdvancedPanelContent({
  debug,
  ind,
  signal,
  guide,
}: {
  debug: SignalDebug;
  ind: NonNullable<SignalResult['indicators']>;
  signal: string;
  guide: ReturnType<typeof getExnovaGuide>;
}) {
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
        <span>CCI</span>
        <span>{debug.cci === null ? '—' : debug.cci.toFixed(1)}</span>
      </div>
      <div className="mtb-advanced-row">
        <span>Fractal</span>
        <span>{debug.fractalStatus}</span>
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

interface LegacySignalPanelProps {
  result: SignalResult;
  tradeExpirySec: number;
  autoTradeLine: string | null;
  autoTradeError: boolean;
}

export function LegacySignalPanel({
  result,
  tradeExpirySec,
  autoTradeLine,
  autoTradeError,
}: LegacySignalPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const signal = result.signal ?? 'WAIT';
  const confirming = result.confirming ?? false;
  const holdRemaining = result.holdSecondsRemaining ?? 0;
  const pendingSignal = result.rawSignal ?? 'WAIT';
  const ind = result.indicators;
  const pattern = result.pattern;
  const dualConfidence = result.dualConfidence;
  const higherPct = displayConfidence(dualConfidence?.higher.total ?? 0);
  const lowerPct = displayConfidence(dualConfidence?.lower.total ?? 0);
  const activeCheck = result.activeCheck ?? {
    rsi: false,
    stochastic: false,
    candlePattern: false,
    bollinger: false,
    rejectionWick: false,
    movingAverageTrend: false,
  };
  const debug = result.debug;
  const maTrend = ind?.maTrend ?? debug?.maTrend ?? 'neutral';
  const guide = getExnovaGuide(
    isTradeExpirySec(tradeExpirySec) ? tradeExpirySec : 5,
  );

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
    !confirming && signal === 'WAIT' && debug?.reason ? debug.reason : null;

  return (
    <>
      <div className={`mtb-signal-hero ${signalClass}`}>{signalLabel}</div>

      {confirming && pendingSignal !== 'WAIT' && (
        <div className="mtb-confirming">
          Confirming {pendingSignal} — {holdRemaining}s
        </div>
      )}

      {waitSubtitle && <div className="mtb-wait-subtitle">{waitSubtitle}</div>}

      {autoTradeLine && (
        <div className={`mtb-auto-trade ${autoTradeError ? 'mtb-auto-trade-error' : ''}`}>
          Auto: {autoTradeLine}
        </div>
      )}

      {isPremium && <div className="mtb-premium-badge">Premium Setup</div>}

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

          <RequirementsList
            checklist={activeCheck}
            maTrend={maTrend}
            enhancerFlags={
              debug
                ? activeEnhancerFlags(debug, signal)
                : {
                    cci: false,
                    fractal: false,
                    adxStrength: false,
                    diConfirmation: false,
                    crossFreshness: false,
                  }
            }
          />

          {pattern && pattern.pattern !== 'None' && (
            <div className="mtb-pattern-block">
              <div className="mtb-pattern-label">Pattern</div>
              <div className="mtb-pattern-name">{pattern.pattern}</div>
            </div>
          )}

          {debug && (
            <Collapsible.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <Collapsible.Trigger className="mtb-radix-collapsible-trigger mtb-advanced-toggle">
                <span>Advanced</span>
                <ChevronDown
                  className={`mtb-radix-collapsible-chevron${advancedOpen ? ' mtb-radix-collapsible-chevron-open' : ''}`}
                  size={14}
                  aria-hidden
                />
              </Collapsible.Trigger>
              <Collapsible.Content className="mtb-radix-collapsible-content">
                <AdvancedPanelContent
                  debug={debug}
                  ind={ind}
                  signal={signalLabel}
                  guide={guide}
                />
              </Collapsible.Content>
            </Collapsible.Root>
          )}
        </>
      )}
    </>
  );
}
