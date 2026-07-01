import { NextRequest, NextResponse } from 'next/server';
import { fetchAiSettings, updateAiSettings } from '@/services/indicator-performance';
import { getDecideRuntimeStats } from '@/services/decide-runtime';

export async function GET() {
  const settings = await fetchAiSettings();
  const runtime = getDecideRuntimeStats();
  return NextResponse.json({
    model: settings.model,
    confidenceThreshold: settings.confidenceThreshold,
    autoTradeThreshold: settings.autoTradeThreshold,
    maxLossStreak: settings.maxLossStreak,
    cooldownBetweenTradesSec: settings.cooldownBetweenTradesSec,
    allowedAssets: settings.allowedAssets,
    allowedExpiry: settings.allowedExpiry,
    openrouterConfigured: runtime.openrouterConfigured,
    openrouterAppTitle: runtime.openrouterAppTitle,
    lastDecisionAt: runtime.lastDecisionAt,
    decideCallCount: runtime.decideCallCount,
    callsPerHourEstimate: runtime.callsPerHourEstimate,
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateAiSettings(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Settings save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
