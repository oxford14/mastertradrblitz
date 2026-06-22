/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import { findTradeButton } from '../exnova/exnova-dom-finder';

describe('findTradeButton (Exnova)', () => {
  it('finds HIGHER on a plain div in the trading panel', () => {
    document.body.innerHTML = `
      <div id="mtb-overlay-root"></div>
      <div id="panel" style="position:absolute;left:900px;top:400px;width:120px;height:48px">
        <div class="trade-btn">HIGHER</div>
      </div>
    `;
    const panel = document.getElementById('panel') as HTMLDivElement;
    panel.getBoundingClientRect = () =>
      ({
        left: 900,
        top: 400,
        width: 120,
        height: 48,
        right: 1020,
        bottom: 448,
        x: 900,
        y: 400,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    const el = findTradeButton('HIGHER', document);
    expect(el?.textContent?.trim()).toBe('HIGHER');
  });

  it('ignores overlay elements', () => {
    document.body.innerHTML = `
      <div id="mtb-overlay-root">
        <div style="width:120px;height:48px">HIGHER</div>
      </div>
    `;
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    expect(findTradeButton('HIGHER', document)).toBeNull();
  });
});
