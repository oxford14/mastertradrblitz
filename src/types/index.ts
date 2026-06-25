export interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Candle extends OHLC {
  timestamp: number;
  symbol: string;
  intervalSec: number;
}

export type MarketEvent =
  | { type: 'tick'; symbol: string; price: number; ts: number }
  | {
      type: 'candle';
      symbol: string;
      intervalSec: number;
      ohlc: OHLC;
      ts: number;
      isClosed: boolean;
    };

export interface RsiSettings {
  period: number;
  overbought: number;
  oversold: number;
  requireExtreme: boolean;
}

export type MaType = 'ema' | 'sma';

export type MaTrend = 'up' | 'down' | 'neutral';

export interface MovingAverageSettings {
  fastPeriod: number;
  slowPeriod: number;
  type: MaType;
}

export interface StochasticSettings {
  kPeriod: number;
  dPeriod: number;
  smoothing: number;
  overbought: number;
  oversold: number;
  crossValidityBars: number;
}

export interface AdxSettings {
  period: number;
  threshold: number;
}

export interface BollingerSettings {
  period: number;
  deviation: number;
  bandProximityPct: number;
}

export type TradeExpirySec = 5 | 10 | 15 | 30;

export type MinimumSignalConfidence = 50 | 60 | 70 | 80 | 90;

export type MinimumSignalEdge = 3 | 5 | 10;

export interface MarketSettings {
  tradeExpirySec: TradeExpirySec;
  candleIntervalSec: number;
  signalHoldSec: number;
  signalCooldownSec: number;
  signalDebugMode: boolean;
  minimumSignalConfidence: MinimumSignalConfidence;
  minimumSignalEdge: MinimumSignalEdge;
}

export interface AutoTradeCanvasSettings {
  higherXPercent: number;
  higherYPercent: number;
  lowerXPercent: number;
  lowerYPercent: number;
}

export type AutoTradeClickEngine = 'native';

export interface AutoTradeSettings {
  enabled: boolean;
  dryRun: boolean;
  useCanvas: boolean;
  clickEngine: AutoTradeClickEngine;
  canvas: AutoTradeCanvasSettings;
}

export type ProgressionProfileId =
  | 'D50'
  | 'D100'
  | 'D200'
  | 'D300'
  | 'D500'
  | 'D1000'
  | 'AD50'
  | 'AD100'
  | 'AD200'
  | 'AD300'
  | 'AD500'
  | 'AD1000'
  | 'Custom';

export type ProgressionMaxLevel = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface AmountFieldCalibration {
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  width: number;
  height: number;
  calibratedAt: number;
}

export type AmountEntryMode = 'hybrid' | 'keypad';

export interface ProgressionSettings {
  enabled: boolean;
  profileId: ProgressionProfileId;
  customLevels: number[];
  maxLevel: ProgressionMaxLevel;
  resetOnWin: boolean;
  advanceOnLoss: boolean;
  amountField: AmountFieldCalibration | null;
  amountEntryMode: AmountEntryMode;
}

export interface ProgressionStateData {
  currentLevel: number;
  stopped: boolean;
  lastAppliedStake: number;
  lastWarning: string | null;
}

export interface ProgressionSnapshot {
  profileId: ProgressionProfileId;
  level: number;
  stake: number;
  stopped: boolean;
  lastWarning: string | null;
}

export interface ProbeResult {
  higher: boolean;
  lower: boolean;
  canvasFound: boolean;
  method: 'dom' | 'canvas' | 'none';
  message: string;
}

export type AutoTradeAction = 'none' | 'clicked' | 'dry_run' | 'skipped' | 'error';

export interface ExnovaGuide {
  tradeExpirySec: number;
  recommendedChartType: 'line' | 'candlestick' | 'bars';
  avoidChartTypes: string[];
  exnovaCandlePeriod: string;
  exnovaVisibleWindow: string;
  exnovaTradeExpiry: string;
  notes: string[];
}

