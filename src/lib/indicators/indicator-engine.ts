import type { AppSettings, Candle, IndicatorSnapshot, MaTrend } from '../../types';
import { RSI } from './rsi';
import { StochasticOscillator } from './stochastic';
import {
  computeBollinger,
  isNearLowerBand,
  isNearUpperBand,
} from './bollinger';
import { computeEma } from './ema';
import { computeSma } from './sma';
import { computeCci } from './cci';

function computeMa(
  closes: readonly number[],
  period: number,
  type: AppSettings['movingAverage']['type'],
): number {
  return type === 'sma' ? computeSma(closes, period) : computeEma(closes, period);
}

function resolveMaTrend(fast: number, slow: number): MaTrend {
  if (fast > slow) return 'up';
  if (fast < slow) return 'down';
  return 'neutral';
}

export function warmupRequired(settings: AppSettings): number {
  const { rsi, stochastic, bollinger, movingAverage, cci } = settings;
  const cciWarmup = cci.enabled ? cci.period : 0;
  return Math.max(
    rsi.period + 1,
    stochastic.kPeriod + stochastic.smoothing + stochastic.dPeriod,
    bollinger.period,
    movingAverage.slowPeriod,
    cciWarmup,
  );
}

export class IndicatorEngine {
  private rsi: RSI;
  private stochastic: StochasticOscillator;
  private settings: AppSettings;
  private lastSnapshot: IndicatorSnapshot | null = null;

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.rsi = new RSI(settings.rsi.period);
    this.stochastic = new StochasticOscillator(
      settings.stochastic.kPeriod,
      settings.stochastic.dPeriod,
      settings.stochastic.smoothing,
    );
  }

  updateSettings(settings: AppSettings): void {
    const needsReset =
      settings.rsi.period !== this.settings.rsi.period ||
      settings.stochastic.kPeriod !== this.settings.stochastic.kPeriod ||
      settings.stochastic.dPeriod !== this.settings.stochastic.dPeriod ||
      settings.stochastic.smoothing !== this.settings.stochastic.smoothing ||
      settings.movingAverage.fastPeriod !== this.settings.movingAverage.fastPeriod ||
      settings.movingAverage.slowPeriod !== this.settings.movingAverage.slowPeriod ||
      settings.movingAverage.type !== this.settings.movingAverage.type ||
      settings.cci.enabled !== this.settings.cci.enabled ||
      settings.cci.period !== this.settings.cci.period;

    this.settings = settings;
    if (needsReset) {
      this.rsi = new RSI(settings.rsi.period);
      this.stochastic = new StochasticOscillator(
        settings.stochastic.kPeriod,
        settings.stochastic.dPeriod,
        settings.stochastic.smoothing,
      );
      this.lastSnapshot = null;
    }
  }

  computeFromCandles(candles: readonly Candle[]): IndicatorSnapshot {
    const required = warmupRequired(this.settings);
    const count = candles.length;
    const price = candles[count - 1]?.close ?? 0;

    if (count === 0) {
      return this.emptySnapshot(required, 0, price);
    }

    this.rsi = new RSI(this.settings.rsi.period);
    this.stochastic = new StochasticOscillator(
      this.settings.stochastic.kPeriod,
      this.settings.stochastic.dPeriod,
      this.settings.stochastic.smoothing,
    );

    const { crossValidityBars } = this.settings.stochastic;

    let stochCrossUp = false;
    let stochCrossDown = false;
    let crossUpOnThisBar = false;
    let crossDownOnThisBar = false;
    let rsiVal = 50;
    let stochK = 50;
    let stochD = 50;
    let barsSinceBullishCross: number | null = null;
    let barsSinceBearishCross: number | null = null;

    for (const c of candles) {
      rsiVal = this.rsi.update(c.close);
      const st = this.stochastic.update(c.high, c.low, c.close);
      stochK = st.k;
      stochD = st.d;
      stochCrossUp = st.crossUp;
      stochCrossDown = st.crossDown;
      crossUpOnThisBar = st.crossUp;
      crossDownOnThisBar = st.crossDown;

      if (st.crossUp) {
        barsSinceBullishCross = 0;
      } else if (barsSinceBullishCross !== null) {
        barsSinceBullishCross += 1;
      }

      if (st.crossDown) {
        barsSinceBearishCross = 0;
      } else if (barsSinceBearishCross !== null) {
        barsSinceBearishCross += 1;
      }
    }

    const bullishCrossValid =
      barsSinceBullishCross !== null &&
      barsSinceBullishCross < crossValidityBars;
    const bearishCrossValid =
      barsSinceBearishCross !== null &&
      barsSinceBearishCross < crossValidityBars;

    const closes = candles.map((c) => c.close);
    const bb = computeBollinger(
      closes,
      this.settings.bollinger.period,
      this.settings.bollinger.deviation,
    );

    const { fastPeriod, slowPeriod, type } = this.settings.movingAverage;
    const maFast = computeMa(closes, fastPeriod, type);
    const maSlow = computeMa(closes, slowPeriod, type);
    const maTrend = resolveMaTrend(maFast, maSlow);
    const cci =
      this.settings.cci.enabled
        ? computeCci(candles, this.settings.cci.period)
        : null;

    const warmedUp = count >= required;
    const snapshot: IndicatorSnapshot = {
      rsi: rsiVal,
      stochK,
      stochD,
      price,
      bbUpper: bb.upper,
      bbLower: bb.lower,
      bbMiddle: bb.middle,
      stochCrossUp,
      stochCrossDown,
      crossUpOnThisBar,
      crossDownOnThisBar,
      bullishCrossValid,
      bearishCrossValid,
      barsSinceBullishCross,
      barsSinceBearishCross,
      warmedUp,
      warmupRequired: required,
      warmupCurrent: count,
      maFast,
      maSlow,
      maTrend,
      cci,
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  getLastSnapshot(): IndicatorSnapshot | null {
    return this.lastSnapshot;
  }

  private emptySnapshot(
    required: number,
    current: number,
    price: number,
  ): IndicatorSnapshot {
    return {
      rsi: 50,
      stochK: 50,
      stochD: 50,
      price,
      bbUpper: price,
      bbLower: price,
      bbMiddle: price,
      stochCrossUp: false,
      stochCrossDown: false,
      crossUpOnThisBar: false,
      crossDownOnThisBar: false,
      bullishCrossValid: false,
      bearishCrossValid: false,
      barsSinceBullishCross: null,
      barsSinceBearishCross: null,
      warmedUp: false,
      warmupRequired: required,
      warmupCurrent: current,
      maFast: price,
      maSlow: price,
      maTrend: 'neutral',
      cci: null,
    };
  }
}

export function bollingerTouchHigher(
  indicators: IndicatorSnapshot,
  settings: AppSettings,
): boolean {
  return isNearLowerBand(
    indicators.price,
    indicators.bbLower,
    indicators.bbUpper,
    settings.bollinger.bandProximityPct,
  );
}

export function bollingerTouchLower(
  indicators: IndicatorSnapshot,
  settings: AppSettings,
): boolean {
  return isNearUpperBand(
    indicators.price,
    indicators.bbUpper,
    indicators.bbLower,
    settings.bollinger.bandProximityPct,
  );
}

export function maTrendAlignsHigher(indicators: IndicatorSnapshot): boolean {
  return indicators.maTrend === 'up';
}

export function maTrendAlignsLower(indicators: IndicatorSnapshot): boolean {
  return indicators.maTrend === 'down';
}
