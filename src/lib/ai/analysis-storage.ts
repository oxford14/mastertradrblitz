import type { LatestTradeAnalysis } from '../../types';

export const LATEST_ANALYSIS_STORAGE_KEY = 'mtb_latest_analysis';

export async function readLatestAnalysis(): Promise<LatestTradeAnalysis | null> {
  const result = await chrome.storage.local.get(LATEST_ANALYSIS_STORAGE_KEY);
  const stored = result[LATEST_ANALYSIS_STORAGE_KEY] as LatestTradeAnalysis | undefined;
  return stored ?? null;
}

export async function writeLatestAnalysis(analysis: LatestTradeAnalysis): Promise<void> {
  await chrome.storage.local.set({ [LATEST_ANALYSIS_STORAGE_KEY]: analysis });
}

export async function clearLatestAnalysis(): Promise<void> {
  await chrome.storage.local.remove(LATEST_ANALYSIS_STORAGE_KEY);
}
