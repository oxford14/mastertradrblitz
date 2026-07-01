import { NextRequest, NextResponse } from 'next/server';
import { MarketSnapshotSchema } from '@mtb/shared';
import { aiDecisionEngine } from '@/services/aiDecisionEngine';
import {
  fetchAiSettings,
  fetchPerformanceContext,
} from '@/services/indicator-performance';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getDecideRuntimeStats, recordDecideCall } from '@/services/decide-runtime';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = MarketSnapshotSchema.safeParse(body.snapshot ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid snapshot', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const settingsRaw = await fetchAiSettings();
    const settings = {
      model: settingsRaw.model,
      confidenceThreshold: settingsRaw.confidenceThreshold,
      autoTradeThreshold: settingsRaw.autoTradeThreshold,
      maxLossStreak: settingsRaw.maxLossStreak,
      cooldownBetweenTradesSec: settingsRaw.cooldownBetweenTradesSec,
      allowedAssets: settingsRaw.allowedAssets,
      allowedExpiry: settingsRaw.allowedExpiry,
      openrouterApiKey: settingsRaw.openrouterApiKey,
    };

    const now = Date.now();
    const cooldownMs = settings.cooldownBetweenTradesSec * 1000;
    const lastAt = getDecideRuntimeStats().lastDecisionAt;
    if (cooldownMs > 0 && lastAt != null && now - lastAt < cooldownMs) {
      return NextResponse.json({
        decision: 'WAIT',
        confidence: 0,
        reasoning: ['Server cooldown active'],
        risks: [],
        supportingIndicators: [],
      });
    }

    const performance = await fetchPerformanceContext();
    const result = await aiDecisionEngine({
      snapshot: parsed.data,
      performance,
      settings,
    });

    if (!result.ok || !result.decision) {
      return NextResponse.json(
        { error: result.error ?? 'AI decision failed' },
        { status: 502 },
      );
    }

    recordDecideCall();

    let decisionId: string | null = null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('ai_decisions')
        .insert({
          asset: parsed.data.asset,
          expiry: parsed.data.expiry,
          snapshot: parsed.data,
          decision: result.decision.decision,
          confidence: result.decision.confidence,
          reasoning: result.decision.reasoning,
          risks: result.decision.risks,
          supporting_indicators: result.decision.supportingIndicators ?? [],
        })
        .select('id')
        .single();
      decisionId = data?.id ?? null;
    }

    return NextResponse.json({ ...result.decision, id: decisionId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
