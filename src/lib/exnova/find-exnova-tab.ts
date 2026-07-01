import { isExnovaTraderoomUrl } from './traderoom-url';

export const EXNOVA_TRADE_ORIGIN = 'https://trade.exnova.com';

export function isExnovaTradeUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith(EXNOVA_TRADE_ORIGIN);
}

function pickTraderoomTab(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab | null {
  const traderoom = tabs.find((t) => isExnovaTraderoomUrl(t.url));
  return traderoom ?? tabs[0] ?? null;
}

/** Prefer active traderoom tab, else any open trade.exnova.com traderoom tab. */
export async function findExnovaTab(): Promise<chrome.tabs.Tab | null> {
  const [activeInFocused] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });

  if (activeInFocused?.id && isExnovaTraderoomUrl(activeInFocused.url)) {
    return activeInFocused;
  }

  const traderoomTabs = await chrome.tabs.query({
    url: `${EXNOVA_TRADE_ORIGIN}/*traderoom*`,
  });
  if (traderoomTabs.length > 0) {
    const sameWindow = traderoomTabs.filter(
      (t) => t.windowId === activeInFocused?.windowId,
    );
    const activeInSameWindow = sameWindow.find((t) => t.active);
    if (activeInSameWindow?.id) return activeInSameWindow;

    const anyActive = traderoomTabs.find((t) => t.active);
    if (anyActive?.id) return anyActive;

    return traderoomTabs[0] ?? null;
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

  return pickTraderoomTab(exnovaTabs);
}
