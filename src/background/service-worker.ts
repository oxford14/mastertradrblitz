import {
  dispatchTrustedClick,
  pingNativeHelper,
} from './trusted-click';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'settings-updated') {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'mtb-trusted-click') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, message: 'Trusted click requires an Exnova tab' });
      return false;
    }

    void dispatchTrustedClick(tabId, {
      clientX: Number(message.clientX),
      clientY: Number(message.clientY),
      screenX: Number(message.screenX),
      screenY: Number(message.screenY),
      engine: message.engine ?? 'debugger',
    }).then(sendResponse);
    return true;
  }

  if (message?.type === 'mtb-click-helper-ping') {
    void pingNativeHelper().then(sendResponse);
    return true;
  }

  return false;
});
