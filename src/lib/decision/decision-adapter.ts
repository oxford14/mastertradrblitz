import type { AiDecision, MarketSnapshot } from '@mtb/shared';
import { mapAiDecisionToSignal } from '@mtb/shared';
import { evaluateSignal } from '../signals/signal-engine';
import { buildMarketSnapshot } from '../snapshot/market-snapshot';
import { requestAiDecision } from '../api/mtb-api-client';
import type {
  AppSettings,
  IndicatorSnapshot,
  PatternSnapshot,
  RawSignalEvaluation,
  SignalResult,
  WickSnapshot,
} from '../../types';
import type { AdxResult } from '../indicators/adx';
import type { FractalSnapshot } from '../patterns/fractal';

export interface LiveSnapshotContext {
  asset: string;
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  wick: WickSnapshot;
  adxResult: AdxResult;
  fractal: FractalSnapshot;
  prevClose?: number;
}

export function buildLiveSnapshot(
  settings: AppSettings,
  ctx: LiveSnapshotContext,
): MarketSnapshot {
  const snapshot = buildMarketSnapshot({
    asset: ctx.asset,
    expiry: settings.market.tradeExpirySec,
    indicators: ctx.indicators,
    pattern: ctx.pattern,
    wick: ctx.wick,
    adx: ctx.adxResult.adx,
    plusDi: ctx.adxResult.plusDi,
    minusDi: ctx.adxResult.minusDi,
    prevClose: ctx.prevClose,
    settings,
  });
  snapshot.fractal = ctx.fractal.bullish
    ? 'Bullish'
    : ctx.fractal.bearish
      ? 'Bearish'
      : 'None';
  return snapshot;
}

export interface AiDecisionState {
  decision: AiDecision | null;
  decisionId: string | null;
  snapshot: MarketSnapshot | null;
  error: string | null;
  loading: boolean;
}

const emptyAiState = (): AiDecisionState => ({
  decision: null,
  decisionId: null,
  snapshot: null,
  error: null,
  loading: false,
});

let cachedAiState: AiDecisionState = emptyAiState();
let pendingRequest: Promise<AiDecisionState> | null = null;
let lastSnapshotKey = '';
/** Bumped on reset so in-flight API responses are ignored after mode switch. */
let aiRequestGeneration = 0;

function snapshotKey(snapshot: MarketSnapshot): string {
  return `${snapshot.asset}:${snapshot.expiry}:${snapshot.rsi.value}:${snapshot.stochastic.cross}:${snapshot.trend}`;
}

export function getAiDecisionState(): AiDecisionState {
  return cachedAiState;
}

export function resetAiDecisionState(): void {
  aiRequestGeneration += 1;
  cachedAiState = emptyAiState();
  pendingRequest = null;
  lastSnapshotKey = '';
}

function legacyBarCloseEval(input: {
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  wick: WickSnapshot;
  settings: AppSettings;
  adxResult: AdxResult;
  fractal: FractalSnapshot;
}): { signal: 'HIGHER' | 'LOWER' | 'WAIT'; raw: RawSignalEvaluation } {
  const raw = evaluateSignal(
    input.indicators,
    input.pattern,
    input.wick,
    input.settings,
    input.adxResult,
    input.fractal,
  );
  return { signal: raw.signal, raw };
}

function buildEmptyChecklist(): RawSignalEvaluation['activeCheck'] {
  return {
    rsi: false,
    stochastic: false,
    candlePattern: false,
    bollinger: false,
    rejectionWick: false,
    movingAverageTrend: false,
  };
}

