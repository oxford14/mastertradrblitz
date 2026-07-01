import { NextRequest, NextResponse } from 'next/server';
import { MarketSnapshotSchema } from '@mtb/shared';
import { refreshIndicatorPerformance } from '@/services/indicator-performance';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ trades: [] });
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trade_history')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(Math.min(limit, 500));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trades: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true, id: body.externalId ?? crypto.randomUUID() });
    }

    const snapshotParsed = MarketSnapshotSchema.safeParse(body.indicators ?? body.snapshot);
    const supabase = getSupabase();

    const payload = {
      external_id: body.externalId ?? body.id ?? null,
      asset: body.asset ?? snapshotParsed.data?.asset ?? 'UNKNOWN',
      timestamp: body.timestamp ?? new Date().toISOString(),
      expiry: body.expiry ?? snapshotParsed.data?.expiry ?? 5,
      indicators: snapshotParsed.success ? snapshotParsed.data : body.indicators,
      ai_decision: body.aiDecision ?? body.ai_decision ?? 'WAIT',
      confidence: body.confidence ?? 0,
      reasoning: body.reasoning ?? [],
      risks: body.risks ?? [],
      result: body.result ?? null,
      pnl: body.pnl ?? null,
      streak: body.streak ?? null,
      direction: body.direction ?? null,
      mode: body.mode ?? 'ai',
      strategy_id: body.strategyId ?? null,
    };

    const { data, error } = await supabase
      .from('trade_history')
      .upsert(payload, { onConflict: 'external_id' })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.result && snapshotParsed.success) {
      await refreshIndicatorPerformance(snapshotParsed.data, body.result);
    }

    if (body.aiDecisionId && data?.id) {
      await supabase
        .from('ai_decisions')
        .update({ trade_id: data.id, result: body.result ?? null })
        .eq('id', body.aiDecisionId);
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
