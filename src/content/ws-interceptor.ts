const NativeWebSocket = window.WebSocket;

function patchWebSocket(): void {
  if ((window as unknown as { __mtbWsPatched?: boolean }).__mtbWsPatched) return;
  (window as unknown as { __mtbWsPatched?: boolean }).__mtbWsPatched = true;

  const PatchedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ) {
    const ws =
      protocols !== undefined
        ? new NativeWebSocket(url, protocols)
        : new NativeWebSocket(url);

    ws.addEventListener('open', () => {
      window.postMessage(
        { source: 'mtb-ws-status', connected: true, url: String(url) },
        '*',
      );
    });

    ws.addEventListener('close', () => {
      window.postMessage(
        { source: 'mtb-ws-status', connected: false, url: String(url) },
        '*',
      );
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      window.postMessage(
        {
          source: 'mtb-ws',
          url: String(url),
          data: event.data,
        },
        '*',
      );
    });

    return ws;
  } as unknown as typeof WebSocket;

  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  Object.assign(PatchedWebSocket, {
    CONNECTING: NativeWebSocket.CONNECTING,
    OPEN: NativeWebSocket.OPEN,
    CLOSING: NativeWebSocket.CLOSING,
    CLOSED: NativeWebSocket.CLOSED,
  });

  window.WebSocket = PatchedWebSocket;
}

patchWebSocket();
