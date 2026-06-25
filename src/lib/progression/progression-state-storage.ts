import type { ProgressionStateData } from '../../types';

export const PROGRESSION_STATE_STORAGE_KEY = 'mtb_progression_state';

export async function readProgressionStateFromSession(): Promise<ProgressionStateData | null> {
  const result = await chrome.storage.session.get(PROGRESSION_STATE_STORAGE_KEY);
  return (result[PROGRESSION_STATE_STORAGE_KEY] as ProgressionStateData | undefined) ?? null;
}

export async function writeProgressionStateToSession(
  data: ProgressionStateData,
): Promise<void> {
  await chrome.storage.session.set({ [PROGRESSION_STATE_STORAGE_KEY]: data });
}

export async function clearProgressionStateFromSession(): Promise<void> {
  await chrome.storage.session.remove(PROGRESSION_STATE_STORAGE_KEY);
}
