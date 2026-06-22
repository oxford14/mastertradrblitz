export const EXNOVA_TRADE_ORIGIN = 'https://trade.exnova.com';

export function isExnovaTradeUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith(EXNOVA_TRADE_ORIGIN);
}

/** Prefer active Exnova tab, else any open trade.exnova.com tab. */
export async function findExnovaTab(): Promise<chrome.tabs.Tab | null> {
  const [activeInFocused] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (activeInFocused?.id && isExnovaTradeUrl(activeInFocused.url)) {
    return activeInFocused;
  }

  const exnovaTabs = await chrome.tabs.query({
    url: `${EXNOVA_TRADE_ORIGIN}/*`,
  });
  if (exnovaTabs.length === 0) return null;

  const sameWindow = exnovaTabs.filter(
    (t) => t.windowId === activeInFocused?.windowId,
  );
  const activeInSameWindow = sameWindow.find((t) => t.active);
  if (activeInSameWindow?.id) return activeInSameWindow;

  const anyActive = exnovaTabs.find((t) => t.active);
  if (anyActive?.id) return anyActive;

  return exnovaTabs[0] ?? null;
}
