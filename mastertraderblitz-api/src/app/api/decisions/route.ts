import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ decisions: [] });
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 100);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ai_decisions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(Math.min(limit, 500));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ decisions: data ?? [] });
}
