import type { AutoTradeSettings, ProbeResult } from '../../types';
import { findGlCanvas } from './canvas-click';
import { requestTrustedClick } from './trusted-click-client';

export interface TradeExecutionResult {
  ok: boolean;
  dryRun: boolean;
  message: string;
  method?: 'native';
}

export async function executeTrade(
  signal: 'HIGHER' | 'LOWER',
  dryRun: boolean,
  autoTrade: AutoTradeSettings,
  _doc: Document = document,
): Promise<TradeExecutionResult> {
  void autoTrade;
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      method: 'native',
      message: `Dry run: would click calibrated ${signal}`,
    };
  }

  const trusted = await requestTrustedClick({ signal });
  return {
    ok: trusted.ok,
    dryRun: false,
    method: 'native',
    message: trusted.ok ? trusted.message : `${signal} — ${trusted.message}`,
  };
}

export function probeTradeTargets(
  autoTrade: AutoTradeSettings,
  doc: Document = document,
): ProbeResult {
  const canvas = autoTrade.useCanvas ? findGlCanvas(doc) : null;

  return {
    higher: true,
    lower: true,
    canvasFound: canvas !== null,
    method: 'dom',
    message:
      'Native helper mode — calibrate with MtbClickHelper.exe --calibrate, then Ping · native helper uses calibrated screen coords (run calibrator)',
  };
}

export function clickEngineLabel(): string {
  return 'Native VB helper (calibrated screen clicks)';
}