export interface AppSettings {
  rsi: RsiSettings;
  stochastic: StochasticSettings;
  adx: AdxSettings;
  bollinger: BollingerSettings;
  movingAverage: MovingAverageSettings;
  market: MarketSettings;
  autoTrade: AutoTradeSettings;
  progression: ProgressionSettings;
  devLogWs: boolean;
}

export type Signal = 'HIGHER' | 'LOWER' | 'WAIT';

export type TradeDirection = 'HIGHER' | 'LOWER' | null;

export interface AutoTradeStatus {
  action: AutoTradeAction;
  signal: Signal;
  message: string;
  at: number;
}

export type TradeOutcome = 'win' | 'loss';

export interface TradeCloseEvent {
  id: string;
  profit: number;
  outcome: TradeOutcome;
  closedAt: number;
  direction: TradeDirection;
  instrumentType?: string;
}

export interface PendingAutoTrade {
  placedAt: number;
  signal: 'HIGHER' | 'LOWER';
  expirySec: number;
}

export interface AutoTradeStatsSnapshot {
  wins: number;
  losses: number;
  pendingCount: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export interface AutoTradeStatsData {
  wins: number;
  losses: number;
  pending: PendingAutoTrade[];
  seenCloseIds: string[];
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export type CandlePatternName =
  | 'Bullish Engulfing'
  | 'Bearish Engulfing'
  | 'None';

export interface PatternSnapshot {
  pattern: CandlePatternName;
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
}

export interface WickSnapshot {
  bullishRejection: boolean;
  bearishRejection: boolean;
}

export interface ConfidenceScore {
  rsi: number;
  stochastic: number;
  candlePattern: number;
  bollinger: number;
  rejectionWick: number;
  movingAverage: number;
  /** Raw sum (may exceed 100); use displayConfidence for UI */
  total: number;
}

export interface QualityChecklist {
  rsi: boolean;
  stochastic: boolean;
  candlePattern: boolean;
  bollinger: boolean;
  rejectionWick: boolean;
  movingAverageTrend: boolean;
}

export interface DualConfidence {
  higher: ConfidenceScore;
  lower: ConfidenceScore;
}

export interface SignalDebug {
  rsi: number;
  rsiOversold: boolean;
  rsiOverbought: boolean;
  bullishCross: boolean;
  bearishCross: boolean;
  bullishCrossAgeBars: number | null;
  bearishCrossAgeBars: number | null;
  adx: number;
  plusDi: number;
  minusDi: number;
  pattern: CandlePatternName;
  evalDirection: TradeDirection;
  higherChecklist: QualityChecklist;
  lowerChecklist: QualityChecklist;
  higherConfidence: ConfidenceScore;
  lowerConfidence: ConfidenceScore;
  maTrend: MaTrend;
  signal: Signal;
  reason: string;
}

export interface IndicatorSnapshot {
  rsi: number;
  stochK: number;
  stochD: number;
  price: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  stochCrossUp: boolean;
  stochCrossDown: boolean;
  crossUpOnThisBar: boolean;
  crossDownOnThisBar: boolean;
  bullishCrossValid: boolean;
  bearishCrossValid: boolean;
  barsSinceBullishCross: number | null;
  barsSinceBearishCross: number | null;
  warmedUp: boolean;
  warmupRequired: number;
  warmupCurrent: number;
  maFast: number;
  maSlow: number;
  maTrend: MaTrend;
}

export interface RawSignalEvaluation {
  signal: Signal;
  tradeDirection: TradeDirection;
  activeCheck: QualityChecklist;
  debug: SignalDebug;
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  dualConfidence: DualConfidence;
  confidence: ConfidenceScore;
}

export interface SignalResult {
  signal: Signal;
  rawSignal: Signal;
  confirming: boolean;
  holdSecondsRemaining: number;
  tradeDirection: TradeDirection;
  activeCheck: QualityChecklist;
  debug: SignalDebug;
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  dualConfidence: DualConfidence;
  confidence: ConfidenceScore;
  signalDebugMode: boolean;
  crossValidityBars: number;
}

export interface WsBridgeMessage {
  source: 'mtb-ws';
  url: string;
  data: string | ArrayBuffer;
}
