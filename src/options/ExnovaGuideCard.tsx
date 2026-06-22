import type { ExnovaGuide } from '../types';

interface ExnovaGuideCardProps {
  guide: ExnovaGuide;
  compact?: boolean;
}

const CHART_LABELS: Record<ExnovaGuide['recommendedChartType'], string> = {
  line: 'Line chart',
  candlestick: 'Candlestick',
  bars: 'Bars',
};

export function ExnovaGuideCard({ guide, compact = false }: ExnovaGuideCardProps) {
  if (compact) {
    return (
      <div className="mtb-exnova-compact">
        Exnova: {CHART_LABELS[guide.recommendedChartType]} · {guide.exnovaTradeExpiry}
      </div>
    );
  }

  return (
    <div className="opt-guide-card">
      <h3>Recommended Exnova setup</h3>
      <dl className="opt-guide-list">
        <div>
          <dt>Chart type</dt>
          <dd>{CHART_LABELS[guide.recommendedChartType]} (or candlestick/bars)</dd>
        </div>
        <div>
          <dt>Candle period</dt>
          <dd>{guide.exnovaCandlePeriod}</dd>
        </div>
        <div>
          <dt>Visible window</dt>
          <dd>{guide.exnovaVisibleWindow}</dd>
        </div>
        <div>
          <dt>Trade expiry</dt>
          <dd>{guide.exnovaTradeExpiry}</dd>
        </div>
      </dl>
      {guide.avoidChartTypes.length > 0 && (
        <p className="opt-guide-warn">
          Avoid: {guide.avoidChartTypes.join(', ')} — will not match extension
          calculations.
        </p>
      )}
      <ul className="opt-guide-notes">
        {guide.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
