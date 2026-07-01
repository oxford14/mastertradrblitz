import { apiFetch } from '@/lib/api-client';

interface DecisionRow {
  id: string;
  asset: string;
  decision: string;
  confidence: number;
  reasoning: string[];
  risks: string[];
  result: string | null;
  timestamp: string;
}

function badgeClass(decision: string): string {
  if (decision === 'BUY') return 'badge badge-buy';
  if (decision === 'SELL') return 'badge badge-sell';
  return 'badge badge-wait';
}

export default async function DecisionsPage() {
  let decisions: DecisionRow[] = [];
  try {
    const data = await apiFetch<{ decisions: DecisionRow[] }>('/api/decisions?limit=100');
    decisions = data.decisions;
  } catch {
    decisions = [];
  }

  return (
    <>
      <h2>AI Decisions</h2>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Decision</th>
            <th>Confidence</th>
            <th>Reasoning</th>
            <th>Risks</th>
            <th>Result</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.id}>
              <td>{d.asset}</td>
              <td>
                <span className={badgeClass(d.decision)}>{d.decision}</span>
              </td>
              <td>{d.confidence}%</td>
              <td>{(d.reasoning ?? []).join('; ') || '—'}</td>
              <td>{(d.risks ?? []).join('; ') || '—'}</td>
              <td>{d.result ?? '—'}</td>
              <td>{new Date(d.timestamp).toLocaleString()}</td>
            </tr>
          ))}
          {decisions.length === 0 && (
            <tr>
              <td colSpan={7}>No AI decisions recorded yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
