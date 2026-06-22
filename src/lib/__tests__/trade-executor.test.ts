/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  executeTrade,
  probeTradeTargets,
} from '../exnova/trade-executor';
import { findTradeButton } from '../exnova/exnova-dom-finder';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import {
  dispatchCanvasClickInPage,
  findGlCanvas,
} from '../exnova/canvas-click';
import {
  resetCanvasClickHandler,
  setCanvasClickHandler,
} from '../exnova/canvas-click-bridge';

const autoTrade = {
  ...DEFAULT_SETTINGS.autoTrade,
  clickEngine: 'synthetic' as const,
};

function mountTradeButtons(): void {
  document.body.innerHTML = `
    <div id="app">
      <button type="button" id="higher">Higher</button>
      <button type="button" id="lower">Lower</button>
    </div>
  `;
  for (const id of ['higher', 'lower']) {
    const el = document.getElementById(id) as HTMLButtonElement;
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        width: 80,
        height: 40,
        right: 180,
        bottom: 140,
        x: 100,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
  }
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

function installPageBridgeStub(): void {
  setCanvasClickHandler(async (xPercent, yPercent) => {
    const canvas = findGlCanvas(document);
    if (!canvas) {
      return { ok: false, message: '#glcanvas not found' };
    }
    const result = dispatchCanvasClickInPage(canvas, xPercent, yPercent);
    return { ok: true, hitCanvas: result.hitCanvas, message: result.message };
  });
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
    installPageBridgeStub();
  });

  afterEach(() => {
    resetCanvasClickHandler();
  });

  it('dry run does not click DOM button', async () => {
    mountTradeButtons();
    const higher = document.getElementById('higher') as HTMLButtonElement;
    const clickSpy = vi.spyOn(higher, 'click');
    const result = await executeTrade('HIGHER', true, autoTrade, document);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('dom');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('uses canvas when no DOM buttons', async () => {
    mountGlCanvas();
    const result = await executeTrade('HIGHER', true, autoTrade, document);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('canvas');
    expect(result.message).toContain('HIGHER');
  });

  it('dispatches pointer events on canvas click via page bridge', async () => {
    const canvas = mountGlCanvas();
    const dispatchSpy = vi.spyOn(canvas, 'dispatchEvent');
    const result = await executeTrade('LOWER', false, autoTrade, document);
    expect(result.ok).toBe(true);
    expect(result.method).toBe('synthetic');
    expect(result.message).toContain('Sent synthetic');
    expect(dispatchSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});

describe('probeTradeTargets', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports canvas mode when glcanvas present', () => {
    mountGlCanvas();
    const result = probeTradeTargets(autoTrade, document);
    expect(result.higher).toBe(true);
    expect(result.lower).toBe(true);
    expect(result.canvasFound).toBe(true);
    expect(result.message).toContain('Canvas targets');
  });
});
