import { describe, expect, it } from 'vitest';
import { isExnovaTradeUrl } from '../exnova/find-exnova-tab';

describe('isExnovaTradeUrl', () => {
  it('matches trade.exnova.com URLs', () => {
    expect(isExnovaTradeUrl('https://trade.exnova.com/traderoom')).toBe(true);
    expect(isExnovaTradeUrl('https://trade.exnova.com/')).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isExnovaTradeUrl('https://exnova.com')).toBe(false);
    expect(isExnovaTradeUrl('chrome-extension://abc/options.html')).toBe(
      false,
    );
    expect(isExnovaTradeUrl(undefined)).toBe(false);
  });
});
