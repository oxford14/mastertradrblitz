import { DEFAULT_SETTINGS, validateSettings } from './defaults';
import type { AppSettings } from '../../types';

const STORAGE_KEY = 'mtb_settings';

export async function loadSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as AppSettings | undefined;
  if (!stored) return { ...DEFAULT_SETTINGS };
  return validateSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const validated = validateSettings(settings);
  await chrome.storage.local.set({ [STORAGE_KEY]: validated });
  await chrome.runtime.sendMessage({ type: 'settings-updated', settings: validated });
  return validated;
}

export function onSettingsChanged(
  callback: (settings: AppSettings) => void,
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    const next = changes[STORAGE_KEY].newValue as AppSettings | undefined;
    if (next) callback(validateSettings({ ...DEFAULT_SETTINGS, ...next }));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
