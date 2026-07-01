import type { IndicatorPerformanceContext, IndicatorPerformanceRow, MarketSnapshot, TradeOutcome } from '@mtb/shared';
import { DEFAULT_OPENROUTER_MODEL, normalizeOpenRouterModel } from '@mtb/shared/openrouter-models';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

interface DbPerformanceRow {
  dimension: string;
  segment: string;
  wins: number;
  losses: number;
  win_rate: number;
  sample_size: number;
  updated_at: string;
}

function mapRow(row: DbPerformanceRow): IndicatorPerformanceRow {
  return {
    dimension: row.dimension,
    segment: row.segment,
    wins: row.wins,
    losses: row.losses,
    winRate: Number(row.win_rate),
    sampleSize: row.sample_size,
    updatedAt: row.updated_at,
  };
}

export async function fetchPerformanceContext(): Promise<IndicatorPerformanceContext> {
  if (!isSupabaseConfigured()) {
    return { rows: [], summary: [] };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('indicator_performance')
    .select('*')
    .order('sample_size', { ascending: false })
    .limit(100);

  if (error || !data) {
    return { rows: [], summary: [] };
  }

  const rows = (data as DbPerformanceRow[]).map(mapRow);
  const summary = rows
    .filter((r) => r.sampleSize >= 5)
    .slice(0, 15)
    .map(
      (r) =>
        `${r.dimension}/${r.segment}: ${(r.winRate * 100).toFixed(1)}% win rate (n=${r.sampleSize})`,
    );

  return { rows, summary };
}

async function upsertPerformance(dimension: string, segment: string, outcome: TradeOutcome): Promise<void> {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from('indicator_performance')
    .select('*')
    .eq('dimension', dimension)
    .eq('segment', segment)
    .maybeSingle();

  const wins = (existing?.wins ?? 0) + (outcome === 'win' ? 1 : 0);
  const losses = (existing?.losses ?? 0) + (outcome === 'loss' ? 1 : 0);
  const sampleSize = wins + losses;
  const winRate = sampleSize > 0 ? wins / sampleSize : 0;

  await supabase.from('indicator_performance').upsert(
    {
      dimension,
      segment,
      wins,
      losses,
      win_rate: winRate,
      sample_size: sampleSize,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'dimension,segment' },
  );
}

function segmentsFromSnapshot(snapshot: MarketSnapshot): Array<[string, string]> {
  const segments: Array<[string, string]> = [
    ['asset', snapshot.asset],
    ['expiry', String(snapshot.expiry)],
    ['rsi', snapshot.rsi.state],
    ['stochastic', snapshot.stochastic.cross],
    ['adx', snapshot.adx.strength],
    ['bollinger', snapshot.bollinger.position],
    ['trend', snapshot.trend],
    ['macd', snapshot.macd.cross],
  ];
  return segments;
}

export async function refreshIndicatorPerformance(
  snapshot: MarketSnapshot,
  outcome: TradeOutcome,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  for (const [dimension, segment] of segmentsFromSnapshot(snapshot)) {
    await upsertPerformance(dimension, segment, outcome);
  }
}

export async function getDashboardStats() {
  if (!isSupabaseConfigured()) {
    return {
      todayWinRate: 0,
      todayPnl: 0,
      currentStreak: 0,
      aiAccuracy: 0,
      bestAsset: null,
      worstAsset: null,
      tradesToday: 0,
    };
  }

  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: trades } = await supabase
    .from('trade_history')
    .select('*')
    .gte('timestamp', startOfDay.toISOString())
    .not('result', 'is', null)
    .order('timestamp', { ascending: false });

  const rows = trades ?? [];
  const wins = rows.filter((t) => t.result === 'win').length;
  const losses = rows.filter((t) => t.result === 'loss').length;
  const decided = wins + losses;
  const todayPnl = rows.reduce((sum, t) => sum + Number(t.pnl ?? 0), 0);

  let currentStreak = 0;
  for (const t of rows) {
    if (t.result === 'loss') {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
    } else if (t.result === 'win') {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
    }
  }

  const assetStats = new Map<string, { wins: number; losses: number }>();
  for (const t of rows) {
    const cur = assetStats.get(t.asset) ?? { wins: 0, losses: 0 };
    if (t.result === 'win') cur.wins += 1;
    if (t.result === 'loss') cur.losses += 1;
    assetStats.set(t.asset, cur);
  }

  let bestAsset: string | null = null;
  let worstAsset: string | null = null;
  let bestRate = -1;
  let worstRate = 2;
  for (const [asset, stat] of assetStats) {
    const total = stat.wins + stat.losses;
    if (total < 3) continue;
    const rate = stat.wins / total;
    if (rate > bestRate) {
      bestRate = rate;
      bestAsset = asset;
    }
    if (rate < worstRate) {
      worstRate = rate;
      worstAsset = asset;
    }
  }

  const { data: decisions } = await supabase
    .from('ai_decisions')
    .select('decision, result')
    .not('result', 'is', null)
    .in('decision', ['BUY', 'SELL']);

  const actionable = (decisions ?? []).filter((d) => d.result);
  const aiWins = actionable.filter((d) => d.result === 'win').length;
  const aiAccuracy = actionable.length > 0 ? aiWins / actionable.length : 0;

  return {
    todayWinRate: decided > 0 ? wins / decided : 0,
    todayPnl,
    currentStreak,
    aiAccuracy,
    bestAsset,
    worstAsset,
    tradesToday: rows.length,
  };
}

