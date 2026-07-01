import type { IndicatorPerformanceContext, MarketSnapshot } from '@mtb/shared';
import { AiDecisionSchema } from '@mtb/shared';

const SYSTEM_PROMPT = `You are an expert binary-options trade analyst for short-expiry Blitz trades.

Analyze the provided market snapshot and historical indicator performance context.
Determine whether the trade should be BUY (price goes higher), SELL (price goes lower), or WAIT.

Do NOT predict whether the trade will win. Focus on setup quality and confluence.

Respond with ONLY valid JSON matching:
{
  "decision": "BUY" | "SELL" | "WAIT",
  "confidence": 0-100,
  "reasoning": ["short reason strings"],
  "risks": ["short risk strings"],
  "supportingIndicators": ["indicator names that support the decision"]
}

Rules:
- WAIT when evidence is mixed, trend unclear, or risks outweigh confluence.
- confidence reflects setup quality, not win probability.
- Reference performance context when relevant.`;

export function buildDecisionPrompt(
  snapshot: MarketSnapshot,
  performance: IndicatorPerformanceContext,
): { system: string; user: string } {
  const user = JSON.stringify(
    {
      snapshot,
      performanceContext: performance.summary,
      performanceRows: performance.rows.slice(0, 30),
    },
    null,
    2,
  );
  return { system: SYSTEM_PROMPT, user };
}

export function parseDecisionResponse(rawText: string) {
  const parsed = JSON.parse(
    (() => {
      try {
        return rawText;
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        return match ? match[0] : rawText;
      }
    })(),
  );
  return AiDecisionSchema.safeParse(parsed);
}
