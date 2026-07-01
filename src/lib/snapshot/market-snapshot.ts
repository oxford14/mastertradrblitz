import type { MarketSnapshot } from '@mtb/shared';
import type {
  AppSettings,
  IndicatorSnapshot,
  PatternSnapshot,
  WickSnapshot,
} from '../../types';

export interface SnapshotInputs {
  asset: string;
  expiry: AppSettings['market']['tradeExpirySec'];
  indicators: IndicatorSnapshot;
  pattern: PatternSnapshot;
  wick: WickSnapshot;
  adx: number;
  plusDi: number;
  minusDi: number;
  prevClose?: number;
  settings: AppSettings;
}

function rsiState(
  value: number,
  settings: AppSettings,
): MarketSnapshot['rsi']['state'] {
  if (value <= settings.rsi.oversold) return 'OVERSOLD';
  if (value >= settings.rsi.overbought) return 'OVERBOUGHT';
  return 'NEUTRAL';
}

function stochCross(indicators: IndicatorSnapshot): MarketSnapshot['stochastic']['cross'] {
  if (indicators.bullishCrossValid || indicators.stochCrossUp) return 'BULLISH';
  if (indicators.bearishCrossValid || indicators.stochCrossDown) return 'BEARISH';
  return 'NONE';
}

function adxStrength(value: number, threshold: number): MarketSnapshot['adx']['strength'] {
  if (value >= threshold + 5) return 'STRONG';
  if (value >= threshold) return 'MODERATE';
  return 'WEAK';
}

function bollingerPosition(
  price: number,
  upper: number,
  lower: number,
  middle: number,
  proximityPct: number,
): MarketSnapshot['bollinger']['position'] {
  const bandRange = upper - lower;
  if (bandRange <= 0) return 'MIDDLE';
  const lowerDist = Math.abs(price - lower) / bandRange;
  const upperDist = Math.abs(price - upper) / bandRange;
  const threshold = proximityPct / 100;
  if (lowerDist <= threshold) return 'LOWER_BAND';
  if (upperDist <= threshold) return 'UPPER_BAND';
  if (Math.abs(price - middle) / bandRange <= threshold) return 'MIDDLE';
  if (price < middle) return 'LOWER_BAND';
  if (price > middle) return 'UPPER_BAND';
  return 'MIDDLE';
}

function macdFromMa(
  indicators: IndicatorSnapshot,
  prevClose: number | undefined,
): MarketSnapshot['macd'] {
  const spread = indicators.maFast - indicators.maSlow;
  const prevSpread =
    prevClose !== undefined ? indicators.maFast - indicators.maSlow : spread;
  const cross: MarketSnapshot['macd']['cross'] =
    spread > 0 && prevSpread <= 0
      ? 'BULLISH'
      : spread < 0 && prevSpread >= 0
        ? 'BEARISH'
        : spread > 0
          ? 'BULLISH'
          : spread < 0
            ? 'BEARISH'
            : 'NONE';
  const histogram: MarketSnapshot['macd']['histogram'] =
    Math.abs(spread) > Math.abs(prevSpread)
      ? 'RISING'
      : Math.abs(spread) < Math.abs(prevSpread)
        ? 'FALLING'
        : 'FLAT';
  return { cross, histogram };
}

function fractalLabel(
  bullish: boolean,
  bearish: boolean,
): MarketSnapshot['fractal'] {
  if (bullish) return 'Bullish';
  if (bearish) return 'Bearish';
  return 'None';
}

export function buildMarketSnapshot(input: SnapshotInputs): MarketSnapshot {
  const { indicators, pattern, wick, settings, asset, expiry, adx } = input;
  const trendMap: Record<string, MarketSnapshot['trend']> = {
    up: 'UP',
    down: 'DOWN',
    neutral: 'NEUTRAL',
  };

  return {
    asset,
    expiry,
    rsi: {
      value: Math.round(indicators.rsi * 10) / 10,
      state: rsiState(indicators.rsi, settings),
    },
    macd: macdFromMa(indicators, input.prevClose),
    adx: {
      value: Math.round(adx * 10) / 10,
      strength: adxStrength(adx, settings.adx.threshold),
    },
    stochastic: {
      cross: stochCross(indicators),
    },
    bollinger: {
      position: bollingerPosition(
        indicators.price,
        indicators.bbUpper,
        indicators.bbLower,
        indicators.bbMiddle,
        settings.bollinger.bandProximityPct,
      ),
    },
    trend: trendMap[indicators.maTrend] ?? 'NEUTRAL',
    candlePattern: pattern.pattern !== 'None' ? pattern.pattern : undefined,
    rejectionWick: wick.bullishRejection || wick.bearishRejection,
    fractal: fractalLabel(false, false),
    cci: indicators.cci,
  };
}
