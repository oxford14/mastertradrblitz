export interface CanvasClickBridgeResult {
  ok: boolean;
  hitCanvas?: boolean;
  message: string;
}

const CLICK_REQUEST = 'mtb-canvas-click-request';
const CLICK_RESULT = 'mtb-canvas-click-result';
const PAGE_CLICK_REQUEST = 'mtb-page-click-request';
const PAGE_CLICK_RESULT = 'mtb-page-click-result';
const DEFAULT_TIMEOUT_MS = 750;

let nextId = 0;

type CanvasClickHandler = (
  xPercent: number,
  yPercent: number,
) => Promise<CanvasClickBridgeResult>;

let handler: CanvasClickHandler = requestCanvasClickViaPostMessage;

export async function requestPageClick(
  clientX: number,
  clientY: number,
): Promise<CanvasClickBridgeResult> {
  return postMessageBridge(PAGE_CLICK_REQUEST, PAGE_CLICK_RESULT, {
    clientX,
    clientY,
  });
}

function postMessageBridge(
  requestSource: string,
  resultSource: string,
  payload: Record<string, number>,
): Promise<CanvasClickBridgeResult> {
  return new Promise((resolve) => {
    const id = ++nextId;
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onResult);
      resolve({
        ok: false,
        message: 'Page bridge timeout — reload Exnova tab after updating extension',
      });
    }, DEFAULT_TIMEOUT_MS);

    const onResult = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (
        typeof data !== 'object' ||
        data === null ||
        (data as { source?: string }).source !== resultSource ||
        (data as { id?: number }).id !== id
      ) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener('message', onResult);
      resolve({
        ok: Boolean((data as { ok?: boolean }).ok),
        hitCanvas: (data as { hitCanvas?: boolean }).hitCanvas,
        message: String((data as { message?: string }).message ?? 'Click sent'),
      });
    };

    window.addEventListener('message', onResult);
    window.postMessage({ source: requestSource, id, ...payload }, '*');
  });
}

function requestCanvasClickViaPostMessage(
  xPercent: number,
  yPercent: number,
): Promise<CanvasClickBridgeResult> {
  return postMessageBridge(CLICK_REQUEST, CLICK_RESULT, {
    xPercent,
    yPercent,
  });
}

/** Test hook — bypass postMessage in unit tests. */
export function setCanvasClickHandler(next: CanvasClickHandler): void {
  handler = next;
}

export function resetCanvasClickHandler(): void {
  handler = requestCanvasClickViaPostMessage;
}

export async function requestCanvasClick(
  xPercent: number,
  yPercent: number,
): Promise<CanvasClickBridgeResult> {
  return handler(xPercent, yPercent);
}
