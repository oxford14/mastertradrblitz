/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import { buildTradeEntrySnapshot } from '../ai/trade-snapshot';

const sendMessage = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  vi.stubGlobal('chrome', {
    runtime: { sendMessage },
  });
});

import {
  clientCompleteJournalOnClose,
  clientCountTradeRecords,
  clientPushPendingJournalEntry,
} from '../ai/trade-journal-client';

describe('trade-journal-client', () => {
  it('routes pending push through background message', async () => {
    sendMessage.mockResolvedValue({ ok: true });
    const placedAt = Date.now();
    await clientPushPendingJournalEntry({
      entry: buildTradeEntrySnapshot({
        placedAt,
        signal: 'HIGHER',
        symbol: 'EURUSD',
        stake: 200,
        progression: {
          profileId: 'D200',
          level: 1,
          stake: 200,
          stopped: false,
          lastWarning: null,
        },
        dryRun: false,
        settings: DEFAULT_SETTINGS,
        signalResult: null,
      }),
      expirySec: 5,
      candlesAtEntry: [],
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mtb-journal-pending-push' }),
    );
  });

  it('routes complete close through background message', async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      record: { id: 'pos-1', signal: 'HIGHER', outcome: 'win' },
    });
    const record = await clientCompleteJournalOnClose({
      id: 'pos-1',
      profit: 10,
      outcome: 'win',
      closedAt: Date.now(),
      direction: 'HIGHER',
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mtb-journal-complete-close' }),
    );
    expect(record?.id).toBe('pos-1');
  });

  it('routes count through background message', async () => {
    sendMessage.mockResolvedValue({ ok: true, count: 3 });
    const count = await clientCountTradeRecords();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'mtb-journal-count' });
    expect(count).toBe(3);
  });
});
