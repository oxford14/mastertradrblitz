import { describe, expect, it } from 'vitest';
import { evaluateSignal } from '../signals/signal-engine';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { EMPTY_WICK } from '../patterns/rejection-wick';
import type { IndicatorSnapshot, PatternSnapshot } from '../../types';

function snapshot(
  overrides: Partial<IndicatorSnapshot> = {},
): IndicatorSnapshot {
  return {
    rsi: 28,
    stochK: 18,
    stochD: 15,
    price: 97,
    bbUpper: 105,
    bbLower: 97,
    bbMiddle: 101,
    stochCrossUp: false,
    stochCrossDown: false,
    crossUpOnThisBar: false,
    crossDownOnThisBar: false,
    bullishCrossValid: true,
    bearishCrossValid: false,
    barsSinceBullishCross: 1,
    barsSinceBearishCross: null,
    warmedUp: true,
    warmupRequired: 15,
    warmupCurrent: 20,
    ...overrides,
  };
}

const bullishPattern: PatternSnapshot = {
  pattern: 'Bullish Engulfing',
  bullishEngulfing: true,
  bearishEngulfing: false,
};

const nonePattern: PatternSnapshot = {
  pattern: 'None',
  bullishEngulfing: false,
  bearishEngulfing: false,
};

const wick = { bullishRejection: true, bearishRejection: false };
const adx = { adx: 22, plusDi: 28, minusDi: 12 };

describe('quality checklist and dual confidence', () => {
  it('assigns full higher confidence when all evidence passes', () => {
    const higher = evaluateSignal(
      snapshot(),
      bullishPattern,
      wick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(higher.signal).toBe('HIGHER');
    expect(higher.dualConfidence.higher.total).toBe(100);
    expect(higher.debug.higherChecklist.bollinger).toBe(true);
    expect(higher.debug.higherChecklist.rejectionWick).toBe(true);
  });

  it('scores partial higher confidence without engulfing and stays WAIT at 70%', () => {
    const wait = evaluateSignal(
      snapshot(),
      nonePattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(wait.signal).toBe('WAIT');
    expect(wait.dualConfidence.higher.total).toBe(60);
    expect(wait.debug.reason).toContain('No side above threshold');
  });

  it('reports dominant side checklist when below threshold', () => {
    const result = evaluateSignal(
      snapshot({ rsi: 50, price: 102, bbLower: 95 }),
      nonePattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.signal).toBe('WAIT');
    expect(result.dualConfidence.higher.total).toBe(30);
    expect(result.activeCheck.stochastic).toBe(true);
  });
});
