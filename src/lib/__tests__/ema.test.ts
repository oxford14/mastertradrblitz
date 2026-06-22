import { describe, expect, it } from 'vitest';
import { computeEma } from '../indicators/ema';

describe('computeEma', () => {
  it('returns last close when fewer bars than period', () => {
    expect(computeEma([10, 11, 12], 5)).toBe(12);
  });

  it('returns 0 for empty input', () => {
    expect(computeEma([], 20)).toBe(0);
  });

  it('weights recent closes more heavily', () => {
    const flat = computeEma(Array.from({ length: 30 }, () => 100), 20);
    const rising = computeEma(
      Array.from({ length: 30 }, (_, i) => 100 + i),
      20,
    );
    expect(rising).toBeGreaterThan(flat);
  });
});
