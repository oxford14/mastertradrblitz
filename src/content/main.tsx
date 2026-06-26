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
import {
  buildTradeEntrySnapshot,
  captureCandlesAtEntry,
} from '../lib/ai/trade-snapshot';
import { processTradeAnalysis } from '../lib/ai/trade-analyst-processor';
import {
  clientCompleteJournalOnClose,
  clientCountTradeRecords,
  clientPushPendingJournalEntry,
} from '../lib/ai/trade-journal-client';
import { isOpenRouterConfigured } from '../lib/ai/openrouter-config';
import { readLatestAnalysis } from '../lib/ai/analysis-storage';
import type {
  AiAnalystOverlayState,
  AutoTradeStatsSnapshot,
  LatestTradeAnalysis,
  ProgressionSnapshot,
} from '../types';
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
  let latestAnalysis: LatestTradeAnalysis | null = null;
  let aiAnalystState: AiAnalystOverlayState = {
    activity: 'idle',
    lastError: null,
    journalCount: 0,
    apiKeyConfigured: isOpenRouterConfigured(),
    model: currentSettings.aiAnalyst.model,
  };

  const refreshJournalCount = async () => {
    try {
      const count = await clientCountTradeRecords();
      aiAnalystState = { ...aiAnalystState, journalCount: count };
      render();
    } catch {
      // background journal unavailable
    }
  };

  const setJournalSkipReason = (reason: string) => {
    aiAnalystState = { ...aiAnalystState, lastError: reason };
    render();
  };

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
        aiAnalystEnabled={currentSettings.aiAnalyst.enabled}
        latestAnalysis={latestAnalysis}
        aiAnalystState={aiAnalystState}
        onAutoTradeToggle={(enabled) => {
          currentSettings = {
            ...currentSettings,
            autoTrade: { ...currentSettings.autoTrade, enabled },
          };
          autoTrade.updateSettings(currentSettings);
          render();
          void saveSettings(currentSettings);
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
        const placedAt = Date.now();
        await clientPushPendingJournalEntry({
          entry: buildTradeEntrySnapshot({
            placedAt,
            signal,
            symbol: pipeline.store.getSymbol(),
            stake: progressionManager.getSnapshot().stake,
            progression: progressionManager.getSnapshot(),
            dryRun: currentSettings.autoTrade.dryRun,
            settings: currentSettings,
            signalResult: pipeline.getLastResult(),
          }),
          expirySec: pipeline.getTradeExpirySec(),
          candlesAtEntry: captureCandlesAtEntry(pipeline.store.getClosedCandles()),
        });
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

  const refreshLatestAnalysis = async () => {
    try {
      latestAnalysis = await readLatestAnalysis();
      render();
    } catch {
      // storage unavailable
    }
  };

  void refreshLatestAnalysis();
  void refreshJournalCount();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.mtb_latest_analysis) return;
    latestAnalysis = (changes.mtb_latest_analysis.newValue as LatestTradeAnalysis) ?? null;
    render();
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;

    if (isWsBridgeMessage(data)) {
      const tradeEvents = parseTradeResultPayload(data.data);
      if (tradeEvents.length > 0) {
        void (async () => {
          for (const ev of tradeEvents) {
            const attributed = await tradeStats.onTradeClosed(ev);
            if (!attributed) {
              if (currentSettings.autoTrade.enabled && !currentSettings.autoTrade.dryRun) {
                setJournalSkipReason('Close not attributed to auto-trade');
              }
              continue;
            }
              await progressionManager.onTradeResult(ev.outcome, true);
            try {
              const record = await clientCompleteJournalOnClose(ev);
              if (!record) {
                setJournalSkipReason(
                  'No pending entry matched (tab may have refreshed before close)',
                );
                continue;
              }
              await refreshJournalCount();
              if (
                currentSettings.aiAnalyst.enabled &&
                !record.entry.dryRun
              ) {
                aiAnalystState = {
                  ...aiAnalystState,
                  activity: 'analyzing',
                  lastError: null,
                  model: currentSettings.aiAnalyst.model,
                };
                render();
                void processTradeAnalysis(record).then((result) => {
                  aiAnalystState = {
                    ...aiAnalystState,
                    activity: result.ok ? 'done' : 'error',
                    lastError: result.ok ? null : (result.error ?? 'Analysis failed'),
                  };
                  void refreshLatestAnalysis();
                  void refreshJournalCount();
                });
              }
            } catch (err) {
              console.warn('[MTB AI] Journal save failed:', err);
              setJournalSkipReason(
                err instanceof Error ? err.message : 'Journal save failed',
              );
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
    aiAnalystState = {
      ...aiAnalystState,
      model: next.aiAnalyst.model,
      apiKeyConfigured: isOpenRouterConfigured(),
    };
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
