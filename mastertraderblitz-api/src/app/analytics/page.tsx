'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AnalyticsData {
  byAsset: Array<{ asset: string; winRate: number; total: number }>;
  byExpiry: Array<{ expiry: number; winRate: number; total: number }>;
  byIndicator: Array<{ dimension: string; segment: string; winRate: number; sampleSize: number }>;
  confidenceVsAccuracy: Array<{ range: string; winRate: number; total: number }>;
  dailyPnl: Array<{ date: string; pnl: number }>;
  lossStreaks: Array<{ length: number; endedAt: string }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MTB_API_KEY ?? '';
    fetch('/api/analytics?type=analytics', {
      headers: { 'x-mtb-api-key': key },
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <>
        <h2>Analytics</h2>
        <p>No analytics data available. Configure Supabase and record trades.</p>
      </>
    );
  }

  const assetChart = data.byAsset.map((a) => ({
    name: a.asset,
    winRate: Math.round(a.winRate * 100),
  }));
  const expiryChart = data.byExpiry.map((e) => ({
    name: `${e.expiry}s`,
    winRate: Math.round(e.winRate * 100),
  }));
  const indicatorChart = data.byIndicator.slice(0, 12).map((i) => ({
    name: `${i.dimension}/${i.segment}`,
    winRate: Math.round(i.winRate * 100),
  }));

  return (
    <>
      <h2>Analytics</h2>
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Win Rate by Asset</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={assetChart}>
              <CartesianGrid stroke="#243041" />
              <XAxis dataKey="name" stroke="#8a9bb0" fontSize={11} />
              <YAxis stroke="#8a9bb0" />
              <Tooltip />
              <Bar dataKey="winRate" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Win Rate by Expiry</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={expiryChart}>
              <CartesianGrid stroke="#243041" />
              <XAxis dataKey="name" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip />
              <Bar dataKey="winRate" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Win Rate by Indicator</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={indicatorChart} layout="vertical">
              <CartesianGrid stroke="#243041" />
              <XAxis type="number" stroke="#8a9bb0" />
              <YAxis type="category" dataKey="name" stroke="#8a9bb0" width={120} fontSize={10} />
              <Tooltip />
              <Bar dataKey="winRate" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>AI Confidence vs Accuracy</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.confidenceVsAccuracy}>
              <CartesianGrid stroke="#243041" />
              <XAxis dataKey="range" stroke="#8a9bb0" />
              <YAxis stroke="#8a9bb0" />
              <Tooltip />
              <Bar dataKey="winRate" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Daily PnL</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.dailyPnl}>
              <CartesianGrid stroke="#243041" />
              <XAxis dataKey="date" stroke="#8a9bb0" fontSize={11} />
              <YAxis stroke="#8a9bb0" />
              <Tooltip />
              <Line type="monotone" dataKey="pnl" stroke="#4ade80" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Loss Streak Analysis</h3>
          <table>
            <thead>
              <tr>
                <th>Length</th>
                <th>Ended At</th>
              </tr>
            </thead>
            <tbody>
              {data.lossStreaks.map((s, i) => (
                <tr key={i}>
                  <td>{s.length}</td>
                  <td>{new Date(s.endedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
