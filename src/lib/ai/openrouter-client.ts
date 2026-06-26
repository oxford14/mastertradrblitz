import { getOpenRouterApiKey } from './openrouter-config';
import {
  buildAggregateAnalysisPrompt,
  buildTradeAnalysisPrompt,
  parseAggregateResponse,
  parseAnalysisResponse,
  type ParsedAnalysisResponse,
} from './analysis-prompt';
import type { TradeRecord } from '../../types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterCallResult {
  ok: boolean;
  analysis?: ParsedAnalysisResponse;
  rawText?: string;
  error?: string;
}

export interface AggregateOpenRouterResult {
  ok: boolean;
  analysis?: { lessons: string[]; settingsPatch: Record<string, unknown> };
  rawText?: string;
  error?: string;
}

async function callOpenRouterRaw(
  model: string,
  system: string,
  user: string,
): Promise<{ ok: boolean; rawText?: string; error?: string }> {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    return { ok: false, error: 'OpenRouter API key not configured' };
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trade.exnova.com',
        'X-Title': 'Master Trader Blitz',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { ok: false, error: `OpenRouter ${response.status}: ${body.slice(0, 200)}` };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText = data.choices?.[0]?.message?.content ?? '';
  return { ok: true, rawText };
}

export async function testOpenRouterModel(
  model: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await callOpenRouterRaw(
    model,
    'Reply with JSON only: {"ok":true}',
    'Ping',
  );
  if (!result.ok) return result;
  return { ok: true };
}

export async function analyzeTradeRecord(
  record: TradeRecord,
  model: string,
): Promise<OpenRouterCallResult> {
  const { system, user } = buildTradeAnalysisPrompt(record);
  const result = await callOpenRouterRaw(model, system, user);
  if (!result.ok || !result.rawText) return result;
  const analysis = parseAnalysisResponse(result.rawText);
  if (!analysis) {
    return { ok: false, rawText: result.rawText, error: 'Failed to parse analysis JSON' };
  }
  return { ok: true, analysis, rawText: result.rawText };
}

export async function analyzeAggregateRecords(
  records: TradeRecord[],
  rollingStats: Record<string, unknown>,
  model: string,
): Promise<AggregateOpenRouterResult> {
  const { system, user } = buildAggregateAnalysisPrompt(records, rollingStats);
  const result = await callOpenRouterRaw(model, system, user);
  if (!result.ok || !result.rawText) return result;
  const analysis = parseAggregateResponse(result.rawText);
  if (!analysis) {
    return { ok: false, rawText: result.rawText, error: 'Failed to parse aggregate JSON' };
  }
  return { ok: true, analysis, rawText: result.rawText };
}
