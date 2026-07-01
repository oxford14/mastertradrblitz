import {
  dispatchCanvasClickInPage,
  dispatchClickAtPoint,
  findGlCanvas,
} from '../lib/exnova/canvas-click';

function isTraderoomPage(): boolean {
  return window.location.pathname.toLowerCase().includes('/traderoom');
}

const CANVAS_CLICK_REQUEST = 'mtb-canvas-click-request';
const CANVAS_CLICK_RESULT = 'mtb-canvas-click-result';
const PAGE_CLICK_REQUEST = 'mtb-page-click-request';
const PAGE_CLICK_RESULT = 'mtb-page-click-result';

if (isTraderoomPage()) {
  window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (typeof data !== 'object' || data === null) return;

  const source = (data as { source?: string }).source;

  if (source === CANVAS_CLICK_REQUEST) {
    const { id, xPercent, yPercent } = data as {
      id: number;
      xPercent: number;
      yPercent: number;
    };

    const canvas = findGlCanvas(document);
    if (!canvas) {
      window.postMessage(
        {
          source: CANVAS_CLICK_RESULT,
          id,
          ok: false,
          hitCanvas: false,
          message: '#glcanvas not found',
        },
        '*',
      );
      return;
    }

    const result = dispatchCanvasClickInPage(canvas, xPercent, yPercent);
    window.postMessage(
      {
        source: CANVAS_CLICK_RESULT,
        id,
        ok: true,
        hitCanvas: result.hitCanvas,
        message: result.message,
      },
      '*',
    );
    return;
  }

  if (source === PAGE_CLICK_REQUEST) {
    const { id, clientX, clientY } = data as {
      id: number;
      clientX: number;
      clientY: number;
    };

    const result = dispatchClickAtPoint(clientX, clientY);
    window.postMessage(
      {
        source: PAGE_CLICK_RESULT,
        id,
        ok: true,
        hitCanvas: result.hitCanvas,
        message: result.message,
      },
      '*',
    );
  }
  });
}
