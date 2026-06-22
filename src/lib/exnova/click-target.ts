import type { AutoTradeSettings, Signal } from '../../types';
import {
  buttonCenter,
  elementLabel,
  searchDocuments,
  viewportToScreen,
} from './exnova-dom-finder';
import {
  canvasPointFromPercent,
  canvasTargetFor,
  findGlCanvas,
  formatCanvasTarget,
} from './canvas-click';

export interface ClickTarget {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  method: 'dom' | 'canvas';
  label: string;
}

export function resolveClickTarget(
  signal: 'HIGHER' | 'LOWER',
  autoTrade: AutoTradeSettings,
  doc: Document = document,
): ClickTarget | null {
  const button = searchDocuments(doc, signal);
  if (button) {
    const center = buttonCenter(button);
    const screen = viewportToScreen(center.x, center.y);
    return {
      clientX: center.x,
      clientY: center.y,
      screenX: screen.x,
      screenY: screen.y,
      method: 'dom',
      label: `${signal} DOM (${elementLabel(button) || 'button'})`,
    };
  }

  if (!autoTrade.useCanvas) return null;

  const canvas = findGlCanvas(doc);
  if (!canvas) return null;

  const { xPercent, yPercent } = canvasTargetFor(signal, autoTrade);
  const point = canvasPointFromPercent(canvas.getBoundingClientRect(), xPercent, yPercent);
  const screen = viewportToScreen(point.clientX, point.clientY);

  return {
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: screen.x,
    screenY: screen.y,
    method: 'canvas',
    label: formatCanvasTarget(signal, xPercent, yPercent),
  };
}

export function describeTarget(signal: Signal, target: ClickTarget): string {
  return `${target.method === 'dom' ? 'DOM' : 'canvas'} ${signal} @ ${target.clientX.toFixed(0)}, ${target.clientY.toFixed(0)}`;
}
