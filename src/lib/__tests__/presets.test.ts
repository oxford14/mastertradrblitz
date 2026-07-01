import { describe, expect, it } from 'vitest';
import {
  getExnovaGuide,
  getPreset,
  TRADE_EXPIRY_OPTIONS,
} from '../settings/presets';
import { validateSettings } from '../settings/defaults';

describe('presets', () => {
  for (const expiry of TRADE_EXPIRY_OPTIONS) {
    it(`syncs bar interval with trade expiry for ${expiry}s`, () => {
      const preset = getPreset(expiry);
      expect(preset.market.tradeExpirySec).toBe(expiry);
      expect(preset.market.candleIntervalSec).toBe(expiry);
    });

    it(`returns Exnova guide for ${expiry}s`, () => {
      const guide = getExnovaGuide(expiry);
      expect(guide.tradeExpirySec).toBe(expiry);
      expect(guide.recommendedChartType).toBe('line');
      expect(guide.avoidChartTypes).toContain('heikin-ashi');
    });
  }

  it('30s preset uses wider Bollinger period', () => {
    const p30 = getPreset(30);
    const p5 = getPreset(5);
    expect(p30.bollinger.period).toBeGreaterThan(p5.bollinger.period);
    expect(p30.stochastic.kPeriod).toBeGreaterThan(p5.stochastic.kPeriod);
  });

  it('defaults signal threshold settings', () => {
    const preset = getPreset(5);
    expect(preset.stochastic.crossValidityBars).toBe(3);
    expect(preset.market.minimumSignalConfidence).toBe(70);
    expect(preset.market.minimumSignalEdge).toBe(5);
    expect(preset.cci.enabled).toBe(true);
    expect(preset.cci.period).toBe(14);
    expect(preset.cci.overbought).toBe(100);
    expect(preset.cci.oversold).toBe(-100);
    expect(preset.autoTrade.enabled).toBe(false);
    expect(preset.autoTrade.dryRun).toBe(true);
    expect(preset.autoTrade.useCanvas).toBe(true);
    expect(preset.autoTrade.clickEngine).toBe('native');
    expect(preset.autoTrade.canvas.higherXPercent).toBe(88);
    expect(preset.market.signalCooldownSec).toBe(5);
    expect(preset.market.signalDebugMode).toBe(true);
    expect(preset.movingAverage.fastPeriod).toBe(9);
    expect(preset.movingAverage.slowPeriod).toBe(21);
    expect(preset.movingAverage.type).toBe('ema');
  });

  it('validation preserves tradeExpirySec', () => {
    const preset = getPreset(15);
    const validated = validateSettings(preset);
    expect(validated.market.tradeExpirySec).toBe(15);
    expect(validated.market.candleIntervalSec).toBe(15);
    expect(validated.stochastic.crossValidityBars).toBe(3);
  });

  it('validation infers tradeExpirySec from legacy candleIntervalSec', () => {
    const legacy = {
      ...getPreset(10),
      market: { candleIntervalSec: 10, signalHoldSec: 2 } as never,
    };
    const validated = validateSettings(legacy);
    expect(validated.market.tradeExpirySec).toBe(10);
    expect(validated.market.candleIntervalSec).toBe(10);
  });
});
