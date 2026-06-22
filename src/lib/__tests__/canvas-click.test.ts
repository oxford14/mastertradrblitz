/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import {
  canvasPointFromPercent,
  dispatchCanvasClickInPage,
  findGlCanvas,
} from '../exnova/canvas-click';

describe('canvasPointFromPercent', () => {
  it('maps percent to client and offset coordinates', () => {
    const point = canvasPointFromPercent(
      { left: 100, top: 50, width: 200, height: 400 },
      50,
      25,
    );
    expect(point.clientX).toBe(200);
    expect(point.clientY).toBe(150);
    expect(point.offsetX).toBe(100);
    expect(point.offsetY).toBe(100);
  });

  it('clamps percent to 0-100', () => {
    const point = canvasPointFromPercent(
      { left: 0, top: 0, width: 100, height: 100 },
      150,
      -10,
    );
    expect(point.offsetX).toBe(100);
    expect(point.offsetY).toBe(0);
  });
});

describe('findGlCanvas', () => {
  it('prefers active visible canvas', () => {
    document.body.innerHTML = `
      <canvas class="topleft" width="10" height="10"></canvas>
      <canvas class="topleft active" id="glcanvas" width="10" height="10"></canvas>
    `;
    const found = findGlCanvas(document);
    expect(found?.classList.contains('active')).toBe(true);
  });
});

describe('dispatchCanvasClickInPage', () => {
  it('dispatches pointer and mouse events on canvas', () => {
    document.body.innerHTML =
      '<canvas class="topleft active" id="glcanvas" width="100" height="100"></canvas>';
    const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
        right: 100,
        bottom: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    const types: string[] = [];
    canvas.addEventListener('pointerdown', () => types.push('pointerdown'));
    canvas.addEventListener('click', () => types.push('click'));

    const result = dispatchCanvasClickInPage(canvas, 50, 50);
    expect(types).toContain('pointerdown');
    expect(types).toContain('click');
    expect(result.message).toContain('Click sent');
  });
});
