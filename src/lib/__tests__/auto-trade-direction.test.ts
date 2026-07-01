import { describe, expect, it } from 'vitest';
import {
  autoTradeDirectionSkipMessage,
  isAutoTradeSignalAllowed,
  normalizeAutoTradeDirectionFilter,
} from '../exnova/auto-trade-direction';

describe('auto-trade-direction', () => {
  it('normalizes unknown values to both', () => {
    expect(normalizeAutoTradeDirectionFilter(undefined)).toBe('both');
    expect(normalizeAutoTradeDirectionFilter('invalid')).toBe('both');
  });

  it('allows only the selected direction', () => {
    expect(isAutoTradeSignalAllowed('both', 'HIGHER')).toBe(true);
    expect(isAutoTradeSignalAllowed('both', 'LOWER')).toBe(true);
    expect(isAutoTradeSignalAllowed('higher', 'HIGHER')).toBe(true);
    expect(isAutoTradeSignalAllowed('higher', 'LOWER')).toBe(false);
    expect(isAutoTradeSignalAllowed('lower', 'LOWER')).toBe(true);
    expect(isAutoTradeSignalAllowed('lower', 'HIGHER')).toBe(false);
  });

  it('builds skip message with filter label', () => {
    expect(autoTradeDirectionSkipMessage('higher', 'LOWER')).toContain('HIGHER only');
    expect(autoTradeDirectionSkipMessage('lower', 'HIGHER')).toContain('LOWER only');
  });
});
