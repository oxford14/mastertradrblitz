import { describe, expect, it } from 'vitest';
import { evaluateSignal, resolveSignal } from '../signals/signal-engine';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { AppSettings, IndicatorSnapshot } from '../../types';

function warmedSnapshot(
  overrides: Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  return {
    rsi: 50,
    stochK: 50,
    stochD: 50,
    price: 100,
    bbUpper: 105,
    bbLower: 95,
    bbMiddle: 100,
    stochCrossUp: false,
    stochCrossDown: false,
    crossUpOnThisBar: false,
    crossDownOnThisBar: false,
    bullishCrossValid: false,
    bearishCrossValid: false,
    barsSinceBullishCross: null,
    barsSinceBearishCross: null,
    warmedUp: false,
    warmupRequired: 21,
    warmupCurrent: 5,
    maFast: 100,
    maSlow: 100,
    maTrend: 'neutral',
    cci: null,
    ...overrides,
  };
}

describe('resolveSignal', () => {
  const settings = DEFAULT_SETTINGS;

  it('fires HIGHER when only higher meets threshold', () => {
    expect(resolveSignal(75, 40, settings)).toEqual({ signal: 'HIGHER' });
  });

  it('fires LOWER when only lower meets threshold', () => {
    expect(resolveSignal(40, 80, settings)).toEqual({ signal: 'LOWER' });
  });

  it('returns WAIT when neither meets threshold', () => {
    const r = resolveSignal(55, 30, settings);
    expect(r.signal).toBe('WAIT');
    expect(r.reason).toBe('No side above threshold');
  });

  it('picks higher side when both meet threshold and edge is sufficient', () => {
    expect(resolveSignal(76, 70, settings)).toEqual({ signal: 'HIGHER' });
    expect(resolveSignal(70, 76, settings)).toEqual({ signal: 'LOWER' });
  });

  it('returns WAIT when both meet threshold but edge is too small', () => {
    const r = resolveSignal(71, 70, settings);
    expect(r.signal).toBe('WAIT');
    expect(r.reason).toBe('Conflicting evidence');
  });

  it('respects custom minimum edge', () => {
    const tightEdge: AppSettings = {
      ...settings,
      market: { ...settings.market, minimumSignalEdge: 10 },
    };
    const r = resolveSignal(75, 72, tightEdge);
    expect(r.signal).toBe('WAIT');
    expect(r.reason).toBe('Conflicting evidence');
  });
});

describe('evaluateSignal warmup', () => {
  it('stays WAIT while warming up', () => {
    const result = evaluateSignal(
      warmedSnapshot(),
      { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
      { bullishRejection: false, bearishRejection: false },
      DEFAULT_SETTINGS,
    );
    expect(result.signal).toBe('WAIT');
    expect(result.debug.reason).toContain('Warming up');
  });
});

describe('evaluateSignal threshold boundary', () => {
  it('fires at exactly 70%', () => {
    const r = resolveSignal(70, 0, DEFAULT_SETTINGS);
    expect(r.signal).toBe('HIGHER');
  });

  it('waits at 69%', () => {
    const r = resolveSignal(69, 0, DEFAULT_SETTINGS);
    expect(r.signal).toBe('WAIT');
  });

  it('uses custom confidence threshold from settings', () => {
    const strict: AppSettings = {
      ...DEFAULT_SETTINGS,
      market: { ...DEFAULT_SETTINGS.market, minimumSignalConfidence: 80 },
    };
    expect(resolveSignal(75, 0, strict).signal).toBe('WAIT');
    expect(resolveSignal(80, 0, strict).signal).toBe('HIGHER');
  });
});

describe('evaluateSignal MA trend alignment gate', () => {
  const pattern = { pattern: 'Bullish', bullishEngulfing: true, bearishEngulfing: false };
  const wick = { bullishRejection: false, bearishRejection: false };

  it('blocks HIGHER when MA trend is down and alignment required', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      movingAverage: { ...DEFAULT_SETTINGS.movingAverage, requireTrendAlignment: true },
    };
    const result = evaluateSignal(
      warmedSnapshot({
        warmedUp: true,
        warmupCurrent: 21,
        rsi: 20,
        bullishCrossValid: true,
        maTrend: 'down',
        maFast: 99,
        maSlow: 100,
        price: 94,
        bbLower: 95,
      }),
      pattern,
      wick,
      settings,
    );
    expect(result.signal).toBe('WAIT');
    expect(result.debug.reason).toContain('HIGHER blocked');
  });

  it('allows HIGHER when MA trend is up and alignment required', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      movingAverage: { ...DEFAULT_SETTINGS.movingAverage, requireTrendAlignment: true },
    };
    const result = evaluateSignal(
      warmedSnapshot({
        warmedUp: true,
        warmupCurrent: 21,
        rsi: 20,
        bullishCrossValid: true,
        maTrend: 'up',
        maFast: 101,
        maSlow: 100,
        price: 94,
        bbLower: 95,
      }),
      pattern,
      wick,
      settings,
    );
    expect(result.signal).toBe('HIGHER');
  });

  it('does not block counter-trend when alignment is off', () => {
    const result = evaluateSignal(
      warmedSnapshot({
        warmedUp: true,
        warmupCurrent: 21,
        rsi: 20,
        bullishCrossValid: true,
        maTrend: 'down',
        maFast: 99,
        maSlow: 100,
        price: 94,
        bbLower: 95,
      }),
      pattern,
      wick,
      DEFAULT_SETTINGS,
    );
    expect(result.signal).toBe('HIGHER');
  });
});
