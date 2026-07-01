/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { AutoTradeStatsTracker } from '../exnova/auto-trade-stats';
import type { AutoTradeStatsData } from '../../types';

function createMemoryStorage() {
  let store: Record<string, unknown> = {};
  return {
    get: async (key: string) => ({ [key]: store[key] }),
    set: async (key: string, value: AutoTradeStatsData) => {
      store[key] = structuredClone(value);
    },
    clear: () => {
      store = {};
    },
    raw: () => store,
  };
}

const emptySnapshot = {
  wins: 0,
  losses: 0,
  pendingCount: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
};

describe('AutoTradeStatsTracker', () => {
  let memory: ReturnType<typeof createMemoryStorage>;
  let tracker: AutoTradeStatsTracker;

  beforeEach(() => {
    memory = createMemoryStorage();
    tracker = new AutoTradeStatsTracker(memory);
  });

  async function closeWin(id: string, signal: 'HIGHER' | 'LOWER' = 'HIGHER') {
    await tracker.onAutoTradePlaced(signal, 5);
    return tracker.onTradeClosed({
      id,
      profit: 10,
      outcome: 'win',
      closedAt: Date.now(),
      direction: signal,
    });
  }

  async function closeLoss(id: string, signal: 'HIGHER' | 'LOWER' = 'HIGHER') {
    await tracker.onAutoTradePlaced(signal, 5);
    return tracker.onTradeClosed({
      id,
      profit: 0,
      outcome: 'loss',
      closedAt: Date.now(),
      direction: signal,
    });
  }

  it('matches pending auto trade to close within expiry window', async () => {
    const placedAt = Date.now();
    await tracker.onAutoTradePlaced('HIGHER', 5);

    const counted = await tracker.onTradeClosed({
      id: 'pos-1',
      profit: 82,
      outcome: 'win',
      closedAt: placedAt + 5000,
      direction: 'HIGHER',
    });

    expect(counted).toBe(true);
    expect(tracker.getSnapshot()).toEqual({
      ...emptySnapshot,
      wins: 1,
      longestWinStreak: 1,
    });
  });

  it('ignores closes without a pending auto trade', async () => {
    const counted = await tracker.onTradeClosed({
      id: 'manual-1',
      profit: 100,
      outcome: 'win',
      closedAt: Date.now(),
      direction: 'HIGHER',
    });

    expect(counted).toBe(false);
    expect(tracker.getSnapshot()).toEqual(emptySnapshot);
  });

  it('does not double-count the same close id', async () => {
    await tracker.onAutoTradePlaced('LOWER', 5);
    const event = {
      id: 'dup-1',
      profit: 0,
      outcome: 'loss' as const,
      closedAt: Date.now(),
      direction: 'LOWER' as const,
    };

    expect(await tracker.onTradeClosed(event)).toBe(true);
    expect(await tracker.onTradeClosed(event)).toBe(false);
    expect(tracker.getSnapshot().losses).toBe(1);
    expect(tracker.getSnapshot().longestLossStreak).toBe(1);
  });

  it('tracks longest win and loss streaks for the session', async () => {
    await closeWin('w1');
    await closeWin('w2');
    await closeLoss('l1');
    await closeLoss('l2');
    await closeLoss('l3');
    await closeWin('w3');

    expect(tracker.getSnapshot()).toEqual({
      wins: 3,
      losses: 3,
      pendingCount: 0,
      longestWinStreak: 2,
      longestLossStreak: 3,
    });
  });

  it('rejects direction mismatch when close direction is known', async () => {
    await tracker.onAutoTradePlaced('HIGHER', 5);
    const counted = await tracker.onTradeClosed({
      id: 'dir-1',
      profit: 50,
      outcome: 'win',
      closedAt: Date.now(),
      direction: 'LOWER',
    });

    expect(counted).toBe(false);
    expect(tracker.getSnapshot().pendingCount).toBe(1);
  });

  it('persists and reloads stats across tracker instances', async () => {
    await closeWin('persist-1');

    const reloaded = new AutoTradeStatsTracker(memory);
    await reloaded.load();
    expect(reloaded.getSnapshot()).toEqual({
      ...emptySnapshot,
      wins: 1,
      longestWinStreak: 1,
    });
  });

  it('survives simulated settings toggle via storage reload', async () => {
    await closeLoss('toggle-1');

    await tracker.load();
    expect(tracker.getSnapshot()).toEqual({
      ...emptySnapshot,
      losses: 1,
      longestLossStreak: 1,
    });
  });

  it('reset clears wins, losses, streaks, and pending', async () => {
    await closeWin('reset-1');
    await tracker.reset();
    expect(tracker.getSnapshot()).toEqual(emptySnapshot);
  });

  it('migrates legacy stored stats without streak fields', async () => {
    await memory.set('mtb_auto_trade_stats', {
      wins: 2,
      losses: 1,
      pending: [],
      seenCloseIds: ['legacy-1'],
    } as AutoTradeStatsData);

    await tracker.load();
    expect(tracker.getSnapshot()).toEqual({
      wins: 2,
      losses: 1,
      pendingCount: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
    });
  });

  it('reports open trades until expiry plus buffer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    tracker.registerPendingPlacement('HIGHER', 5);

    expect(tracker.hasOpenTrade(14_000)).toBe(true);
    expect(tracker.secondsUntilTradeSlot(14_000)).toBe(6);
    expect(tracker.hasOpenTrade(20_000)).toBe(false);
    expect(tracker.secondsUntilTradeSlot(20_000)).toBe(0);

    vi.useRealTimers();
  });

  it('rollbackLastPending removes optimistic pending entry', async () => {
    tracker.registerPendingPlacement('LOWER', 5);
    expect(tracker.getSnapshot().pendingCount).toBe(1);

    tracker.rollbackLastPending();
    expect(tracker.getSnapshot().pendingCount).toBe(0);
    expect(tracker.hasOpenTrade()).toBe(false);
  });
});
