import type { AppSettings, EnhancerFlags, IndicatorSnapshot } from '../../types';
import type { AdxResult } from '../indicators/adx';
import type { FractalSnapshot } from '../patterns/fractal';

export interface EnhancerScore {
  cci: number;
  fractal: number;
  adxStrength: number;
  diConfirmation: number;
  crossFreshness: number;
  total: number;
}

const EMPTY_SCORE: EnhancerScore = {
  cci: 0,
  fractal: 0,
  adxStrength: 0,
  diConfirmation: 0,
  crossFreshness: 0,
  total: 0,
};

const EMPTY_FLAGS: EnhancerFlags = {
  cci: false,
  fractal: false,
  adxStrength: false,
  diConfirmation: false,
  crossFreshness: false,
};

function crossFreshnessPoints(barsSince: number | null, crossValid: boolean): number {
  if (!crossValid || barsSince === null) return 0;
  if (barsSince === 0) return 10;
  if (barsSince === 1) return 8;
  if (barsSince === 2) return 5;
  return 0;
}

function adxStrengthPoints(adx: number): number {
  if (adx >= 25) return 10;
  if (adx >= 20) return 5;
  return 0;
}

export function computeEnhancers(
  direction: 'HIGHER' | 'LOWER',
  ctx: {
    indicators: IndicatorSnapshot;
    adx: AdxResult;
    fractal: FractalSnapshot;
    settings: AppSettings;
  },
): { score: EnhancerScore; flags: EnhancerFlags } {
  const { indicators, adx, fractal, settings } = ctx;
  const score = { ...EMPTY_SCORE };
  const flags = { ...EMPTY_FLAGS };

  if (settings.cci.enabled && indicators.cci !== null) {
    const { overbought, oversold } = settings.cci;
    const cciExtreme =
      direction === 'HIGHER'
        ? indicators.cci <= oversold
        : indicators.cci >= overbought;
    if (cciExtreme) {
      score.cci = 5;
      flags.cci = true;
    }
  }

  if (direction === 'HIGHER' ? fractal.bullish : fractal.bearish) {
    score.fractal = 5;
    flags.fractal = true;
  }

  const adxPoints = adxStrengthPoints(adx.adx);
  if (adxPoints > 0) {
    score.adxStrength = adxPoints;
    flags.adxStrength = true;
  }

  const diAligned =
    direction === 'HIGHER'
      ? adx.plusDi > adx.minusDi
      : adx.minusDi > adx.plusDi;
  if (diAligned) {
    score.diConfirmation = 5;
    flags.diConfirmation = true;
  }

  const crossPoints = crossFreshnessPoints(
    direction === 'HIGHER'
      ? indicators.barsSinceBullishCross
      : indicators.barsSinceBearishCross,
    direction === 'HIGHER'
      ? indicators.bullishCrossValid
      : indicators.bearishCrossValid,
  );
  if (crossPoints > 0) {
    score.crossFreshness = crossPoints;
    flags.crossFreshness = true;
  }

  score.total =
    score.cci +
    score.fractal +
    score.adxStrength +
    score.diConfirmation +
    score.crossFreshness;

  return { score, flags };
}

export function fractalStatusLabel(fractal: FractalSnapshot): 'Bullish' | 'Bearish' | 'None' {
  if (fractal.bullish) return 'Bullish';
  if (fractal.bearish) return 'Bearish';
  return 'None';
}
