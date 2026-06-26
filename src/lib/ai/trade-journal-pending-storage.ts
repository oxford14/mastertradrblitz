import type { PendingJournalEntry } from './trade-journal-match';

export const JOURNAL_PENDING_STORAGE_KEY = 'mtb_journal_pending';

export interface JournalPendingData {
  pending: PendingJournalEntry[];
}

export async function readJournalPendingFromSession(): Promise<JournalPendingData> {
  const result = await chrome.storage.session.get(JOURNAL_PENDING_STORAGE_KEY);
  const stored = result[JOURNAL_PENDING_STORAGE_KEY] as JournalPendingData | undefined;
  if (!stored?.pending || !Array.isArray(stored.pending)) {
    return { pending: [] };
  }
  return { pending: stored.pending };
}

export async function writeJournalPendingToSession(
  data: JournalPendingData,
): Promise<void> {
  await chrome.storage.session.set({ [JOURNAL_PENDING_STORAGE_KEY]: data });
}

export async function clearJournalPendingFromSession(): Promise<void> {
  await chrome.storage.session.remove(JOURNAL_PENDING_STORAGE_KEY);
}
