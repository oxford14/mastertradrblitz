import {
  dispatchTrustedClick,
  dispatchFocusAmount,
  dispatchPasteAmount,
  dispatchTypeAmount,
  dispatchKeypadAmount,
  pingNativeHelper,
} from './trusted-click';
import {
  clearAutoTradeStatsFromSession,
  readAutoTradeStatsFromSession,
  writeAutoTradeStatsToSession,
} from '../lib/exnova/auto-trade-stats-storage';
import {
  clearProgressionStateFromSession,
  readProgressionStateFromSession,
  writeProgressionStateToSession,
} from '../lib/progression/progression-state-storage';
import type { AutoTradeStatsData } from '../types';
import type { ProgressionStateData } from '../types';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'settings-updated') {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'mtb-auto-stats-get') {
    void readAutoTradeStatsFromSession()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to read stats',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-auto-stats-set') {
    const data = message.data as AutoTradeStatsData | undefined;
    if (!data) {
      sendResponse({ ok: false, message: 'Missing stats data' });
      return false;
    }
    void writeAutoTradeStatsToSession(data)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to save stats',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-auto-stats-reset') {
    void clearAutoTradeStatsFromSession()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to reset stats',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-trusted-click') {
    void dispatchTrustedClick({
      signal:
        message.signal === 'HIGHER' || message.signal === 'LOWER'
          ? message.signal
          : undefined,
      engine: 'native',
    }).then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-click-helper-ping') {
    void pingNativeHelper().then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-progression-state-get') {
    void readProgressionStateFromSession()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to read progression',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-progression-state-set') {
    const data = message.data as ProgressionStateData | undefined;
    if (!data) {
      sendResponse({ ok: false, message: 'Missing progression data' });
      return false;
    }
    void writeProgressionStateToSession(data)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to save progression',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-progression-state-reset') {
    void clearProgressionStateFromSession()
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to reset progression',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-paste-amount') {
    const amount = String(message.amount ?? '');
    if (!amount) {
      sendResponse({ ok: false, message: 'Invalid pasteAmount request' });
      return false;
    }
    void dispatchPasteAmount({ amount }).then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-focus-amount') {
    void dispatchFocusAmount().then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-type-amount') {
    const amount = String(message.amount ?? '');
    if (!amount) {
      sendResponse({ ok: false, message: 'Invalid typeAmount request' });
      return false;
    }
    void dispatchTypeAmount({ amount }).then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-keypad-amount') {
    const amount = String(message.amount ?? '');
    if (!amount) {
      sendResponse({ ok: false, message: 'Invalid keypadAmount request' });
      return false;
    }
    void dispatchKeypadAmount({ amount }).then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-set-amount') {
    const amount = String(message.amount ?? '');
    if (!amount) {
      sendResponse({ ok: false, message: 'Invalid setAmount request' });
      return false;
    }
    void dispatchFocusAmount()
      .then((focus) => {
        if (!focus.ok) return focus;
        return dispatchTypeAmount({ amount });
      })
      .then(sendResponse);
    return true;
  }

  return false;
});
