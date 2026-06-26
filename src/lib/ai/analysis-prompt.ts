import type { TradeRecord } from '../../types';
import { summarizeEntryForPrompt } from './trade-snapshot';

const SYSTEM_PROMPT = `You are an expert binary-options trade analyst for a rule-based signal engine (RSI, Stochastic, Bollinger, MA trend, ADX).

Analyze ONE closed auto-trade. The engine uses checklist scoring and threshold settings — you do NOT rewrite code.

Respond with ONLY valid JSON (no markdown fences) matching this schema:
{
  "verdict": "good_entry" | "bad_entry" | "marginal" | "unclear",
  "summary": "1-2 sentence explanation of why it won or lost",
  "lessons": ["short lesson strings"],
  "settingsPatch": {
    "dot.path.key": value
  }
}

settingsPatch rules:
- At most 2 keys
- Only use these dot paths:
  market.minimumSignalConfidence (50|60|70|80|90)
  market.minimumSignalEdge (3|5|10)
  market.signalCooldownSec (0-60 integer)
  market.signalHoldSec (0-30 integer)
  rsi.oversold (0-50)
  rsi.overbought (50-100)
  rsi.requireExtreme (boolean)
  stochastic.overbought (50-100)
  stochastic.oversold (0-50)
  stochastic.crossValidityBars (1-20 integer)
  adx.threshold (5-100)
  bollinger.bandProximityPct (0-5)
- Suggest small conservative adjustments only when clearly justified by this trade's outcome.
- On wins with good checklist alignment, prefer empty settingsPatch {}.
- On losses from weak edge or marginal setup, consider raising minimumSignalConfidence or minimumSignalEdge slightly.`;

export function buildTradeAnalysisPrompt(record: TradeRecord): { system: string; user: string } {
  const entrySummary = summarizeEntryForPrompt(record.entry);
  const user = JSON.stringify(
    {
      outcome: record.outcome,
      profit: record.profit,
      signal: record.signal,
      symbol: record.symbol,
      stake: record.stake,
      progressionLevel: record.progressionLevel,
      placedAt: record.placedAt,
      closedAt: record.closedAt,
      entry: entrySummary,
    },
    null,
    2,
  );
  return { system: SYSTEM_PROMPT, user };
}

export function buildAggregateAnalysisPrompt(
  records: TradeRecord[],
  rollingStats: Record<string, unknown>,
): { system: string; user: string } {
  const system = `You are optimizing a rule-based binary options signal engine based on recent auto-trade history.

Respond with ONLY valid JSON:
{
  "lessons": ["meta insights across trades"],
  "settingsPatch": { "dot.path": value }
}

At most 2 settingsPatch keys. Same whitelist as single-trade analysis. Be conservative.`;

  const trades = records.map((r) => ({
    outcome: r.outcome,
    signal: r.signal,
    verdict: r.analysis?.verdict ?? null,
    summary: r.analysis?.summary ?? null,
    entry: summarizeEntryForPrompt(r.entry),
  }));

  const user = JSON.stringify({ rollingStats, trades }, null, 2);
  return { system, user };
}

export interface ParsedAnalysisResponse {
  verdict: 'good_entry' | 'bad_entry' | 'marginal' | 'unclear';
  summary: string;
  lessons: string[];
  settingsPatch: Record<string, unknown>;
}

export function parseAggregateResponse(
  text: string,
): { lessons: string[]; settingsPatch: Record<string, unknown> } | null {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      lessons: Array.isArray(parsed.lessons)
        ? parsed.lessons.filter((l): l is string => typeof l === 'string')
        : [],
      settingsPatch:
        parsed.settingsPatch &&
        typeof parsed.settingsPatch === 'object' &&
        !Array.isArray(parsed.settingsPatch)
          ? (parsed.settingsPatch as Record<string, unknown>)
          : {},
    };
  } catch {
    return null;
  }
}

export function parseAnalysisResponse(text: string): ParsedAnalysisResponse | null {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : trimmed;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const verdict = parsed.verdict;
    if (
      verdict !== 'good_entry' &&
      verdict !== 'bad_entry' &&
      verdict !== 'marginal' &&
      verdict !== 'unclear'
    ) {
      return null;
    }
    return {
      verdict,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      lessons: Array.isArray(parsed.lessons)
        ? parsed.lessons.filter((l): l is string => typeof l === 'string')
        : [],
      settingsPatch:
        parsed.settingsPatch && typeof parsed.settingsPatch === 'object' && !Array.isArray(parsed.settingsPatch)
          ? (parsed.settingsPatch as Record<string, unknown>)
          : {},
    };
  } catch {
    return null;
  }
}
