import { createRoot } from 'react-dom/client';
import { Overlay } from './overlay/Overlay';
import { AutoTradeController } from '../lib/exnova/auto-trade-controller';
import { AutoTradeStatsTracker } from '../lib/exnova/auto-trade-stats';
import { parseTradeResultPayload } from '../lib/exnova/trade-result-parser';
import { createPipeline, isWsBridgeMessage } from '../lib/pipeline';
import { executeTrade } from '../lib/exnova/trade-executor';
import { loadSettings, onSettingsChanged, saveSettings } from '../lib/settings/storage';
import { ProgressionManager } from '../lib/progression/progression-manager';
import { updateInvestAmount } from '../lib/progression/amount-updater';
import type { AutoTradeStatsSnapshot, ProgressionSnapshot } from '../types';
import './overlay/overlay.css';

const ROOT_ID = 'mtb-overlay-root';

async function waitForBody(): Promise<void> {
  if (document.body) return;
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (document.body) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

const BOOTSTRAP_VERSION = '2';

async function bootstrap(): Promise<void> {
  await waitForBody();

  const existing = document.getElementById(ROOT_ID);
  if (existing?.dataset.mtbBootstrapped === BOOTSTRAP_VERSION) return;
  existing?.remove();

  const host = document.createElement('div');
  host.id = ROOT_ID;
  host.dataset.mtbBootstrapped = BOOTSTRAP_VERSION;
  document.body.appendChild(host);

  const settings = await loadSettings();
  let currentSettings = settings;
  const pipeline = await createPipeline();
  const autoTrade = new AutoTradeController();
  autoTrade.updateSettings(currentSettings);
  const tradeStats = new AutoTradeStatsTracker();
  await tradeStats.load();
  let tradeStatsSnapshot: AutoTradeStatsSnapshot = tradeStats.getSnapshot();

  const progressionManager = new ProgressionManager({
    getSettings: () => currentSettings,
    updateAmount: ({ stake, dryRun }) =>
      updateInvestAmount({
        stake,
        dryRun,
        progression: currentSettings.progression,
      }),
  });
  const { recoveredFromStop } = await progressionManager.load();
  if (recoveredFromStop && !currentSettings.autoTrade.enabled) {
    await saveSettings({
      ...currentSettings,
      autoTrade: { ...currentSettings.autoTrade, enabled: true },
    });
    currentSettings = {
      ...currentSettings,
      autoTrade: { ...currentSettings.autoTrade, enabled: true },
    };
    autoTrade.updateSettings(currentSettings);
  }
  let progressionSnapshot: ProgressionSnapshot = progressionManager.getSnapshot();

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
        autoTradeStats={tradeStatsSnapshot}
        progressionEnabled={currentSettings.progression.enabled}
        progressionSnapshot={progressionSnapshot}
        onAutoTradeToggle={(enabled) => {
          void saveSettings({
            ...currentSettings,
            autoTrade: { ...currentSettings.autoTrade, enabled },
          });
        }}
      />,
    );
  };

  tradeStats.onUpdate((snapshot) => {
    tradeStatsSnapshot = snapshot;
    render();
  });

  progressionManager.onUpdate((snapshot) => {
    progressionSnapshot = snapshot;
    render();
  });

  pipeline.onResult(() => render());
  pipeline.onTradeConfirmed(({ signal, warmedUp }) => {
    void autoTrade.onTradeConfirmed(signal, warmedUp).then(async (status) => {
      if (
        status.action === 'clicked' &&
        (signal === 'HIGHER' || signal === 'LOWER')
      ) {
        await tradeStats.onAutoTradePlaced(signal, pipeline.getTradeExpirySec());
      }
      render();
    });
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
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'mtb-reset-auto-stats'
    ) {
      void tradeStats.reset().then(() => {
        sendResponse({ ok: true });
        render();
      });
      return true;
    }
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'mtb-reset-progression'
    ) {
      void progressionManager.reset().then(() => {
        sendResponse({ ok: true });
        render();
      });
      return true;
    }
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: string }).type === 'mtb-test-progression-amount'
    ) {
      void progressionManager.testAmountUpdate().then((result) => {
        sendResponse(result);
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
      const tradeEvents = parseTradeResultPayload(data.data);
      if (tradeEvents.length > 0) {
        void (async () => {
          for (const ev of tradeEvents) {
            const attributed = await tradeStats.onTradeClosed(ev);
            if (attributed) {
              await progressionManager.onTradeResult(ev.outcome, true);
            }
          }
          render();
        })();
      }
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
    const prev = currentSettings;
    const prog = next.progression;
    const progChanged =
      prog.profileId !== prev.progression.profileId ||
      prog.maxLevel !== prev.progression.maxLevel ||
      prog.customLevels.join(',') !== prev.progression.customLevels.join(',');
    currentSettings = next;
    autoTrade.updateSettings(next);
    pipeline.updateSettings(next);
    if (prog.enabled && (!prev.progression.enabled || progChanged)) {
      void progressionManager.applyProfileChange().then(() => render());
    } else {
      render();
    }
  });
}

void bootstrap().catch((err) => {
  console.error('[MTB] bootstrap failed:', err);
});
