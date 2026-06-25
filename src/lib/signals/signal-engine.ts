import type {
  AppSettings,
  ConfidenceScore,
  DualConfidence,
  IndicatorSnapshot,
  MaTrend,
  PatternSnapshot,
  QualityChecklist,
  RawSignalEvaluation,
  Signal,
  SignalDebug,
  TradeDirection,
  WickSnapshot,
} from '../../types';
import {
  bollingerTouchHigher,
  bollingerTouchLower,
  maTrendAlignsHigher,
  maTrendAlignsLower,
} from '../indicators/indicator-engine';
import { EMPTY_PATTERN } from '../patterns/candle-pattern-engine';
import { EMPTY_WICK } from '../patterns/rejection-wick';

export interface AdxDebug {
  adx: number;
  plusDi: number;
  minusDi: number;
}

export const CONFIDENCE_WEIGHTS = {
  rsi: 30,
  stochastic: 30,
  candlePattern: 20,
  rejectionWick: 10,
  bollinger: 10,
  movingAverage: 10,
} as const;

export const MAX_RAW_CONFIDENCE =
  CONFIDENCE_WEIGHTS.rsi +
  CONFIDENCE_WEIGHTS.stochastic +
  CONFIDENCE_WEIGHTS.candlePattern +
  CONFIDENCE_WEIGHTS.rejectionWick +
  CONFIDENCE_WEIGHTS.bollinger +
  CONFIDENCE_WEIGHTS.movingAverage;

export function displayConfidence(rawTotal: number): number {
  return Math.min(100, rawTotal);
}

const emptyAdx = (): AdxDebug => ({ adx: 0, plusDi: 0, minusDi: 0 });

function higherChecklist(
  indicators: IndicatorSnapshot,
  pattern: PatternSnapshot,
  wick: WickSnapshot,
  settings: AppSettings,
): QualityChecklist {
  return {
    rsi: indicators.rsi <= settings.rsi.oversold,
    stochastic: indicators.bullishCrossValid,
    candlePattern: pattern.bullishEngulfing,
    bollinger: bollingerTouchHigher(indicators, settings),
    rejectionWick: wick.bullishRejection,
    movingAverageTrend: maTrendAlignsHigher(indicators),
  };
}

function lowerChecklist(
  indicators: IndicatorSnapshot,
  pattern: PatternSnapshot,
  wick: WickSnapshot,
  settings: AppSettings,
): QualityChecklist {
  return {
    rsi: indicators.rsi >= settings.rsi.overbought,
    stochastic: indicators.bearishCrossValid,
    candlePattern: pattern.bearishEngulfing,
    bollinger: bollingerTouchLower(indicators, settings),
    rejectionWick: wick.bearishRejection,
    movingAverageTrend: maTrendAlignsLower(indicators),
  };
}

function computeConfidence(
  direction: 'HIGHER' | 'LOWER',
  check: QualityChecklist,
  pattern: PatternSnapshot,
): ConfidenceScore {
  const rsi = check.rsi ? CONFIDENCE_WEIGHTS.rsi : 0;
  const stochastic = check.stochastic ? CONFIDENCE_WEIGHTS.stochastic : 0;
  const candlePattern =
    direction === 'HIGHER'
      ? pattern.bullishEngulfing
        ? CONFIDENCE_WEIGHTS.candlePattern
        : 0
      : pattern.bearishEngulfing
        ? CONFIDENCE_WEIGHTS.candlePattern
        : 0;
  const bollinger = check.bollinger ? CONFIDENCE_WEIGHTS.bollinger : 0;
  const rejectionWick = check.rejectionWick ? CONFIDENCE_WEIGHTS.rejectionWick : 0;
  const movingAverage = check.movingAverageTrend
    ? CONFIDENCE_WEIGHTS.movingAverage
    : 0;

  return {
    rsi,
    stochastic,
    candlePattern,
    bollinger,
    rejectionWick,
    movingAverage,
    total:
      rsi +
      stochastic +
      candlePattern +
      bollinger +
      rejectionWick +
      movingAverage,
  };
}

function computeDualConfidence(
  higher: QualityChecklist,
  lower: QualityChecklist,
  pattern: PatternSnapshot,
): DualConfidence {
  return {
    higher: computeConfidence('HIGHER', higher, pattern),
    lower: computeConfidence('LOWER', lower, pattern),
  };
}

export function resolveSignal(
  higherTotal: number,
  lowerTotal: number,
  settings: AppSettings,
): { signal: Signal; reason?: string } {
  const minConf = settings.market.minimumSignalConfidence;
  const minEdge = settings.market.minimumSignalEdge;
  const higherMeets = higherTotal >= minConf;
  const lowerMeets = lowerTotal >= minConf;

  if (higherMeets && lowerMeets) {
    const edge = Math.abs(higherTotal - lowerTotal);
    if (edge < minEdge) {
      return { signal: 'WAIT', reason: 'Conflicting evidence' };
    }
    if (higherTotal > lowerTotal) return { signal: 'HIGHER' };
    if (lowerTotal > higherTotal) return { signal: 'LOWER' };
    return { signal: 'WAIT', reason: 'Conflicting evidence' };
  }
  if (higherMeets) return { signal: 'HIGHER' };
  if (lowerMeets) return { signal: 'LOWER' };
  return { signal: 'WAIT', reason: 'No side above threshold' };
}

