export const EXTENSION_RELOAD_MESSAGE =
  'Extension was reloaded — refresh this Exnova tab to reconnect.';

export function isExtensionContextValid(): boolean {
  try {
    return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Extension context invalidated');
}

export function toExtensionRuntimeError(error: unknown): Error {
  if (isExtensionContextInvalidatedError(error)) {
    return new Error(EXTENSION_RELOAD_MESSAGE);
  }
  return error instanceof Error ? error : new Error(String(error));
}