function aiDecisionToRawEval(
  decision: AiDecision,
  indicators: IndicatorSnapshot,
  pattern: PatternSnapshot,
  reason: string,
): RawSignalEvaluation {
  const signal = mapAiDecisionToSignal(decision.decision);
  const emptyScore = {
    rsi: 0,
    stochastic: 0,
    candlePattern: 0,
    bollinger: 0,
    rejectionWick: 0,
    movingAverage: 0,
    total: decision.confidence,
  };

  return {
    signal,
    tradeDirection: signal === 'WAIT' ? null : signal,
    activeCheck: buildEmptyChecklist(),
    debug: {
      rsi: indicators.rsi,
      rsiOversold: false,
      rsiOverbought: false,
      bullishCross: indicators.stochCrossUp,
      bearishCross: indicators.stochCrossDown,
      bullishCrossAgeBars: indicators.barsSinceBullishCross,
      bearishCrossAgeBars: indicators.barsSinceBearishCross,
      adx: 0,
      plusDi: 0,
      minusDi: 0,
      cci: indicators.cci,
      fractalStatus: 'None',
      pattern: pattern.pattern,
      evalDirection: signal === 'WAIT' ? null : signal,
      higherChecklist: buildEmptyChecklist(),
      lowerChecklist: buildEmptyChecklist(),
      higherConfidence: emptyScore,
      lowerConfidence: emptyScore,
      higherEnhancerFlags: {
        cci: false,
        fractal: false,
        adxStrength: false,
        diConfirmation: false,
        crossFreshness: false,
      },
      lowerEnhancerFlags: {
        cci: false,
        fractal: false,
        adxStrength: false,
        diConfirmation: false,
        crossFreshness: false,
      },
      maTrend: indicators.maTrend,
      signal,
      reason,
    },
    indicators,
    pattern,
    dualConfidence: { higher: emptyScore, lower: emptyScore },
    confidence: emptyScore,
  };
}

export async function resolveBarCloseDecision(input: {
  settings: AppSettings;
  asset: string;
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  wick: WickSnapshot;
  adxResult: AdxResult;
  fractal: FractalSnapshot;
  prevClose?: number;
}): Promise<{ signal: 'HIGHER' | 'LOWER' | 'WAIT'; raw: RawSignalEvaluation }> {
  const { settings } = input;

  if (settings.tradingMode !== 'AI') {
    return legacyBarCloseEval(input);
  }

  const requestGeneration = aiRequestGeneration;

  const snapshot = buildMarketSnapshot({
    asset: input.asset,
    expiry: settings.market.tradeExpirySec,
    indicators: input.indicators,
    pattern: input.pattern,
    wick: input.wick,
    adx: input.adxResult.adx,
    plusDi: input.adxResult.plusDi,
    minusDi: input.adxResult.minusDi,
    prevClose: input.prevClose,
    settings,
  });

  snapshot.fractal = input.fractal.bullish
    ? 'Bullish'
    : input.fractal.bearish
      ? 'Bearish'
      : 'None';

  const key = snapshotKey(snapshot);
  if (key === lastSnapshotKey && cachedAiState.decision) {
    const raw = aiDecisionToRawEval(
      cachedAiState.decision,
      input.indicators,
      input.pattern,
      cachedAiState.decision.reasoning.join('; ') || 'AI decision',
    );
    return { signal: raw.signal, raw };
  }

  if (!settings.aiBackend?.apiBaseUrl || !settings.aiBackend?.apiKey) {
    cachedAiState = {
      ...emptyAiState(),
      error: 'AI backend not configured',
      snapshot,
    };
    const raw = aiDecisionToRawEval(
      {
        decision: 'WAIT',
        confidence: 0,
        reasoning: ['AI backend URL or API key missing'],
        risks: [],
        supportingIndicators: [],
      },
      input.indicators,
      input.pattern,
      'AI backend not configured',
    );
    return { signal: 'WAIT', raw };
  }

  if (!pendingRequest) {
    cachedAiState = { ...cachedAiState, loading: true, snapshot, error: null };
    const capturedGeneration = requestGeneration;
    pendingRequest = requestAiDecision(
      {
        apiBaseUrl: settings.aiBackend.apiBaseUrl,
        apiKey: settings.aiBackend.apiKey,
      },
      snapshot,
    )
      .then((response) => {
        if (capturedGeneration !== aiRequestGeneration) {
          pendingRequest = null;
          return cachedAiState;
        }
        cachedAiState = {
          decision: response,
          decisionId: response.id ?? null,
          snapshot,
          error: null,
          loading: false,
        };
        lastSnapshotKey = key;
        pendingRequest = null;
        return cachedAiState;
      })
      .catch((err) => {
        if (capturedGeneration !== aiRequestGeneration) {
          pendingRequest = null;
          return cachedAiState;
        }
        cachedAiState = {
          decision: null,
          decisionId: null,
          snapshot,
          error: err instanceof Error ? err.message : 'AI request failed',
          loading: false,
        };
        pendingRequest = null;
        return cachedAiState;
      });
  }

  await pendingRequest;

  if (requestGeneration !== aiRequestGeneration) {
    return legacyBarCloseEval(input);
  }

  const decision =
    cachedAiState.decision ??
    ({
      decision: 'WAIT',
      confidence: 0,
      reasoning: [cachedAiState.error ?? 'AI unavailable'],
      risks: [],
      supportingIndicators: [],
    } satisfies AiDecision);

  const raw = aiDecisionToRawEval(
    decision,
    input.indicators,
    input.pattern,
    decision.reasoning.join('; ') || cachedAiState.error || 'AI decision',
  );
  return { signal: raw.signal, raw };
}

