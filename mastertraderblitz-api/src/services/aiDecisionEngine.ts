import type {
  AiDecision,
  AiSettings,
  IndicatorPerformanceContext,
  MarketSnapshot,
} from '@mtb/shared';
import { AiDecisionSchema } from '@mtb/shared';
import { normalizeOpenRouterModel } from '@mtb/shared/openrouter-models';
import { callOpenRouter, parseJsonResponse } from '@/lib/openrouter-client';
import { buildDecisionPrompt } from './decision-prompt';

export interface AiDecisionEngineInput {
  snapshot: MarketSnapshot;
  performance: IndicatorPerformanceContext;
  settings: AiSettings;
}

export interface AiDecisionEngineResult {
  ok: boolean;
  decision?: AiDecision;
  error?: string;
  rawText?: string;
}

function isAssetAllowed(snapshot: MarketSnapshot, settings: AiSettings): boolean {
  if (settings.allowedAssets.length === 0) return true;
  return settings.allowedAssets.some(
    (a) => a.toLowerCase() === snapshot.asset.toLowerCase(),
  );
}

function isExpiryAllowed(snapshot: MarketSnapshot, settings: AiSettings): boolean {
  return settings.allowedExpiry.includes(snapshot.expiry);
}

export async function aiDecisionEngine(
  input: AiDecisionEngineInput,
): Promise<AiDecisionEngineResult> {
  const { snapshot, performance, settings } = input;

  if (!isAssetAllowed(snapshot, settings)) {
    return {
      ok: true,
      decision: {
        decision: 'WAIT',
        confidence: 0,
        reasoning: [`Asset ${snapshot.asset} is not in allowed list`],
        risks: [],
        supportingIndicators: [],
      },
    };
  }

  if (!isExpiryAllowed(snapshot, settings)) {
    return {
      ok: true,
      decision: {
        decision: 'WAIT',
        confidence: 0,
        reasoning: [`Expiry ${snapshot.expiry}s is not allowed`],
        risks: [],
        supportingIndicators: [],
      },
    };
  }

  const apiKey = settings.openrouterApiKey ?? process.env.OPENROUTER_API_KEY ?? '';
  const model = normalizeOpenRouterModel(settings.model);
  const { system, user } = buildDecisionPrompt(snapshot, performance);
  const result = await callOpenRouter(model, system, user, apiKey);

  if (!result.ok || !result.rawText) {
    return { ok: false, error: result.error ?? 'Empty OpenRouter response' };
  }

  const parsed = parseJsonResponse<unknown>(result.rawText);
  const validated = AiDecisionSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: 'Failed to parse AI decision JSON',
      rawText: result.rawText,
    };
  }

  return { ok: true, decision: validated.data, rawText: result.rawText };
}
