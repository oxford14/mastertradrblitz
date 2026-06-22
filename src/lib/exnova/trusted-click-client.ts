import type { AutoTradeClickEngine } from '../../types';

export interface TrustedClickResult {
  ok: boolean;
  message: string;
}

export async function requestTrustedClick(
  clientX: number,
  clientY: number,
  screenX: number,
  screenY: number,
  engine: AutoTradeClickEngine,
): Promise<TrustedClickResult> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'mtb-trusted-click',
      engine,
      clientX: Math.round(clientX),
      clientY: Math.round(clientY),
      screenX: Math.round(screenX),
      screenY: Math.round(screenY),
    })) as TrustedClickResult | undefined;

    if (!response) {
      return { ok: false, message: 'No response from background worker' };
    }
    return response;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Trusted click failed',
    };
  }
}

export async function pingClickHelper(): Promise<TrustedClickResult> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'mtb-click-helper-ping',
    })) as TrustedClickResult | undefined;
    return response ?? { ok: false, message: 'No response from background worker' };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Helper ping failed',
    };
  }
}
