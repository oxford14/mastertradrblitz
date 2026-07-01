import type { TradeRecord } from '../../types';

export interface JournalInsights {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
  higherWins: number;
  higherLosses: number;
  lowerWins: number;
  lowerLosses: number;
  maxWinStreak: number;
  maxLossStreak: number;
  counterTrendLosses: number;
  badEntryCount: number;
  goodEntryCount: number;
  lossesByProgressionLevel: Record<number, number>;
  topThemes: string[];
}

const THEME_PATTERNS: { theme: string; pattern: RegExp }[] = [
  { theme: 'MA trend mismatch', pattern: /moving average|ma trend|trend (was|being|indicated)/i },
  { theme: 'Insufficient edge', pattern: /insufficient edge|weak edge|low edge/i },
  { theme: 'High confidence loss', pattern: /high confidence.*loss|despite.*high confidence/i },
  { theme: 'RSI conflict', pattern: /rsi.*(contradict|conflict|overbought|oversold)/i },
  { theme: 'Stochastic conflict', pattern: /stochastic.*(contradict|conflict|overbought|oversold)/i },
  { theme: 'Bollinger misalignment', pattern: /bollinger/i },
];

function isCounterTrendLoss(record: TradeRecord): boolean {
  const maTrend = record.entry.signalResult?.indicators?.maTrend;
  if (!maTrend) return false;
  if (record.outcome !== 'loss') return false;
  if (record.signal === 'HIGHER' && maTrend === 'down') return true;
  if (record.signal === 'LOWER' && maTrend === 'up') return true;
  return false;
}

function computeStreaks(records: readonly TradeRecord[]): {
  maxWinStreak: number;
  maxLossStreak: number;
} {
  const chronological = [...records].sort((a, b) => a.closedAt - b.closedAt);
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let winStreak = 0;
  let lossStreak = 0;

  for (const record of chronological) {
    if (record.outcome === 'win') {
      winStreak += 1;
      lossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else {
      lossStreak += 1;
      winStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
  }

  return { maxWinStreak, maxLossStreak };
}

function extractTopThemes(records: readonly TradeRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.analysis?.verdict !== 'bad_entry') continue;
    const text = record.analysis.summary ?? '';
    for (const { theme, pattern } of THEME_PATTERNS) {
      if (pattern.test(text)) {
        counts.set(theme, (counts.get(theme) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => `${theme} (${count})`);
}

export function computeJournalInsights(records: readonly TradeRecord[]): JournalInsights {
  const wins = records.filter((r) => r.outcome === 'win').length;
  const losses = records.length - wins;
  const higherWins = records.filter((r) => r.signal === 'HIGHER' && r.outcome === 'win').length;
  const higherLosses = records.filter((r) => r.signal === 'HIGHER' && r.outcome === 'loss').length;
  const lowerWins = records.filter((r) => r.signal === 'LOWER' && r.outcome === 'win').length;
  const lowerLosses = records.filter((r) => r.signal === 'LOWER' && r.outcome === 'loss').length;
  const { maxWinStreak, maxLossStreak } = computeStreaks(records);

  const lossesByProgressionLevel: Record<number, number> = {};
  for (const record of records) {
    if (record.outcome !== 'loss') continue;
    const level = record.progressionLevel;
    lossesByProgressionLevel[level] = (lossesByProgressionLevel[level] ?? 0) + 1;
  }

  return {
    total: records.length,
    wins,
    losses,
    winRate: records.length > 0 ? wins / records.length : 0,
    higherWins,
    higherLosses,
    lowerWins,
    lowerLosses,
    maxWinStreak,
    maxLossStreak,
    counterTrendLosses: records.filter(isCounterTrendLoss).length,
    badEntryCount: records.filter((r) => r.analysis?.verdict === 'bad_entry').length,
    goodEntryCount: records.filter((r) => r.analysis?.verdict === 'good_entry').length,
    lossesByProgressionLevel,
    topThemes: extractTopThemes(records),
  };
}
