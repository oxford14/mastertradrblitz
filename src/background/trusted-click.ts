const NATIVE_HOST = 'com.mastertraderblitz.click';

export interface TrustedClickRequest {
  signal?: 'HIGHER' | 'LOWER';
  engine: 'native';
  tabId?: number;
}

export interface NativeTargetPoint {
  x: number;
  y: number;
}

export interface TrustedClickResponse {
  ok: boolean;
  message: string;
  higher?: NativeTargetPoint;
  lower?: NativeTargetPoint;
  amount?: NativeTargetPoint;
  updatedAt?: string;
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
        const data = message as {
          ok?: boolean;
          message?: string;
          higher?: NativeTargetPoint;
          lower?: NativeTargetPoint;
          amount?: NativeTargetPoint;
          updatedAt?: string;
        };
        finish({
          ok: Boolean(data.ok),
          message: String(data.message ?? 'Native message sent'),
          higher: data.higher,
          lower: data.lower,
          amount: data.amount,
          updatedAt: data.updatedAt,
        });
      });

      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError && !settled) {
          finish({
            ok: false,
            message: chrome.runtime.lastError.message ?? 'Native host disconnected',
          });
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

async function nativeClick(signal?: 'HIGHER' | 'LOWER'): Promise<TrustedClickResponse> {
  if (!signal) {
    return {
      ok: false,
      message: 'Native click requires HIGHER or LOWER signal',
    };
  }

  return sendNativeMessage({
    action: 'click',
    signal,
  });
}

export async function dispatchTrustedClick(
  request: TrustedClickRequest,
): Promise<TrustedClickResponse> {
  return nativeClick(request.signal);
}

export async function pingNativeHelper(): Promise<TrustedClickResponse> {
  const ping = await sendNativeMessage({ action: 'ping' });
  if (!ping.ok) return ping;

  const targets = await sendNativeMessage({ action: 'getTargets' });
  if (targets.ok && targets.higher && targets.lower) {
    const parts = [
      `HIGHER @ ${targets.higher.x}, ${targets.higher.y}`,
      `LOWER @ ${targets.lower.x}, ${targets.lower.y}`,
    ];
    if (targets.amount) {
      parts.push(`AMOUNT @ ${targets.amount.x}, ${targets.amount.y}`);
    } else {
      parts.push('AMOUNT not calibrated');
    }
    return {
      ok: true,
      message: `pong — ${parts.join(' · ')}`,
      higher: targets.higher,
      lower: targets.lower,
      amount: targets.amount,
      updatedAt: targets.updatedAt,
    };
  }

  return {
    ok: true,
    message: 'pong (not calibrated — run MtbClickHelper.exe --calibrate)',
  };
}

export async function getNativeTargets(): Promise<TrustedClickResponse> {
  return sendNativeMessage({ action: 'getTargets' });
}

export interface SetAmountRequest {
  amount: string;
  screenX?: number;
  screenY?: number;
}

export async function dispatchFocusAmount(): Promise<TrustedClickResponse> {
  return sendNativeMessage({ action: 'focusAmount' });
}

export async function dispatchPasteAmount(
  request: { amount: string },
): Promise<TrustedClickResponse> {
  return sendNativeMessage({
    action: 'pasteAmount',
    amount: request.amount,
  });
}

export async function dispatchTypeAmount(
  request: { amount: string },
): Promise<TrustedClickResponse> {
  return sendNativeMessage({
    action: 'typeAmount',
    amount: request.amount,
  });
}

export async function dispatchKeypadAmount(
  request: { amount: string },
): Promise<TrustedClickResponse> {
  return sendNativeMessage({
    action: 'keypadAmount',
    amount: request.amount,
  });
}

/** @deprecated Use dispatchFocusAmount + dispatchTypeAmount */
export async function dispatchSetAmount(
  request: SetAmountRequest,
): Promise<TrustedClickResponse> {
  const focus = await dispatchFocusAmount();
  if (!focus.ok) return focus;
  return dispatchTypeAmount({ amount: request.amount });
}
