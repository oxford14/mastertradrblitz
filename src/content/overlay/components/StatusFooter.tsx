import type { AutoTradeStatsSnapshot, IndicatorSnapshot } from '../../../types';

interface StatusFooterProps {
  autoTradeStats: AutoTradeStatsSnapshot;
  symbol: string;
  tradeExpirySec: number;
  indicators: IndicatorSnapshot | undefined;
  candleCount: number;
  autoTradingMode?: string;
  aiAutoTradeThreshold?: number;
  isAiMode?: boolean;
  aiBackendConfigured?: boolean;
}

export function StatusFooter({
  autoTradeStats,
  symbol,
  tradeExpirySec,
  indicators,
  candleCount,
  autoTradingMode,
  aiAutoTradeThreshold,
  isAiMode,
  aiBackendConfigured,
}: StatusFooterProps) {
  const wlTitle = `Auto-trade session wins/losses · Best win streak ${autoTradeStats.longestWinStreak} · Best loss streak ${autoTradeStats.longestLossStreak}`;

  const wlDisplay = (
    <>
      W/L{' '}
      <span className="mtb-wl-wins">{autoTradeStats.wins}</span>/
      <span className="mtb-wl-losses">{autoTradeStats.losses}</span>
      {(autoTradeStats.longestWinStreak > 0 || autoTradeStats.longestLossStreak > 0) && (
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

  return (
    <>
      {isAiMode && aiBackendConfigured && (
        <div className="mtb-openrouter-live-line">
          OpenRouter: live decisions active (API key — bills as &quot;Master Trader Blitz
          API&quot;). Switch to LEGACY in Options to stop.
        </div>
      )}
      {isAiMode && autoTradingMode && (
        <div className="mtb-ai-mode-line">
          Mode: AI · {autoTradingMode}
          {autoTradingMode !== 'manual' && aiAutoTradeThreshold != null && (
            <span className="mtb-ai-threshold-hint">
              {' '}
              · auto at ≥{aiAutoTradeThreshold}%
            </span>
          )}
        </div>
      )}
      <div className="mtb-status">
        <span className="mtb-wl" title={wlTitle}>
          {wlDisplay}
        </span>
        <span title="active_id">{symbol}</span>
        <span>{tradeExpirySec}s</span>
        <span>
          {indicators
            ? `${indicators.warmupCurrent}/${indicators.warmupRequired} warmup`
            : `${candleCount} bars`}
        </span>
      </div>
    </>
  );
}
