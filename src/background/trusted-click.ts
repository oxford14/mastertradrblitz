const NATIVE_HOST = 'com.mastertraderblitz.click';

export interface TrustedClickRequest {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  engine: 'debugger' | 'native' | 'synthetic';
}

export interface TrustedClickResponse {
  ok: boolean;
  message: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debuggerClick(
  tabId: number,
  clientX: number,
  clientY: number,
): Promise<TrustedClickResponse> {
  const target = { tabId };

  try {
    await chrome.debugger.attach(target, '1.3');
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Debugger attach failed: ${error.message}`
          : 'Debugger attach failed',
    };
  }

  try {
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: clientX,
      y: clientY,
    });
    await sleep(30);
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });
    await sleep(20);
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: clientX,
      y: clientY,
      button: 'left',
      clickCount: 1,
    });
    return {
      ok: true,
      message: `Trusted click at ${clientX}, ${clientY}`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Debugger click failed: ${error.message}`
          : 'Debugger click failed',
    };
  } finally {
    try {
      await chrome.debugger.detach(target);
    } catch {
      // Ignore detach errors.
    }
  }
}

function sendNativeMessage(payload: object): Promise<TrustedClickResponse> {
  return new Promise((resolve) => {
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST);
      let settled = false;

      const finish = (result: TrustedClickResponse) => {
        if (settled) return;
        settled = true;
        try {
          port.disconnect();
        } catch {
          // Ignore disconnect errors.
        }
        resolve(result);
      };

      port.onMessage.addListener((message) => {
        finish({
          ok: Boolean((message as { ok?: boolean }).ok),
          message: String((message as { message?: string }).message ?? 'Native click sent'),
        });
      });

      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError && !settled) {
          finish({ ok: false, message: chrome.runtime.lastError.message ?? 'Native host disconnected' });
          return;
        }
        if (!settled) {
          finish({ ok: false, message: 'Native host disconnected without response' });
        }
      });

      port.postMessage(payload);
    } catch (error) {
      resolve({
        ok: false,
        message: error instanceof Error ? error.message : 'Native messaging failed',
      });
    }
  });
}

async function nativeClick(
  screenX: number,
  screenY: number,
): Promise<TrustedClickResponse> {
  return sendNativeMessage({
    action: 'click',
    x: screenX,
    y: screenY,
  });
}

export async function dispatchTrustedClick(
  tabId: number,
  request: TrustedClickRequest,
): Promise<TrustedClickResponse> {
  if (request.engine === 'native') {
    return nativeClick(request.screenX, request.screenY);
  }

  if (request.engine === 'debugger') {
    return debuggerClick(tabId, request.clientX, request.clientY);
  }

  return {
    ok: false,
    message: 'Synthetic clicks are handled in the content script',
  };
}

export async function pingNativeHelper(): Promise<TrustedClickResponse> {
  return sendNativeMessage({ action: 'ping' });
}