export async function getAnalyticsData() {
  if (!isSupabaseConfigured()) {
    return {
      byAsset: [],
      byExpiry: [],
      byIndicator: [],
      confidenceVsAccuracy: [],
      dailyPnl: [],
      lossStreaks: [],
    };
  }

  const supabase = getSupabase();
  const { data: trades } = await supabase
    .from('trade_history')
    .select('*')
    .not('result', 'is', null)
    .order('timestamp', { ascending: true });

  const rows = trades ?? [];

  const byAssetMap = new Map<string, { wins: number; losses: number }>();
  const byExpiryMap = new Map<number, { wins: number; losses: number }>();
  const dailyPnlMap = new Map<string, number>();
  const confBuckets = new Map<string, { wins: number; losses: number }>();

  for (const t of rows) {
    const asset = byAssetMap.get(t.asset) ?? { wins: 0, losses: 0 };
    if (t.result === 'win') asset.wins += 1;
    if (t.result === 'loss') asset.losses += 1;
    byAssetMap.set(t.asset, asset);

    const expiry = byExpiryMap.get(t.expiry) ?? { wins: 0, losses: 0 };
    if (t.result === 'win') expiry.wins += 1;
    if (t.result === 'loss') expiry.losses += 1;
    byExpiryMap.set(t.expiry, expiry);

    const day = t.timestamp.slice(0, 10);
    dailyPnlMap.set(day, (dailyPnlMap.get(day) ?? 0) + Number(t.pnl ?? 0));

    const bucket = `${Math.floor(t.confidence / 10) * 10}-${Math.floor(t.confidence / 10) * 10 + 9}`;
    const cb = confBuckets.get(bucket) ?? { wins: 0, losses: 0 };
    if (t.result === 'win') cb.wins += 1;
    if (t.result === 'loss') cb.losses += 1;
    confBuckets.set(bucket, cb);
  }

  const { data: perfRows } = await supabase.from('indicator_performance').select('*');

  return {
    byAsset: [...byAssetMap.entries()].map(([asset, s]) => ({
      asset,
      winRate: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      total: s.wins + s.losses,
    })),
    byExpiry: [...byExpiryMap.entries()].map(([expiry, s]) => ({
      expiry,
      winRate: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      total: s.wins + s.losses,
    })),
    byIndicator: (perfRows ?? []).map((r) => ({
      dimension: r.dimension,
      segment: r.segment,
      winRate: Number(r.win_rate),
      sampleSize: r.sample_size,
    })),
    confidenceVsAccuracy: [...confBuckets.entries()].map(([range, s]) => ({
      range,
      winRate: s.wins + s.losses > 0 ? s.wins / (s.wins + s.losses) : 0,
      total: s.wins + s.losses,
    })),
    dailyPnl: [...dailyPnlMap.entries()].map(([date, pnl]) => ({ date, pnl })),
    lossStreaks: computeLossStreaks(rows),
  };
}

function computeLossStreaks(
  rows: Array<{ result: string | null; timestamp: string }>,
): Array<{ length: number; endedAt: string }> {
  const streaks: Array<{ length: number; endedAt: string }> = [];
  let current = 0;
  let streakStart = '';
  for (const t of rows) {
    if (t.result === 'loss') {
      if (current === 0) streakStart = t.timestamp;
      current += 1;
    } else if (t.result === 'win' && current > 0) {
      streaks.push({ length: current, endedAt: streakStart });
      current = 0;
    }
  }
  if (current > 0) streaks.push({ length: current, endedAt: streakStart });
  return streaks.slice(-20);
}

export async function fetchAiSettings() {
  if (!isSupabaseConfigured()) {
    return {
      model: normalizeOpenRouterModel(
        process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
      ),
      confidenceThreshold: 70,
      autoTradeThreshold: 85,
      maxLossStreak: 5,
      cooldownBetweenTradesSec: 5,
      allowedAssets: [] as string[],
      allowedExpiry: [5, 10, 15, 30] as Array<5 | 10 | 15 | 30>,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    };
  }

  const supabase = getSupabase();
  const { data } = await supabase.from('ai_settings').select('*').limit(1).maybeSingle();

  return {
    model: normalizeOpenRouterModel(
      data?.openrouter_model ?? DEFAULT_OPENROUTER_MODEL,
    ),
    confidenceThreshold: data?.confidence_threshold ?? 70,
    autoTradeThreshold: data?.auto_trade_threshold ?? 85,
    maxLossStreak: data?.max_loss_streak ?? 5,
    cooldownBetweenTradesSec: data?.cooldown_between_trades_sec ?? 5,
    allowedAssets: (data?.allowed_assets as string[]) ?? [],
    allowedExpiry: (data?.allowed_expiry as Array<5 | 10 | 15 | 30>) ?? [5, 10, 15, 30],
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  };
}

export async function updateAiSettings(input: Record<string, unknown>) {
  if (!isSupabaseConfigured()) return { ok: false, error: 'Supabase not configured' };

  const supabase = getSupabase();
  const { data: existing } = await supabase.from('ai_settings').select('id').limit(1).maybeSingle();

  const payload = {
    openrouter_model: input.model,
    confidence_threshold: input.confidenceThreshold,
    auto_trade_threshold: input.autoTradeThreshold,
    max_loss_streak: input.maxLossStreak,
    cooldown_between_trades_sec: input.cooldownBetweenTradesSec,
    allowed_assets: input.allowedAssets,
    allowed_expiry: input.allowedExpiry,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('ai_settings').update(payload).eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('ai_settings').insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
