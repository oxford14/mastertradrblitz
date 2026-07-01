import type { MarketSnapshot } from '@mtb/shared';

interface MarketEvidencePanelProps {
  snapshot: MarketSnapshot | null | undefined;
}

function badgeClass(kind: 'positive' | 'negative' | 'neutral' | 'warn'): string {
  return `mtb-badge mtb-badge-${kind}`;
}

function rsiBadge(state: MarketSnapshot['rsi']['state']): string {
  if (state === 'OVERSOLD') return badgeClass('positive');
  if (state === 'OVERBOUGHT') return badgeClass('negative');
  return badgeClass('neutral');
}

function crossBadge(cross: string): string {
  if (cross === 'BULLISH') return badgeClass('positive');
  if (cross === 'BEARISH') return badgeClass('negative');
  return badgeClass('neutral');
}

function trendBadge(trend: MarketSnapshot['trend']): string {
  if (trend === 'UP') return badgeClass('positive');
  if (trend === 'DOWN') return badgeClass('negative');
  return badgeClass('neutral');
}

function strengthBadge(strength: MarketSnapshot['adx']['strength']): string {
  if (strength === 'STRONG') return badgeClass('positive');
  if (strength === 'MODERATE') return badgeClass('warn');
  return badgeClass('neutral');
}

export function MarketEvidencePanel({ snapshot }: MarketEvidencePanelProps) {
  if (!snapshot) {
    return (
      <div className="mtb-evidence-panel">
        <div className="mtb-evidence-title">Market Evidence</div>
        <p className="mtb-evidence-empty">Waiting for indicator data…</p>
      </div>
    );
  }

  const macdLabel = `${snapshot.macd.cross} / ${snapshot.macd.histogram}`;
  const hasPattern = Boolean(snapshot.candlePattern);
  const hasRejectionWick = Boolean(snapshot.rejectionWick);
  const hasFractal = Boolean(snapshot.fractal && snapshot.fractal !== 'None');
  const hasCci = snapshot.cci != null;

  return (
    <div className="mtb-evidence-panel">
      <div className="mtb-evidence-title">Market Evidence</div>
      <div className="mtb-evidence-grid">
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label mtb-req-label-rsi">RSI</span>
          <span className="mtb-evidence-value">{snapshot.rsi.value}</span>
          <span className={rsiBadge(snapshot.rsi.state)}>{snapshot.rsi.state}</span>
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">Stochastic</span>
          <span className={crossBadge(snapshot.stochastic.cross)}>
            {snapshot.stochastic.cross}
          </span>
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">MACD</span>
          <span className={crossBadge(snapshot.macd.cross)}>{macdLabel}</span>
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label mtb-adv-adx">ADX</span>
          <span className="mtb-evidence-value">{snapshot.adx.value}</span>
          <span className={strengthBadge(snapshot.adx.strength)}>
            {snapshot.adx.strength}
          </span>
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">Bollinger</span>
          <span className={badgeClass('neutral')}>{snapshot.bollinger.position}</span>
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">Trend</span>
          <span className={trendBadge(snapshot.trend)}>{snapshot.trend}</span>
        </div>
        <div className="mtb-evidence-item mtb-evidence-item-wide">
          <span className="mtb-evidence-label">Pattern</span>
          {hasPattern ? (
            <span className={badgeClass('warn')}>{snapshot.candlePattern}</span>
          ) : (
            <span className="mtb-evidence-value mtb-evidence-muted">—</span>
          )}
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">Rejection Wick</span>
          {hasRejectionWick ? (
            <span className={badgeClass('warn')}>Yes</span>
          ) : (
            <span className="mtb-evidence-value mtb-evidence-muted">—</span>
          )}
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">Fractal</span>
          {hasFractal ? (
            <span className={crossBadge(snapshot.fractal === 'Bullish' ? 'BULLISH' : 'BEARISH')}>
              {snapshot.fractal}
            </span>
          ) : (
            <span className="mtb-evidence-value mtb-evidence-muted">—</span>
          )}
        </div>
        <div className="mtb-evidence-item">
          <span className="mtb-evidence-label">CCI</span>
          {hasCci ? (
            <span className="mtb-evidence-value">{snapshot.cci!.toFixed(1)}</span>
          ) : (
            <span className="mtb-evidence-value mtb-evidence-muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
