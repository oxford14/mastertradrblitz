import type { AutoTradeStatsData } from '../../types';

export const AUTO_TRADE_STATS_STORAGE_KEY = 'mtb_auto_trade_stats';

export async function readAutoTradeStatsFromSession(): Promise<AutoTradeStatsData | null> {
  const result = await chrome.storage.session.get(AUTO_TRADE_STATS_STORAGE_KEY);
  return (result[AUTO_TRADE_STATS_STORAGE_KEY] as AutoTradeStatsData | undefined) ?? null;
}

export async function writeAutoTradeStatsToSession(
  data: AutoTradeStatsData,
): Promise<void> {
  await chrome.storage.session.set({ [AUTO_TRADE_STATS_STORAGE_KEY]: data });
}

export async function clearAutoTradeStatsFromSession(): Promise<void> {
  await chrome.storage.session.remove(AUTO_TRADE_STATS_STORAGE_KEY);
}
