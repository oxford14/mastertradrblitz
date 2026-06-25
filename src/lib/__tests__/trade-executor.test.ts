/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeTrade, probeTradeTargets } from '../exnova/trade-executor';
import { findTradeButton } from '../exnova/exnova-dom-finder';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import * as trustedClickClient from '../exnova/trusted-click-client';

const nativeAutoTrade = DEFAULT_SETTINGS.autoTrade;

function mountTradeButtons(): void {
  document.body.innerHTML = `
    <div id="app">
      <button type="button" id="higher">Higher</button>
      <button type="button" id="lower">Lower</button>
    </div>
  `;
}

function mountGlCanvas(): HTMLCanvasElement {
  document.body.innerHTML =
    '<canvas class="topleft active" id="glcanvas" width="1640" height="2360"></canvas>';
  const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;
  canvas.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 820,
      height: 1180,
      right: 820,
      bottom: 1180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  return canvas;
}

describe('findTradeButton', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds Higher button by label', () => {
    mountTradeButtons();
    expect(findTradeButton('HIGHER', document)?.id).toBe('higher');
  });
});

describe('executeTrade', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('native dry run does not call trusted click', async () => {
    const trustedSpy = vi.spyOn(trustedClickClient, 'requestTrustedClick');
    const result = await executeTrade('LOWER', true, nativeAutoTrade, document);
    expect(trustedSpy).not.toHaveBeenCalled();
    expect(result.message).toContain('calibrated LOWER');
    expect(result.method).toBe('native');
  });

  it('native engine sends signal to trusted click client', async () => {
    const trustedSpy = vi.spyOn(trustedClickClient, 'requestTrustedClick').mockResolvedValue({
      ok: true,
      message: 'clicked HIGHER @ 100, 200',
    });
    const result = await executeTrade('HIGHER', false, nativeAutoTrade, document);
    expect(trustedSpy).toHaveBeenCalledWith({ signal: 'HIGHER' });
    expect(result.ok).toBe(true);
    expect(result.method).toBe('native');
  });
});

describe('probeTradeTargets', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports calibrator hint for native engine', () => {
    const result = probeTradeTargets(nativeAutoTrade, document);
    expect(result.message).toContain('calibrate');
    expect(result.higher).toBe(true);
    expect(result.lower).toBe(true);
  });

  it('notes when glcanvas is present', () => {
    mountGlCanvas();
    const result = probeTradeTargets(nativeAutoTrade, document);
    expect(result.canvasFound).toBe(true);
  });
});
