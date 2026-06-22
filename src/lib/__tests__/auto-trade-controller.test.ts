/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutoTradeController } from '../exnova/auto-trade-controller';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import * as tradeExecutor from '../exnova/trade-executor';

describe('AutoTradeController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('skips when auto-trade disabled', () => {
    const controller = new AutoTradeController();
    controller.updateSettings(DEFAULT_SETTINGS);
    controller.onTradeConfirmed('HIGHER', true);
    expect(controller.getStatus().action).toBe('none');
  });

  it('executes dry run when enabled', async () => {
    vi.spyOn(tradeExecutor, 'executeTrade').mockResolvedValue({
      ok: true,
      dryRun: true,
      message: 'Dry run: would click HIGHER',
    });
    const controller = new AutoTradeController();
    controller.updateSettings({
      ...DEFAULT_SETTINGS,
      autoTrade: { ...DEFAULT_SETTINGS.autoTrade, enabled: true, dryRun: true },
    });
    await controller.onTradeConfirmed('HIGHER', true);
    expect(tradeExecutor.executeTrade).toHaveBeenCalled();
    expect(controller.getStatus().action).toBe('dry_run');
  });

  it('skips when not warmed up', async () => {
    const controller = new AutoTradeController();
    controller.updateSettings({
      ...DEFAULT_SETTINGS,
      autoTrade: { ...DEFAULT_SETTINGS.autoTrade, enabled: true, dryRun: false },
    });
    await controller.onTradeConfirmed('LOWER', false);
    expect(controller.getStatus().action).toBe('skipped');
  });
});