function pickDominantDirection(
  higherTotal: number,
  lowerTotal: number,
  indicators: IndicatorSnapshot,
  settings: AppSettings,
): TradeDirection {
  if (higherTotal > lowerTotal) return 'HIGHER';
  if (lowerTotal > higherTotal) return 'LOWER';

  if (indicators.rsi <= settings.rsi.oversold || indicators.bullishCrossValid) {
    return 'HIGHER';
  }
  if (indicators.rsi >= settings.rsi.overbought || indicators.bearishCrossValid) {
    return 'LOWER';
  }
  return null;
}

function winningConfidence(
  signal: Signal,
  dual: DualConfidence,
): ConfidenceScore {
  if (signal === 'HIGHER') return dual.higher;
  if (signal === 'LOWER') return dual.lower;
  const h = dual.higher.total;
  const l = dual.lower.total;
  return h >= l ? dual.higher : dual.lower;
}

function activeCheckFor(
  signal: Signal,
  higher: QualityChecklist,
  lower: QualityChecklist,
  dual: DualConfidence,
): QualityChecklist {
  if (signal === 'HIGHER') return higher;
  if (signal === 'LOWER') return lower;
  return dual.higher.total >= dual.lower.total ? higher : lower;
}

export function buildSignalDebug(
  indicators: IndicatorSnapshot,
  pattern: PatternSnapshot,
  wick: WickSnapshot,
  settings: AppSettings,
  signal: Signal,
  adxDebug: AdxDebug = emptyAdx(),
  extraReason?: string,
): SignalDebug {
  const higher = higherChecklist(indicators, pattern, wick, settings);
  const lower = lowerChecklist(indicators, pattern, wick, settings);
  const dual = computeDualConfidence(higher, lower, pattern);
  const evalDirection = pickDominantDirection(
    dual.higher.total,
    dual.lower.total,
    indicators,
    settings,
  );

  const rsiOversold = indicators.rsi <= settings.rsi.oversold;
  const rsiOverbought = indicators.rsi >= settings.rsi.overbought;

  let reason = extraReason ?? '';

  if (!reason) {
    if (!indicators.warmedUp) {
      reason = `Warming up (${indicators.warmupCurrent}/${indicators.warmupRequired} bars)`;
    } else if (signal === 'HIGHER') {
      reason = `HIGHER ${displayConfidence(dual.higher.total)}% ≥ ${settings.market.minimumSignalConfidence}% threshold`;
    } else if (signal === 'LOWER') {
      reason = `LOWER ${displayConfidence(dual.lower.total)}% ≥ ${settings.market.minimumSignalConfidence}% threshold`;
    } else {
      const resolved = resolveSignal(
        dual.higher.total,
        dual.lower.total,
        settings,
      );
      reason = resolved.reason ?? 'No side above threshold';
    }
  }

  return {
    rsi: indicators.rsi,
    rsiOversold,
    rsiOverbought,
    bullishCross: indicators.bullishCrossValid,
    bearishCross: indicators.bearishCrossValid,
    bullishCrossAgeBars: indicators.barsSinceBullishCross,
    bearishCrossAgeBars: indicators.barsSinceBearishCross,
    adx: adxDebug.adx,
    plusDi: adxDebug.plusDi,
    minusDi: adxDebug.minusDi,
    pattern: pattern.pattern,
    evalDirection,
    higherChecklist: higher,
    lowerChecklist: lower,
    higherConfidence: dual.higher,
    lowerConfidence: dual.lower,
    maTrend: indicators.maTrend,
    signal,
    reason,
  };
}

export function evaluateSignal(
  indicators: IndicatorSnapshot,
  pattern: PatternSnapshot,
  wick: WickSnapshot,
  settings: AppSettings,
  adxDebug: AdxDebug = emptyAdx(),
  extraReason?: string,
): RawSignalEvaluation {
  const higher = higherChecklist(indicators, pattern, wick, settings);
  const lower = lowerChecklist(indicators, pattern, wick, settings);
  const dual = computeDualConfidence(higher, lower, pattern);

  let signal: Signal = 'WAIT';
  let tradeDirection: TradeDirection = null;

  if (indicators.warmedUp) {
    const resolved = resolveSignal(
      dual.higher.total,
      dual.lower.total,
      settings,
    );
    signal = resolved.signal;
    tradeDirection =
      signal !== 'WAIT'
        ? signal
        : pickDominantDirection(
            dual.higher.total,
            dual.lower.total,
            indicators,
            settings,
          );
  }

  const activeCheck = activeCheckFor(signal, higher, lower, dual);
  const debug = buildSignalDebug(
    indicators,
    pattern,
    wick,
    settings,
    signal,
    adxDebug,
    extraReason,
  );

  return {
    signal,
    tradeDirection,
    activeCheck,
    debug,
    indicators,
    pattern,
    dualConfidence: dual,
    confidence: winningConfidence(signal, dual),
  };
}

export { EMPTY_PATTERN, EMPTY_WICK };

export function maTrendLabel(trend: MaTrend): string {
  if (trend === 'up') return '✓ Trend Up';
  if (trend === 'down') return '✓ Trend Down';
  return '✕ Neutral';
}
