import type { AutoTradeSettings, Signal } from '../../types';

export const GL_CANVAS_ID = 'glcanvas';

export interface CanvasPoint {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasClickResult {
  hitCanvas: boolean;
  message: string;
}

export function canvasPointFromPercent(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  xPercent: number,
  yPercent: number,
): CanvasPoint {
  const x = Math.min(100, Math.max(0, xPercent)) / 100;
  const y = Math.min(100, Math.max(0, yPercent)) / 100;
  const offsetX = rect.width * x;
  const offsetY = rect.height * y;
  return {
    clientX: rect.left + offsetX,
    clientY: rect.top + offsetY,
    offsetX,
    offsetY,
  };
}

function isVisibleCanvas(canvas: HTMLCanvasElement): boolean {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(canvas);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function findGlCanvas(doc: Document): HTMLCanvasElement | null {
  const candidates: HTMLCanvasElement[] = [];

  const direct = doc.getElementById(GL_CANVAS_ID);
  if (direct instanceof HTMLCanvasElement) candidates.push(direct);

  for (const node of doc.querySelectorAll(`canvas#${GL_CANVAS_ID}, canvas.topleft`)) {
    if (node instanceof HTMLCanvasElement && !candidates.includes(node)) {
      candidates.push(node);
    }
  }

  const visible = candidates.filter(isVisibleCanvas);
  const pool = visible.length > 0 ? visible : candidates;
  const active = pool.find((c) => c.classList.contains('active'));
  if (active) return active;
  if (pool.length > 0) return pool[0];

  const iframes = doc.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const nested = iframe.contentDocument;
      if (!nested) continue;
      const found = findGlCanvas(nested);
      if (found) return found;
    } catch {
      // Cross-origin iframe — skip.
    }
  }

  return null;
}

export function canvasTargetFor(
  signal: 'HIGHER' | 'LOWER',
  settings: AutoTradeSettings,
): { xPercent: number; yPercent: number } {
  return signal === 'HIGHER'
    ? {
        xPercent: settings.canvas.higherXPercent,
        yPercent: settings.canvas.higherYPercent,
      }
    : {
        xPercent: settings.canvas.lowerXPercent,
        yPercent: settings.canvas.lowerYPercent,
      };
}

function eventInit(point: CanvasPoint, buttons: number): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: point.clientX + window.screenX,
    screenY: point.clientY + window.screenY,
    button: 0,
    buttons,
    detail: 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    width: 1,
    height: 1,
    pressure: buttons ? 0.5 : 0,
  };
}

function mouseInit(point: CanvasPoint, buttons: number): MouseEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: point.clientX,
    clientY: point.clientY,
    screenX: point.clientX + window.screenX,
    screenY: point.clientY + window.screenY,
    button: 0,
    buttons,
    detail: 1,
  };
}

function dispatchOnTarget(
  target: EventTarget,
  type: string,
  point: CanvasPoint,
  buttons: number,
): void {
  if (type.startsWith('pointer')) {
    target.dispatchEvent(new PointerEvent(type, eventInit(point, buttons)));
    return;
  }
  target.dispatchEvent(new MouseEvent(type, mouseInit(point, buttons)));
}

function clickTargetChain(root: Element): EventTarget[] {
  const chain: EventTarget[] = [];
  let node: Element | null = root;
  while (node) {
    chain.push(node);
    node = node.parentElement;
  }
  chain.push(window, document);
  return chain;
}

function clickTargets(canvas: HTMLCanvasElement): EventTarget[] {
  return clickTargetChain(canvas);
}

function dispatchPointerSequence(targets: EventTarget[], point: CanvasPoint): void {
  for (const target of targets) {
    dispatchOnTarget(target, 'pointerover', point, 0);
    dispatchOnTarget(target, 'pointerenter', point, 0);
    dispatchOnTarget(target, 'mouseover', point, 0);
    dispatchOnTarget(target, 'pointermove', point, 0);
    dispatchOnTarget(target, 'mousemove', point, 0);
  }

  for (const target of targets) {
    dispatchOnTarget(target, 'pointerdown', point, 1);
    dispatchOnTarget(target, 'mousedown', point, 1);
  }

  for (const target of targets) {
    dispatchOnTarget(target, 'pointerup', point, 0);
    dispatchOnTarget(target, 'mouseup', point, 0);
    dispatchOnTarget(target, 'click', point, 0);
  }
}

/** Dispatch a full pointer/mouse sequence in the page (MAIN) context. */
export function dispatchCanvasClickInPage(
  canvas: HTMLCanvasElement,
  xPercent: number,
  yPercent: number,
): CanvasClickResult {
  const rect = canvas.getBoundingClientRect();
  const point = canvasPointFromPercent(rect, xPercent, yPercent);
  const targets = clickTargets(canvas);

  if (typeof canvas.focus === 'function') {
    canvas.focus({ preventScroll: true });
  }

  dispatchPointerSequence(targets, point);

  const atPoint = document.elementFromPoint(point.clientX, point.clientY);
  const hitCanvas =
    atPoint === canvas ||
    (atPoint instanceof Node && canvas.contains(atPoint));

  return {
    hitCanvas,
    message: hitCanvas
      ? 'Canvas click sent in page context'
      : 'Click sent but coordinates may be blocked by overlay — adjust position or move overlay',
  };
}

/** Click whatever element sits at viewport coordinates in page context. */
export function dispatchClickAtPoint(
  clientX: number,
  clientY: number,
): CanvasClickResult {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) {
    return {
      hitCanvas: false,
      message: 'No element at coordinates',
    };
  }

  if (
    el instanceof HTMLCanvasElement &&
    (el.id === GL_CANVAS_ID || el.classList.contains('topleft'))
  ) {
    const rect = el.getBoundingClientRect();
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    return dispatchCanvasClickInPage(el, xPercent, yPercent);
  }

  const point: CanvasPoint = {
    clientX,
    clientY,
    offsetX: clientX,
    offsetY: clientY,
  };

  if (el instanceof HTMLElement && typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
  }

  dispatchPointerSequence(clickTargetChain(el), point);

  const atPoint = document.elementFromPoint(clientX, clientY);
  return {
    hitCanvas: atPoint === el || (atPoint instanceof Node && el.contains(atPoint)),
    message:
      atPoint === el || (atPoint instanceof Node && el.contains(atPoint))
        ? 'DOM click sent in page context'
        : 'Click sent but coordinates may be blocked by overlay',
  };
}

export function formatCanvasTarget(
  signal: Signal,
  xPercent: number,
  yPercent: number,
): string {
  return `${signal} @ ${xPercent.toFixed(1)}%, ${yPercent.toFixed(1)}%`;
}
