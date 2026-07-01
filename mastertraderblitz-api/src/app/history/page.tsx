import { apiFetch } from '@/lib/api-client';

interface TradeRow {
  id: string;
  asset: string;
  direction: string | null;
  confidence: number;
  result: string | null;
  pnl: number | null;
  indicators: Record<string, unknown>;
  timestamp: string;
  ai_decision: string;
}

export default async function HistoryPage() {
  let trades: TradeRow[] = [];
  try {
    const data = await apiFetch<{ trades: TradeRow[] }>('/api/trades?limit=100');
    trades = data.trades;
  } catch {
    trades = [];
  }

  return (
    <>
      <h2>Trade History</h2>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Direction</th>
            <th>AI Decision</th>
            <th>Confidence</th>
            <th>Result</th>
            <th>PnL</th>
            <th>Snapshot</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id}>
              <td>{t.asset}</td>
              <td>{t.direction ?? '—'}</td>
              <td>{t.ai_decision}</td>
              <td>{t.confidence}%</td>
              <td>{t.result ?? '—'}</td>
              <td className={Number(t.pnl) >= 0 ? 'positive' : 'negative'}>
                {t.pnl != null ? Number(t.pnl).toFixed(2) : '—'}
              </td>
              <td>
                <code style={{ fontSize: '0.7rem' }}>
                  {JSON.stringify(t.indicators).slice(0, 80)}…
                </code>
              </td>
              <td>{new Date(t.timestamp).toLocaleString()}</td>
            </tr>
          ))}
          {trades.length === 0 && (
            <tr>
              <td colSpan={8}>No trades recorded yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
