import { NextResponse } from 'next/server';
import { getDashboardStats, getAnalyticsData } from '@/services/indicator-performance';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') ?? 'dashboard';

  if (type === 'analytics') {
    const data = await getAnalyticsData();
    return NextResponse.json(data);
  }

  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
