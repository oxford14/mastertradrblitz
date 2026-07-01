import { apiFetch } from '@/lib/api-client';
import type { DashboardStats } from '@mtb/shared';

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default async function DashboardPage() {
  let stats: DashboardStats = {
    todayWinRate: 0,
    todayPnl: 0,
    currentStreak: 0,
    aiAccuracy: 0,
    bestAsset: null,
    worstAsset: null,
    tradesToday: 0,
  };

  try {
    stats = await apiFetch<DashboardStats>('/api/analytics?type=dashboard');
  } catch {
    // show zeros when API/DB unavailable
  }

  return (
    <>
      <h2>Dashboard</h2>
      <div className="card-grid">
        <div className="card">
          <div className="label">Today&apos;s Win Rate</div>
          <div className="value">{pct(stats.todayWinRate)}</div>
        </div>
        <div className="card">
          <div className="label">Today&apos;s PnL</div>
          <div className={`value ${stats.todayPnl >= 0 ? 'positive' : 'negative'}`}>
            {stats.todayPnl.toFixed(2)}
          </div>
        </div>
        <div className="card">
          <div className="label">Current Streak</div>
          <div className="value">{stats.currentStreak}</div>
        </div>
        <div className="card">
          <div className="label">AI Accuracy</div>
          <div className="value">{pct(stats.aiAccuracy)}</div>
        </div>
        <div className="card">
          <div className="label">Best Asset</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            {stats.bestAsset ?? '—'}
          </div>
        </div>
        <div className="card">
          <div className="label">Worst Asset</div>
          <div className="value" style={{ fontSize: '1.1rem' }}>
            {stats.worstAsset ?? '—'}
          </div>
        </div>
        <div className="card">
          <div className="label">Trades Today</div>
          <div className="value">{stats.tradesToday}</div>
        </div>
      </div>
    </>
  );
}
