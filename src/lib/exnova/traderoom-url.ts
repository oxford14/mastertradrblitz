const EXNOVA_TRADE_ORIGIN = 'https://trade.exnova.com';

/** True when the URL is the Exnova traderoom (any locale prefix). */
export function isExnovaTraderoomUrl(url: string | undefined): boolean {
  if (typeof url !== 'string' || !url.startsWith(EXNOVA_TRADE_ORIGIN)) {
    return false;
  }
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.includes('/traderoom');
  } catch {
    return false;
  }
}
