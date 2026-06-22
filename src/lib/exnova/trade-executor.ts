import type { AutoTradeSettings, AutoTradeClickEngine, ProbeResult } from '../../types';
import { requestCanvasClick, requestPageClick } from './canvas-click-bridge';
import { resolveClickTarget } from './click-target';
import { searchDocuments } from './exnova-dom-finder';
import { findGlCanvas, canvasTargetFor } from './canvas-click';
import { requestTrustedClick } from './trusted-click-client';

export interface TradeExecutionResult {
  ok: boolean;
  dryRun: boolean;
  message: string;
  method?: 'dom' | 'canvas' | 'debugger' | 'native' | 'synthetic';
}

export async function executeTrade(
  signal: 'HIGHER' | 'LOWER',
  dryRun: boolean,
  autoTrade: AutoTradeSettings,
  doc: Document = document,
): Promise<TradeExecutionResult> {
  const target = resolveClickTarget(signal, autoTrade, doc);
  if (!target) {
    return {
      ok: false,
      dryRun,
      message: `${signal} target not found (no DOM button or #glcanvas)`,
    };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      method: target.method,
      message: `Dry run: would click ${target.label}`,
    };
  }

  const engine = autoTrade.clickEngine;

  if (engine === 'synthetic') {
    if (target.method === 'canvas') {
      const { xPercent, yPercent } = canvasTargetFor(signal, autoTrade);
      const bridge = await requestCanvasClick(xPercent, yPercent);
      if (!bridge.ok) {
        return {
          ok: false,
          dryRun: false,
          method: 'synthetic',
          message: `${target.label} — ${bridge.message}`,
        };
      }
      const suffix =
        bridge.hitCanvas === false ? ' (overlay may be blocking hit-test)' : '';
      return {
        ok: true,
        dryRun: false,
        method: 'synthetic',
        message: `Sent synthetic canvas click ${target.label}${suffix}`,
      };
    }

    const bridge = await requestPageClick(target.clientX, target.clientY);
    if (!bridge.ok) {
      return {
        ok: false,
        dryRun: false,
        method: 'synthetic',
        message: `${target.label} — ${bridge.message}`,
      };
    }
    const suffix =
      bridge.hitCanvas === false ? ' (overlay may be blocking hit-test)' : '';
    return {
      ok: true,
      dryRun: false,
      method: 'synthetic',
      message: `Sent synthetic click ${target.label}${suffix}`,
    };
  }

  const trusted = await requestTrustedClick(
    target.clientX,
    target.clientY,
    target.screenX,
    target.screenY,
    engine,
  );

  return {
    ok: trusted.ok,
    dryRun: false,
    method: engine,
    message: trusted.ok
      ? `Trusted ${engine} click — ${target.label}`
      : `${target.label} — ${trusted.message}`,
  };
}

export function probeTradeTargets(
  autoTrade: AutoTradeSettings,
  doc: Document = document,
): ProbeResult {
  const domHigher = searchDocuments(doc, 'HIGHER');
  const domLower = searchDocuments(doc, 'LOWER');
  const canvas = autoTrade.useCanvas ? findGlCanvas(doc) : null;
  const higherTarget = resolveClickTarget('HIGHER', autoTrade, doc);
  const lowerTarget = resolveClickTarget('LOWER', autoTrade, doc);

  const engineNote =
    autoTrade.clickEngine === 'debugger'
      ? ' · trusted clicks via Chrome debugger'
      : autoTrade.clickEngine === 'native'
        ? ' · trusted clicks via native helper'
        : ' · synthetic clicks (may not register on Exnova)';

  if (domHigher && domLower) {
    return {
      higher: true,
      lower: true,
      canvasFound: canvas !== null,
      method: 'dom',
      message: `DOM buttons found for HIGHER and LOWER${engineNote}`,
    };
  }

  if (higherTarget && lowerTarget) {
    return {
      higher: true,
      lower: true,
      canvasFound: canvas !== null,
      method: higherTarget.method,
      message: `${higherTarget.method === 'dom' ? 'DOM' : 'Canvas'} targets — HIGHER (${higherTarget.clientX.toFixed(0)}, ${higherTarget.clientY.toFixed(0)}) · LOWER (${lowerTarget.clientX.toFixed(0)}, ${lowerTarget.clientY.toFixed(0)})${engineNote}`,
    };
  }

  const parts = [
    domHigher ? 'HIGHER DOM found' : 'HIGHER not found',
    domLower ? 'LOWER DOM found' : 'LOWER not found',
    canvas ? '#glcanvas found' : 'no #glcanvas',
  ];
  return {
    higher: Boolean(domHigher || higherTarget),
    lower: Boolean(domLower || lowerTarget),
    canvasFound: canvas !== null,
    method: 'none',
    message: parts.join(' · ') + engineNote,
  };
}

export function clickEngineLabel(engine: AutoTradeClickEngine): string {
  switch (engine) {
    case 'debugger':
      return 'Chrome debugger (trusted, no helper app)';
    case 'native':
      return 'Native helper (OS-level clicks)';
    default:
      return 'Synthetic DOM/canvas (legacy)';
  }
}
