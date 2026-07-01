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
import { shouldAutoTradeAiDecision, getAiAutoTradeThreshold, getAiAutoTradeGateMessage } from '../lib/decision/decision-adapter';
import { isMtbApiConfigured, syncTradeClose } from '../lib/api/mtb-api-client';
import {
  autoTradeDirectionSkipMessage,
  isAutoTradeSignalAllowed,
} from '../lib/exnova/auto-trade-direction';
import { isOpenRouterConfigured } from '../lib/ai/openrouter-config';
import { readLatestAnalysis } from '../lib/ai/analysis-storage';
import type {
  AiAnalystOverlayState,
  AutoTradeStatsSnapshot,
  LatestTradeAnalysis,
  ProgressionSnapshot,
} from '../types';
import { isExnovaTraderoomUrl } from '../lib/exnova/traderoom-url';
import { onSpaNavigation } from '../lib/exnova/spa-navigation';
import overlayCss from './overlay/overlay.css?inline';

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

const BOOTSTRAP_VERSION = '3';

async function bootstrap(): Promise<() => void> {
  await waitForBody();

  const existing = document.getElementById(ROOT_ID);
  existing?.remove();

  const host = document.createElement('div');
  host.id = ROOT_ID;
  host.dataset.mtbBootstrapped = BOOTSTRAP_VERSION;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = overlayCss;
  shadow.appendChild(style);
  const mount = document.createElement('div');
  shadow.appendChild(mount);
  document.body.appendChild(host);

  const settings = await loadSettings();
  let currentSettings = settings;
  const pipeline = await createPipeline();
  const autoTrade = new AutoTradeController();
  autoTrade.updateSettings(currentSettings);
  const tradeStats = new AutoTradeStatsTracker();
  await tradeStats.load();
  pipeline.setTradePlacementGate({
    canPlaceTrade: (now) => !tradeStats.hasOpenTrade(now),
    secondsUntilReady: (now) => tradeStats.secondsUntilTradeSlot(now),
  });
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
  let pendingManualTrade: { signal: 'HIGHER' | 'LOWER'; warmedUp: boolean } | null = null;

  const executeConfirmedTrade = async (
    signal: 'HIGHER' | 'LOWER',
    warmedUp: boolean,
  ): Promise<void> => {
    if (!currentSettings.autoTrade.enabled) return;

    if (
      !isAutoTradeSignalAllowed(currentSettings.autoTrade.directionFilter, signal)
    ) {
      autoTrade.setSkipped(
        signal,
        autoTradeDirectionSkipMessage(
          currentSettings.autoTrade.directionFilter,
          signal,
        ),
      );
      render();
      return;
    }

    const isLiveClick = warmedUp && !currentSettings.autoTrade.dryRun;
    if (isLiveClick) {
      tradeStats.registerPendingPlacement(signal, pipeline.getTradeExpirySec());
    }

    if (currentSettings.progression.enabled && warmedUp) {
      const amount = await progressionManager.ensureAmountApplied();
      if (!amount.ok) {
        if (isLiveClick) {
          tradeStats.rollbackLastPending();
        }
        autoTrade.setSkipped(signal, amount.message);
        render();
        return;
      }
    }

    if (isLiveClick) {
      await tradeStats.saveState();
    }

    const status = await autoTrade.onTradeConfirmed(signal, warmedUp);

    if (isLiveClick && status.action !== 'clicked') {
      tradeStats.rollbackLastPending();
      render();
      return;
    }

    if (status.action === 'clicked' || status.action === 'dry_run') {
      if (status.action === 'dry_run') {
        await tradeStats.onAutoTradePlaced(signal, pipeline.getTradeExpirySec());
      }
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
  };

  const root = createRoot(mount);
  const cleanups: Array<() => void> = [];

  const render = () => {
    const result = pipeline.getLastResult();
    const aiAutoTradeGateMessage =
      currentSettings.tradingMode === 'AI'
        ? getAiAutoTradeGateMessage({
            settings: currentSettings,
            autoTradeEnabled: currentSettings.autoTrade.enabled,
            autoTradeDryRun: currentSettings.autoTrade.dryRun,
            aiDecision: result?.aiDecision,
            aiLoading: result?.aiLoading,
            autoTradeStatusMessage:
              autoTrade.getStatus().action !== 'none'
                ? autoTrade.getStatus().message
                : null,
          })
        : null;
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
        tradingMode={currentSettings.tradingMode}
        autoTradingMode={currentSettings.autoTradingMode}
        aiAutoTradeThreshold={getAiAutoTradeThreshold(currentSettings)}
        aiAutoTradeGateMessage={aiAutoTradeGateMessage}
        aiBackendConfigured={isMtbApiConfigured(currentSettings)}
        pendingManualTrade={pendingManualTrade}
        onManualConfirm={() => {
          if (!pendingManualTrade) return;
          const pending = pendingManualTrade;
          pendingManualTrade = null;
          render();
          void executeConfirmedTrade(pending.signal, pending.warmedUp);
        }}
        onManualReject={() => {
          pendingManualTrade = null;
          render();
        }}
        onAutoTradeToggle={(enabled) => {
          currentSettings = {
            ...currentSettings,
            autoTrade: { ...currentSettings.autoTrade, enabled },
          };
          autoTrade.updateSettings(currentSettings);
          render();
          void saveSettings(currentSettings);
        }}
        onAiAnalystToggle={(enabled) => {
          currentSettings = {
            ...currentSettings,
            aiAnalyst: { ...currentSettings.aiAnalyst, enabled },
          };
          if (!enabled) {
            aiAnalystState = {
              ...aiAnalystState,
              activity: 'idle',
              lastError: null,
            };
          }
          render();
          void saveSettings(currentSettings);
        }}
        onAiAnalystModelChange={(model) => {
          currentSettings = {
            ...currentSettings,
            aiAnalyst: { ...currentSettings.aiAnalyst, model },
          };
          aiAnalystState = { ...aiAnalystState, model };
          render();
          void saveSettings(currentSettings);
        }}
      />,
    );
  };

  cleanups.push(
    tradeStats.onUpdate((snapshot) => {
      tradeStatsSnapshot = snapshot;
      render();
    }),
  );

  cleanups.push(
    progressionManager.onUpdate((snapshot) => {
      progressionSnapshot = snapshot;
      render();
    }),
  );

  pipeline.onResult(() => render());
  pipeline.onTradeConfirmed(({ signal, warmedUp, aiConfidence }) => {
    void (async () => {
      if (signal !== 'HIGHER' && signal !== 'LOWER') return;
      if (!currentSettings.autoTrade.enabled) return;

      if (
        !isAutoTradeSignalAllowed(currentSettings.autoTrade.directionFilter, signal)
      ) {
        autoTrade.setSkipped(
          signal,
          autoTradeDirectionSkipMessage(
            currentSettings.autoTrade.directionFilter,
            signal,
          ),
        );
        render();
        return;
      }

      if (currentSettings.tradingMode === 'AI') {
        if (currentSettings.autoTradingMode === 'manual') {
          pendingManualTrade = { signal, warmedUp };
          render();
          return;
        }
        const liveConfidence = pipeline.getLastResult()?.aiDecision?.confidence ?? 0;
        const confidence = aiConfidence > 0 ? aiConfidence : liveConfidence;
        if (!shouldAutoTradeAiDecision(currentSettings, confidence)) {
          autoTrade.setSkipped(
            signal,
            `AI confidence ${confidence}% below ${currentSettings.autoTradingMode} auto threshold (${getAiAutoTradeThreshold(currentSettings)}%)`,
          );
          render();
          return;
        }
      }

      await executeConfirmedTrade(signal, warmedUp);
    })();
  });

  const onRuntimeMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => {
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
  };
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

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

  const onStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ) => {
    if (area !== 'local' || !changes.mtb_latest_analysis) return;
    latestAnalysis = (changes.mtb_latest_analysis.newValue as LatestTradeAnalysis) ?? null;
    render();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  const onWindowMessage = (event: MessageEvent) => {
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
                currentSettings.tradingMode === 'AI' &&
                isMtbApiConfigured(currentSettings)
              ) {
                const lastResult = pipeline.getLastResult();
                void syncTradeClose(
                  {
                    apiBaseUrl: currentSettings.aiBackend.apiBaseUrl,
                    apiKey: currentSettings.aiBackend.apiKey,
                  },
                  {
                    externalId: record.id,
                    asset: record.symbol,
                    timestamp: new Date(record.closedAt).toISOString(),
                    expiry: pipeline.getTradeExpirySec(),
                    indicators: (lastResult?.aiSnapshot as import('@mtb/shared').MarketSnapshot) ?? {
                      asset: record.symbol,
                      expiry: pipeline.getTradeExpirySec() as 5 | 10 | 15 | 30,
                      rsi: { value: 0, state: 'NEUTRAL' },
                      macd: { cross: 'NONE', histogram: 'FLAT' },
                      adx: { value: 0, strength: 'WEAK' },
                      stochastic: { cross: 'NONE' },
                      bollinger: { position: 'MIDDLE' },
                      trend: 'NEUTRAL',
                    },
                    aiDecision:
                      lastResult?.aiDecision?.decision ??
                      (record.signal === 'HIGHER' ? 'BUY' : 'SELL'),
                    confidence: lastResult?.aiDecision?.confidence ?? 0,
                    reasoning: lastResult?.aiDecision?.reasoning ?? [],
                    risks: lastResult?.aiDecision?.risks ?? [],
                    result: record.outcome,
                    pnl: record.profit,
                    streak:
                      record.outcome === 'loss'
                        ? -tradeStatsSnapshot.longestLossStreak
                        : tradeStatsSnapshot.longestWinStreak,
                    direction: record.signal,
                    mode: currentSettings.tradingMode === 'AI' ? 'ai' : 'legacy',
                    strategyId: currentSettings.assignedStrategyId,
                    aiDecisionId: lastResult?.aiDecisionId ?? null,
                  },
                ).catch((err) => {
                  console.warn('[MTB V2] Trade sync failed:', err);
                });
              }
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
  };
  window.addEventListener('message', onWindowMessage);

  cleanups.push(onSettingsChanged((next) => {
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
  }));

  return () => {
    root.unmount();
    for (const off of cleanups) off();
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    chrome.storage.onChanged.removeListener(onStorageChanged);
    window.removeEventListener('message', onWindowMessage);
    pipeline.dispose();
    host.remove();
  };
}

let activeCleanup: (() => void) | null = null;
let bootstrapping = false;

function teardownOverlay(): void {
  activeCleanup?.();
  activeCleanup = null;
  document.getElementById(ROOT_ID)?.remove();
}

async function syncOverlayWithRoute(): Promise<void> {
  if (!isExnovaTraderoomUrl(location.href)) {
    teardownOverlay();
    return;
  }
  if (activeCleanup || bootstrapping || document.getElementById(ROOT_ID)) {
    return;
  }

  bootstrapping = true;
  try {
    activeCleanup = await bootstrap();
  } catch (err) {
    console.error('[MTB] bootstrap failed:', err);
    teardownOverlay();
  } finally {
    bootstrapping = false;
  }
}

async function initOverlayHost(): Promise<void> {
  await waitForBody();
  await syncOverlayWithRoute();
  onSpaNavigation(() => {
    void syncOverlayWithRoute();
  });
}

void initOverlayHost();
