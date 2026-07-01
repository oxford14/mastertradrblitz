import { z } from 'zod';

export type TradingMode = 'LEGACY' | 'AI';
export type AutoTradingMode = 'manual' | 'semi' | 'full';
export type AiTradeDecision = 'BUY' | 'SELL' | 'WAIT';
export type TradeOutcome = 'win' | 'loss';
export type TradeDirection = 'HIGHER' | 'LOWER';

export const RsiStateSchema = z.enum(['OVERSOLD', 'NEUTRAL', 'OVERBOUGHT']);
export const StochCrossSchema = z.enum(['BULLISH', 'BEARISH', 'NONE']);
export const TrendSchema = z.enum(['UP', 'DOWN', 'NEUTRAL']);
export const AdxStrengthSchema = z.enum(['WEAK', 'MODERATE', 'STRONG']);
export const BollingerPositionSchema = z.enum(['LOWER_BAND', 'MIDDLE', 'UPPER_BAND']);
export const MacdCrossSchema = z.enum(['BULLISH', 'BEARISH', 'NONE']);
export const MacdHistogramSchema = z.enum(['RISING', 'FALLING', 'FLAT']);

export const MarketSnapshotSchema = z.object({
  asset: z.string().min(1),
  expiry: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)]),
  rsi: z.object({
    value: z.number(),
    state: RsiStateSchema,
  }),
  macd: z.object({
    cross: MacdCrossSchema,
    histogram: MacdHistogramSchema,
  }),
  adx: z.object({
    value: z.number(),
    strength: AdxStrengthSchema,
  }),
  stochastic: z.object({
    cross: StochCrossSchema,
  }),
  bollinger: z.object({
    position: BollingerPositionSchema,
  }),
  trend: TrendSchema,
  candlePattern: z.string().optional(),
  rejectionWick: z.boolean().optional(),
  fractal: z.enum(['Bullish', 'Bearish', 'None']).optional(),
  cci: z.number().nullable().optional(),
});

export type MarketSnapshot = z.infer<typeof MarketSnapshotSchema>;

export const AiDecisionSchema = z.object({
  decision: z.enum(['BUY', 'SELL', 'WAIT']),
  confidence: z.number().min(0).max(100),
  reasoning: z.array(z.string()),
  risks: z.array(z.string()),
  supportingIndicators: z.array(z.string()).optional().default([]),
});

export type AiDecision = z.infer<typeof AiDecisionSchema>;

export const AiSettingsSchema = z.object({
  openrouterApiKey: z.string().optional(),
  model: z.string().default('google/gemini-3.5-flash'),
  confidenceThreshold: z.number().min(0).max(100).default(70),
  autoTradeThreshold: z.number().min(0).max(100).default(85),
  maxLossStreak: z.number().min(1).max(50).default(5),
  cooldownBetweenTradesSec: z.number().min(0).max(300).default(5),
  allowedAssets: z.array(z.string()).default([]),
  allowedExpiry: z.array(z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)])).default([5, 10, 15, 30]),
});

export type AiSettings = z.infer<typeof AiSettingsSchema>;

export interface IndicatorPerformanceRow {
  dimension: string;
  segment: string;
  wins: number;
  losses: number;
  winRate: number;
  sampleSize: number;
  updatedAt: string;
}

export interface IndicatorPerformanceContext {
  rows: IndicatorPerformanceRow[];
  summary: string[];
}

export interface TradeHistoryRecord {
  id: string;
  asset: string;
  timestamp: string;
  expiry: number;
  indicators: MarketSnapshot;
  aiDecision: AiTradeDecision;
  confidence: number;
  reasoning: string[];
  risks: string[];
  result: TradeOutcome | null;
  pnl: number | null;
  streak: number | null;
  direction: TradeDirection | null;
  mode: TradingMode;
  strategyId: string | null;
}

export interface AiDecisionLog {
  id: string;
  asset: string;
  timestamp: string;
  expiry: number;
  snapshot: MarketSnapshot;
  decision: AiTradeDecision;
  confidence: number;
  reasoning: string[];
  risks: string[];
  supportingIndicators: string[];
  tradeId: string | null;
  result: TradeOutcome | null;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  profileId: string;
  expirySec: number;
  presetConfig: Record<string, unknown>;
  progressionLevels: number[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  todayWinRate: number;
  todayPnl: number;
  currentStreak: number;
  aiAccuracy: number;
  bestAsset: string | null;
  worstAsset: string | null;
  tradesToday: number;
}

export function mapAiDecisionToSignal(decision: AiTradeDecision): 'HIGHER' | 'LOWER' | 'WAIT' {
  if (decision === 'BUY') return 'HIGHER';
  if (decision === 'SELL') return 'LOWER';
  return 'WAIT';
}

export function mapSignalToAiDecision(signal: 'HIGHER' | 'LOWER' | 'WAIT'): AiTradeDecision {
  if (signal === 'HIGHER') return 'BUY';
  if (signal === 'LOWER') return 'SELL';
  return 'WAIT';
}

export {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_CUSTOM,
  OPENROUTER_MODEL_PRESETS,
  isKnownOpenRouterPreset,
  normalizeOpenRouterModel,
  resolveModelSelectValue,
  type OpenRouterModelPreset,
} from './openrouter-models';
