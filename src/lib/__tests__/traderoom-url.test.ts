import { describe, expect, it } from 'vitest';
import { isExnovaTraderoomUrl } from '../exnova/traderoom-url';

describe('isExnovaTraderoomUrl', () => {
  it('matches traderoom paths', () => {
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/traderoom')).toBe(true);
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/en/traderoom')).toBe(true);
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/en/traderoom/')).toBe(true);
  });

  it('rejects non-traderoom Exnova pages', () => {
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/')).toBe(false);
    expect(
      isExnovaTraderoomUrl('https://trade.exnova.com/en/profile/personal'),
    ).toBe(false);
    expect(isExnovaTraderoomUrl('https://trade.exnova.com/en/profile/personal?act=changephoto')).toBe(
      false,
    );
  });

  it('rejects other origins', () => {
    expect(isExnovaTraderoomUrl('https://example.com/traderoom')).toBe(false);
    expect(isExnovaTraderoomUrl(undefined)).toBe(false);
  });
});
