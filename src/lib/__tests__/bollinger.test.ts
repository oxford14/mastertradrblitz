import { describe, expect, it } from 'vitest';
import {
  computeBollinger,
  isNearLowerBand,
  isNearUpperBand,
} from '../indicators/bollinger';

describe('bollinger touch', () => {
  it('does not report touch when bands are collapsed (std ≈ 0)', () => {
    expect(isNearLowerBand(100, 100, 100, 0.5)).toBe(false);
    expect(isNearUpperBand(100, 100, 100, 0.5)).toBe(false);
  });

  it('detects lower-band touch for HIGHER setup', () => {
    expect(isNearLowerBand(97, 97, 105, 0.5)).toBe(true);
    expect(isNearLowerBand(102, 95, 105, 0.5)).toBe(false);
  });

  it('detects upper-band touch for LOWER setup', () => {
    expect(isNearUpperBand(104, 104, 96, 0.5)).toBe(true);
    expect(isNearUpperBand(98, 104, 96, 0.5)).toBe(false);
  });

  it('returns collapsed bands before warmup period', () => {
    const bb = computeBollinger([1.1, 1.1, 1.1], 14, 2);
    expect(bb.upper).toBe(bb.lower);
    expect(isNearLowerBand(1.1, bb.lower, bb.upper, 0.5)).toBe(false);
  });

  it('produces separated bands on varying closes', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 2);
    const bb = computeBollinger(closes, 14, 2);
    expect(bb.upper).toBeGreaterThan(bb.lower);
    expect(isNearLowerBand(bb.lower, bb.lower, bb.upper, 0.5)).toBe(true);
    expect(isNearUpperBand(bb.upper, bb.upper, bb.lower, 0.5)).toBe(true);
  });
});
