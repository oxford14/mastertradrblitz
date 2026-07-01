import { describe, expect, it } from 'vitest';
import { isExnovaTradeUrl } from '../exnova/find-exnova-tab';
import { isExnovaTraderoomUrl } from '../exnova/traderoom-url';

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

describe('isExnovaTraderoomUrl', () => {
  it('distinguishes traderoom from other Exnova pages', () => {
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/traderoom')).toBe(true);
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/en/profile/personal')).toBe(
      false,
    );
  });
});
