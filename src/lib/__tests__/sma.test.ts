import { describe, expect, it } from 'vitest';
import { computeSma } from '../indicators/sma';

describe('computeSma', () => {
  it('returns last close when fewer bars than period', () => {
    expect(computeSma([10, 11, 12], 5)).toBe(12);
  });

  it('returns 0 for empty input', () => {
    expect(computeSma([], 5)).toBe(0);
  });

  it('averages the last N closes', () => {
    const values = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(computeSma(values, 3)).toBeCloseTo((8 + 9 + 10) / 3, 5);
  });
});
