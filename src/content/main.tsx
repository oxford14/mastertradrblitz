import { createRoot } from 'react-dom/client';
import { Overlay } from './overlay/Overlay';
import { AutoTradeController } from '../lib/exnova/auto-trade-controller';
import { createPipeline, isWsBridgeMessage } from '../lib/pipeline';
import { executeTrade } from '../lib/exnova/trade-executor';
import { loadSettings, onSettingsChanged, saveSettings } from '../lib/settings/storage';
import './overlay/overlay.css';

const ROOT_ID = 'mtb-overlay-root';

async function bootstrap(): Promise<void> {
  if (document.getElementById(ROOT_ID)) return;

  const host = document.createElement('div');
  host.id = ROOT_ID;
  document.body.appendChild(host);

  const settings = await loadSettings();
  let currentSettings = settings;
  const pipeline = await createPipeline();
  const autoTrade = new AutoTradeController();
  autoTrade.updateSettings(currentSettings);

  const root = createRoot(host);

  const render = () => {
    const result = pipeline.getLastResult();
    root.render(
      <Overlay
        result={result}
        symbol={pipeline.store.getSymbol()}
        tradeExpirySec={pipeline.getTradeExpirySec()}
        wsConnected={pipeline.store.isWsConnected()}
        candleCount={pipeline.store.getCount()}
        autoTradeEnabled={currentSettings.autoTrade.enabled}
        autoTradeDryRun={currentSettings.autoTrade.dryRun}
        autoTradeStatus={autoTrade.getStatus()}
        onAutoTradeToggle={(enabled) => {
          void saveSettings({
            ...currentSettings,
            autoTrade: { ...currentSettings.autoTrade, enabled },
          });
        }}
      />,
    );
  };

  pipeline.onResult(() => render());
  pipeline.onTradeConfirmed(({ signal, warmedUp }) => {
    void autoTrade.onTradeConfirmed(signal, warmedUp).then(() => render());
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'mtb-probe-buttons'
    ) {
      sendResponse(autoTrade.probeButtons());
      return true;
    }
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'mtb-test-click'
    ) {
      const signal = (message as { signal?: string }).signal;
      if (signal !== 'HIGHER' && signal !== 'LOWER') {
        sendResponse({ ok: false, message: 'Invalid test signal' });
        return true;
      }
      void executeTrade(signal, false, currentSettings.autoTrade, document).then((result) => {
        sendResponse({ ok: result.ok, message: result.message });
        render();
      });
      return true;
    }
    return false;
  });

  render();

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;

    if (isWsBridgeMessage(data)) {
      pipeline.handleWsMessage(data.data);
      return;
    }

    if (
      typeof data === 'object' &&
      data !== null &&
      (data as { source?: string }).source === 'mtb-ws-status'
    ) {
      pipeline.setWsConnected(Boolean((data as { connected?: boolean }).connected));
      render();
    }
  });

  onSettingsChanged((next) => {
    currentSettings = next;
    autoTrade.updateSettings(next);
    pipeline.updateSettings(next);
    render();
  });
}

void bootstrap();
