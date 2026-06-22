import { describe, expect, it } from 'vitest';
import { buildSignalDebug, evaluateSignal } from '../signals/signal-engine';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { EMPTY_WICK } from '../patterns/rejection-wick';
import type { IndicatorSnapshot, PatternSnapshot } from '../../types';

const base: IndicatorSnapshot = {
  rsi: 28,
  stochK: 18,
  stochD: 15,
  price: 97,
  bbUpper: 105,
  bbLower: 97,
  bbMiddle: 101,
  stochCrossUp: true,
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
};

const bullishPattern: PatternSnapshot = {
  pattern: 'Bullish Engulfing',
  bullishEngulfing: true,
  bearishEngulfing: false,
};

const adx = { adx: 25, plusDi: 30, minusDi: 15 };
const wick = { bullishRejection: true, bearishRejection: false };

describe('signal debug reasons', () => {
  it('explains HIGHER acceptance with full confidence', () => {
    const result = evaluateSignal(
      base,
      bullishPattern,
      wick,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.debug.reason).toContain('HIGHER');
    expect(result.debug.higherConfidence.total).toBe(100);
    expect(result.debug.adx).toBe(25);
    expect(result.debug.plusDi).toBe(30);
  });

  it('explains WAIT when below threshold', () => {
    const result = evaluateSignal(
      {
        ...base,
        rsi: 50,
        price: 102,
        bbLower: 95,
        bullishCrossValid: false,
        barsSinceBullishCross: null,
      },
      bullishPattern,
      EMPTY_WICK,
      DEFAULT_SETTINGS,
      adx,
    );
    expect(result.debug.reason).toContain('No side above threshold');
  });

  it('includes dual confidence breakdown in debug', () => {
    const debug = buildSignalDebug(
      base,
      bullishPattern,
      wick,
      DEFAULT_SETTINGS,
      'HIGHER',
      adx,
    );
    expect(debug.higherConfidence.rsi).toBe(25);
    expect(debug.higherConfidence.stochastic).toBe(30);
    expect(debug.higherConfidence.candlePattern).toBe(25);
    expect(debug.higherConfidence.bollinger).toBe(5);
    expect(debug.higherConfidence.rejectionWick).toBe(15);
    expect(debug.lowerConfidence.total).toBe(0);
  });
});
