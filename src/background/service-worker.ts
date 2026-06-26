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
import type { AggregateLearningRun, AutoTradeStatsData, ProgressionStateData, TradeCloseEvent, TradeRecord } from '../types';
import type { PendingJournalEntry } from '../lib/ai/trade-journal-match';
import {
  logMissingApiKeyOnce,
  queueTradeAnalysis,
} from './ai-analyst-queue';
import { readLatestAnalysis } from '../lib/ai/analysis-storage';
import {
  clearTradeJournal,
  exportTradeRecordsJson,
  getTradeRecord,
  listTradeRecords,
  tradeRecordsToCsv,
} from '../lib/ai/trade-journal-db';
import {
  clearJournalPending,
  completeJournalOnClose,
  getJournalRecordCount,
  pushPendingJournalEntry,
  saveAggregateRun,
  saveJournalRecord,
  updateJournalRecord,
} from '../lib/ai/trade-journal-service';
import { isOpenRouterConfigured } from '../lib/ai/openrouter-config';
import { testOpenRouterModel } from '../lib/ai/openrouter-client';

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

  if (message?.type === 'mtb-analyze-trade') {
    const record = message.record as TradeRecord | undefined;
    if (!record?.id) {
      sendResponse({ ok: false, message: 'Missing trade record' });
      return false;
    }
    if (!isOpenRouterConfigured()) {
      logMissingApiKeyOnce();
      sendResponse({ ok: false, message: 'OpenRouter API key not configured' });
      return false;
    }
    queueTradeAnalysis(record);
    sendResponse({ ok: true, queued: true });
    return false;
  }

  if (message?.type === 'mtb-latest-analysis-get') {
    void readLatestAnalysis()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to read analysis',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-openrouter-status') {
    sendResponse({ ok: true, configured: isOpenRouterConfigured() });
    return false;
  }

  if (message?.type === 'mtb-openrouter-test-model') {
    const model = String(message.model ?? '').trim();
    if (!model) {
      sendResponse({ ok: false, message: 'Missing model' });
      return false;
    }
    if (!isOpenRouterConfigured()) {
      sendResponse({ ok: false, message: 'OpenRouter API key not configured' });
      return false;
    }
    void testOpenRouterModel(model)
      .then((result) =>
        sendResponse(
          result.ok
            ? { ok: true, message: `Model OK: ${model}` }
            : { ok: false, message: result.error ?? 'Model test failed' },
        ),
      )
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Model test failed',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-list') {
    const limit = Number(message.limit) || 100;
    const offset = Number(message.offset) || 0;
    const order = message.order === 'asc' ? 'asc' : 'desc';
    void listTradeRecords(limit, offset, order)
      .then((records) => sendResponse({ ok: true, records }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to list journal',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-append') {
    const record = message.record as TradeRecord | undefined;
    if (!record?.id) {
      sendResponse({ ok: false, message: 'Missing trade record' });
      return false;
    }
    void saveJournalRecord(record)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to append journal record',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-update') {
    const record = message.record as TradeRecord | undefined;
    if (!record?.id) {
      sendResponse({ ok: false, message: 'Missing trade record' });
      return false;
    }
    void updateJournalRecord(record)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to update journal record',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-count') {
    void getJournalRecordCount()
      .then((count) => sendResponse({ ok: true, count }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to count journal records',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-pending-push') {
    const entry = message.entry as PendingJournalEntry | undefined;
    if (!entry?.entry?.placedAt) {
      sendResponse({ ok: false, message: 'Missing pending journal entry' });
      return false;
    }
    void pushPendingJournalEntry(entry)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to push pending entry',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-complete-close') {
    const event = message.event as TradeCloseEvent | undefined;
    if (!event?.id) {
      sendResponse({ ok: false, message: 'Missing close event' });
      return false;
    }
    void completeJournalOnClose(event)
      .then((record) => sendResponse({ ok: true, record }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to complete journal close',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-aggregate-run') {
    const run = message.run as AggregateLearningRun | undefined;
    if (!run?.id) {
      sendResponse({ ok: false, message: 'Missing aggregate run' });
      return false;
    }
    void saveAggregateRun(run)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to save aggregate run',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-get') {
    const id = String(message.id ?? '');
    if (!id) {
      sendResponse({ ok: false, message: 'Missing trade id' });
      return false;
    }
    void getTradeRecord(id)
      .then((record) => sendResponse({ ok: true, record }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to get trade',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-clear') {
    void clearTradeJournal()
      .then(() => clearJournalPending())
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Failed to clear journal',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-export-json') {
    void exportTradeRecordsJson()
      .then((json) => sendResponse({ ok: true, json }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Export failed',
        }),
      );
    return true;
  }

  if (message?.type === 'mtb-journal-export-csv') {
    void listTradeRecords(5000, 0, 'desc')
      .then((records) => sendResponse({ ok: true, csv: tradeRecordsToCsv(records) }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          message: err instanceof Error ? err.message : 'Export failed',
        }),
      );
    return true;
  }

  return false;
});
