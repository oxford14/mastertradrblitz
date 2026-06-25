export interface TrustedClickResult {
  ok: boolean;
  message: string;
  higher?: { x: number; y: number };
  lower?: { x: number; y: number };
  amount?: { x: number; y: number };
  updatedAt?: string;
}

export async function requestTrustedClick(options: {
  signal: 'HIGHER' | 'LOWER';
}): Promise<TrustedClickResult> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'mtb-trusted-click',
      engine: 'native',
      signal: options.signal,
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

async function sendAmountAction(
  type: string,
  amount: string,
): Promise<TrustedClickResult> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type,
      amount,
    })) as TrustedClickResult | undefined;

    if (!response) {
      return { ok: false, message: 'No response from background worker' };
    }
    return response;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Amount action failed',
    };
  }
}

export async function requestFocusAmount(): Promise<TrustedClickResult> {
  return sendAmountAction('mtb-focus-amount', '');
}

export async function requestPasteAmount(options: {
  amount: string;
}): Promise<TrustedClickResult> {
  return sendAmountAction('mtb-paste-amount', options.amount);
}

export async function requestTypeAmount(options: {
  amount: string;
}): Promise<TrustedClickResult> {
  return sendAmountAction('mtb-type-amount', options.amount);
}

export async function requestKeypadAmount(options: {
  amount: string;
}): Promise<TrustedClickResult> {
  return sendAmountAction('mtb-keypad-amount', options.amount);
}

/** @deprecated Use requestFocusAmount + DOM write or requestTypeAmount */
export async function requestSetAmount(options: {
  amount: string;
  screenX?: number;
  screenY?: number;
}): Promise<TrustedClickResult> {
  const focus = await requestFocusAmount();
  if (!focus.ok) return focus;
  return requestTypeAmount({ amount: options.amount });
}
