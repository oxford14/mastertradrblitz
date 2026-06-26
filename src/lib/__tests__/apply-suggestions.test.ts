import { describe, expect, it } from 'vitest';
import {
  applySettingsPatch,
  filterWhitelistedPatch,
  sanitizePatch,
  SETTINGS_PATCH_WHITELIST,
} from '../ai/apply-suggestions';
import { DEFAULT_SETTINGS } from '../settings/defaults';

describe('apply-suggestions', () => {
  it('filters non-whitelisted keys', () => {
    const patch = filterWhitelistedPatch({
      'market.minimumSignalConfidence': 80,
      'autoTrade.enabled': true,
      'rsi.oversold': 25,
    });
    expect(patch).toEqual({
      'market.minimumSignalConfidence': 80,
      'rsi.oversold': 25,
    });
    expect(patch['autoTrade.enabled']).toBeUndefined();
  });

  it('limits patch keys per trade', () => {
    const patch = filterWhitelistedPatch(
      {
        'market.minimumSignalConfidence': 80,
        'market.minimumSignalEdge': 10,
        'rsi.oversold': 25,
      },
      2,
    );
    expect(Object.keys(patch)).toHaveLength(2);
  });

  it('applies valid patch through validateSettings', () => {
    const { settings, applied } = applySettingsPatch(DEFAULT_SETTINGS, {
      'market.minimumSignalConfidence': 80,
      'market.minimumSignalEdge': 10,
    });
    expect(settings.market.minimumSignalConfidence).toBe(80);
    expect(settings.market.minimumSignalEdge).toBe(10);
    expect(applied.length).toBeGreaterThan(0);
  });

  it('rejects invalid enum values in sanitizePatch', () => {
    const patch = sanitizePatch({
      'market.minimumSignalConfidence': 77,
      'market.minimumSignalEdge': 10,
    });
    expect(patch['market.minimumSignalConfidence']).toBeUndefined();
    expect(patch['market.minimumSignalEdge']).toBe(10);
  });

  it('whitelist contains expected paths', () => {
    expect(SETTINGS_PATCH_WHITELIST.has('market.minimumSignalConfidence')).toBe(true);
    expect(SETTINGS_PATCH_WHITELIST.has('autoTrade.enabled')).toBe(false);
  });
});
