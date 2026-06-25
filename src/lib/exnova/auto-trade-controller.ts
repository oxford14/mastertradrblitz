import type { AppSettings, AutoTradeStatus, ProbeResult, Signal } from '../../types';
import { executeTrade, probeTradeTargets } from './trade-executor';

const defaultStatus = (): AutoTradeStatus => ({
  action: 'none',
  signal: 'WAIT',
  message: 'Auto-trade off',
  at: 0,
});

export class AutoTradeController {
  private status: AutoTradeStatus = defaultStatus();
  private settings: AppSettings | null = null;

  updateSettings(settings: AppSettings): void {
    this.settings = settings;
    if (!settings.autoTrade.enabled) {
      this.status = defaultStatus();
    }
  }

  getStatus(): AutoTradeStatus {
    return this.status;
  }

  async onTradeConfirmed(
    signal: Signal,
    warmedUp: boolean,
  ): Promise<AutoTradeStatus> {
    if (signal !== 'HIGHER' && signal !== 'LOWER') return this.status;
    if (!this.settings?.autoTrade.enabled) return this.status;

    const { dryRun } = this.settings.autoTrade;

    if (!warmedUp) {
      this.status = {
        action: 'skipped',
        signal,
        message: 'Skipped — indicators still warming up',
        at: Date.now(),
      };
      return this.status;
    }

    const result = await executeTrade(signal, dryRun, this.settings.autoTrade, document);
    this.status = {
      action: result.ok ? (result.dryRun ? 'dry_run' : 'clicked') : 'error',
      signal,
      message: result.message,
      at: Date.now(),
    };
    return this.status;
  }

  probeButtons(): ProbeResult {
    if (!this.settings) {
      return {
        higher: false,
        lower: false,
        canvasFound: false,
        method: 'none',
        message: 'Settings not loaded',
      };
    }
    return probeTradeTargets(this.settings.autoTrade, document);
  }
}