export function resolveLiveDisplayEval(input: {
  settings: AppSettings;
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  wick: WickSnapshot;
  adxResult: AdxResult;
  fractal: FractalSnapshot;
  reason?: string;
}): RawSignalEvaluation {
  if (input.settings.tradingMode !== 'AI') {
    return evaluateSignal(
      input.indicators,
      input.pattern,
      input.wick,
      input.settings,
      input.adxResult,
      input.fractal,
      input.reason,
    );
  }

  if (cachedAiState.decision) {
    return aiDecisionToRawEval(
      cachedAiState.decision,
      input.indicators,
      input.pattern,
      input.reason ?? cachedAiState.decision.reasoning.join('; '),
    );
  }

  return aiDecisionToRawEval(
    {
      decision: 'WAIT',
      confidence: 0,
      reasoning: [cachedAiState.error ?? 'Awaiting AI decision'],
      risks: [],
      supportingIndicators: [],
    },
    input.indicators,
    input.pattern,
    input.reason ?? 'Awaiting AI decision',
  );
}

export function attachAiToSignalResult(
  result: SignalResult,
  settings: AppSettings,
  liveCtx?: LiveSnapshotContext,
): SignalResult {
  if (settings.tradingMode !== 'AI') return result;
  const decision = cachedAiState.decision;
  const liveSnapshot = liveCtx ? buildLiveSnapshot(settings, liveCtx) : null;
  return {
    ...result,
    aiDecision: decision
      ? {
          decision: decision.decision,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          risks: decision.risks,
          supportingIndicators: decision.supportingIndicators,
        }
      : null,
    aiDecisionId: cachedAiState.decisionId,
    aiSnapshot: liveSnapshot ?? cachedAiState.snapshot,
    aiError: cachedAiState.error,
    aiLoading: cachedAiState.loading,
  };
}

export function shouldAutoTradeAiDecision(settings: AppSettings, confidence: number): boolean {
  if (settings.autoTradingMode === 'manual') return false;
  return confidence >= getAiAutoTradeThreshold(settings);
}

export function getAiAutoTradeThreshold(settings: AppSettings): number {
  if (settings.autoTradingMode === 'semi') {
    return settings.aiConfidenceThreshold;
  }
  if (settings.autoTradingMode === 'full') {
    return settings.aiAutoTradeThreshold;
  }
  return 100;
}

export function getAiAutoTradeGateMessage(input: {
  settings: AppSettings;
  autoTradeEnabled: boolean;
  autoTradeDryRun: boolean;
  aiDecision: SignalResult['aiDecision'];
  aiLoading?: boolean;
  autoTradeStatusMessage?: string | null;
}): string | null {
  const { settings, autoTradeEnabled, autoTradeDryRun, aiDecision, aiLoading } = input;

  if (settings.tradingMode !== 'AI') return null;
  if (!autoTradeEnabled) {
    return 'Auto is off — turn on the header toggle to allow clicks.';
  }
  if (settings.autoTradingMode === 'manual') {
    return 'Manual mode — confirm BUY/SELL in the overlay when a signal appears.';
  }

  if (aiLoading) {
    return 'Waiting for AI decision from API…';
  }
  if (!aiDecision) {
    return 'No AI decision yet — fires on each closed bar.';
  }
  if (aiDecision.decision === 'WAIT') {
    const reason = aiDecision.reasoning[0];
    return reason
      ? `AI said WAIT — ${reason}`
      : 'AI said WAIT — no BUY/SELL entry this bar.';
  }

  const threshold = getAiAutoTradeThreshold(settings);
  if (aiDecision.confidence < threshold) {
    const modeLabel = settings.autoTradingMode === 'full' ? 'full auto' : 'semi auto';
    return `${aiDecision.decision} at ${aiDecision.confidence}% is below ${modeLabel} threshold (${threshold}%).`;
  }

  if (autoTradeDryRun) {
    return `Ready — ${aiDecision.decision} ${aiDecision.confidence}% (dry run, no live click).`;
  }

  if (input.autoTradeStatusMessage) {
    return input.autoTradeStatusMessage;
  }

  return `Armed — ${aiDecision.decision} ${aiDecision.confidence}% meets ${settings.autoTradingMode} auto threshold (${threshold}%).`;
}
