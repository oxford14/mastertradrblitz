import type {
  AutoTradeStatsData,
  AutoTradeStatsSnapshot,
  PendingAutoTrade,
  Signal,
  TradeCloseEvent,
  TradeDirection,
} from '../../types';
import { AUTO_TRADE_STATS_STORAGE_KEY } from './auto-trade-stats-storage';

const STORAGE_KEY = AUTO_TRADE_STATS_STORAGE_KEY;
const SEEN_ID_CAP = 200;
const CLOSE_BUFFER_MS = 5000;

const emptyData = (): AutoTradeStatsData => ({
  wins: 0,
  losses: 0,
  pending: [],
  seenCloseIds: [],
  currentWinStreak: 0,
  currentLossStreak: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
});

function normalizeStoredStats(stored: Partial<AutoTradeStatsData>): AutoTradeStatsData {
  return {
    wins: Number(stored.wins) || 0,
    losses: Number(stored.losses) || 0,
    pending: Array.isArray(stored.pending) ? stored.pending : [],
    seenCloseIds: Array.isArray(stored.seenCloseIds) ? stored.seenCloseIds : [],
    currentWinStreak: Number(stored.currentWinStreak) || 0,
    currentLossStreak: Number(stored.currentLossStreak) || 0,
    longestWinStreak: Number(stored.longestWinStreak) || 0,
    longestLossStreak: Number(stored.longestLossStreak) || 0,
  };
}

function recordOutcome(data: AutoTradeStatsData, outcome: 'win' | 'loss'): void {
  if (outcome === 'win') {
    data.wins += 1;
    data.currentWinStreak += 1;
    data.currentLossStreak = 0;
    data.longestWinStreak = Math.max(data.longestWinStreak, data.currentWinStreak);
    return;
  }

  data.losses += 1;
  data.currentLossStreak += 1;
  data.currentWinStreak = 0;
  data.longestLossStreak = Math.max(data.longestLossStreak, data.currentLossStreak);
}

type StorageAdapter = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (key: string, value: AutoTradeStatsData) => Promise<void>;
};

const chromeSessionViaBackground: StorageAdapter = {
  get: async (key) => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'mtb-auto-stats-get',
      })) as { ok?: boolean; data?: AutoTradeStatsData };
      if (!response?.ok) return {};
      return { [key]: response.data };
    } catch {
      return {};
    }
  },
  set: async (_key, value) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'mtb-auto-stats-set',
        data: value,
      });
    } catch {
      // Keep in-memory stats if background is unavailable.
    }
  },
};

const inMemoryFallback: StorageAdapter = (() => {
  let cache: AutoTradeStatsData | null = null;
  return {
    get: async (key) => ({ [key]: cache }),
    set: async (_key, value) => {
      cache = structuredClone(value);
    },
  };
})();

async function resolveStorageAdapter(): Promise<StorageAdapter> {
  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'mtb-auto-stats-get',
    })) as { ok?: boolean };
    if (response?.ok) return chromeSessionViaBackground;
  } catch {
    // fall through
  }
  return inMemoryFallback;
}

function directionsMatch(
  pending: PendingAutoTrade,
  closeDirection: TradeDirection,
): boolean {
  if (!closeDirection) return true;
  return pending.signal === closeDirection;
}

function isWithinWindow(pending: PendingAutoTrade, closedAt: number): boolean {
  const elapsed = closedAt - pending.placedAt;
  const maxMs = pending.expirySec * 1000 + CLOSE_BUFFER_MS;
  return elapsed >= 0 && elapsed <= maxMs;
}

function pruneExpiredPending(
  pending: PendingAutoTrade[],
  now: number,
): PendingAutoTrade[] {
  return pending.filter((p) => now - p.placedAt <= p.expirySec * 1000 + CLOSE_BUFFER_MS + 30_000);
}

function pendingOpenUntil(pending: PendingAutoTrade): number {
  return pending.placedAt + pending.expirySec * 1000 + CLOSE_BUFFER_MS;
}

function isPendingOpen(pending: PendingAutoTrade, now: number): boolean {
  return now < pendingOpenUntil(pending);
}

export class AutoTradeStatsTracker {
  private data: AutoTradeStatsData = emptyData();
  private storage: StorageAdapter = inMemoryFallback;
  private listeners = new Set<(snapshot: AutoTradeStatsSnapshot) => void>();
  private storageReady: Promise<void>;

  constructor(storage?: StorageAdapter) {
    this.storageReady = storage
      ? Promise.resolve().then(() => {
          this.storage = storage;
        })
      : resolveStorageAdapter().then((adapter) => {
          this.storage = adapter;
        });
  }

  async load(): Promise<void> {
    await this.storageReady;
    const result = await this.storage.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as AutoTradeStatsData | undefined;
    if (!stored) {
      this.data = emptyData();
      return;
    }
    this.data = normalizeStoredStats(stored);
  }

  onUpdate(listener: (snapshot: AutoTradeStatsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): AutoTradeStatsSnapshot {
    return {
      wins: this.data.wins,
      losses: this.data.losses,
      pendingCount: this.data.pending.length,
      longestWinStreak: this.data.longestWinStreak,
      longestLossStreak: this.data.longestLossStreak,
    };
  }

  async reset(): Promise<void> {
    await this.storageReady;
    this.data = emptyData();
    await this.persist();
    try {
      await chrome.runtime.sendMessage({ type: 'mtb-auto-stats-reset' });
    } catch {
      // in-memory reset still applied
    }
    this.emit();
  }

  hasOpenTrade(now: number = Date.now()): boolean {
    this.data.pending = pruneExpiredPending(this.data.pending, now);
    return this.data.pending.some((p) => isPendingOpen(p, now));
  }

  secondsUntilTradeSlot(now: number = Date.now()): number {
    this.data.pending = pruneExpiredPending(this.data.pending, now);
    let minRemaining = 0;
    for (const pending of this.data.pending) {
      const openUntil = pendingOpenUntil(pending);
      if (now >= openUntil) continue;
      const remaining = Math.ceil((openUntil - now) / 1000);
      minRemaining =
        minRemaining === 0 ? remaining : Math.min(minRemaining, remaining);
    }
    return minRemaining;
  }

  registerPendingPlacement(signal: Signal, expirySec: number): void {
    if (signal !== 'HIGHER' && signal !== 'LOWER') return;
    const now = Date.now();
    this.data.pending = pruneExpiredPending(this.data.pending, now);
    this.data.pending.push({
      placedAt: now,
      signal,
      expirySec,
    });
    this.emit();
  }

  rollbackLastPending(): void {
    if (this.data.pending.length === 0) return;
    this.data.pending.pop();
    this.emit();
    void this.persist();
  }

  async persistPendingPlacement(signal: Signal, expirySec: number): Promise<void> {
    await this.storageReady;
    this.registerPendingPlacement(signal, expirySec);
    await this.persist();
  }

  async saveState(): Promise<void> {
    await this.storageReady;
    await this.persist();
  }

  async onAutoTradePlaced(signal: Signal, expirySec: number): Promise<void> {
    await this.persistPendingPlacement(signal, expirySec);
  }

  async onTradeClosed(event: TradeCloseEvent): Promise<boolean> {
    await this.storageReady;
    if (this.data.seenCloseIds.includes(event.id)) return false;

    const now = Date.now();
    this.data.pending = pruneExpiredPending(this.data.pending, now);

    const candidates = this.data.pending.filter(
      (p) =>
        isWithinWindow(p, event.closedAt) &&
        directionsMatch(p, event.direction),
    );

    if (candidates.length === 0) return false;

    const matched = candidates.length === 1
      ? candidates[0]
      : candidates.reduce((best, cur) =>
          Math.abs(event.closedAt - cur.placedAt) <
          Math.abs(event.closedAt - best.placedAt)
            ? cur
            : best,
        );

    this.data.pending = this.data.pending.filter((p) => p !== matched);
    this.data.seenCloseIds.push(event.id);
    if (this.data.seenCloseIds.length > SEEN_ID_CAP) {
      this.data.seenCloseIds = this.data.seenCloseIds.slice(-SEEN_ID_CAP);
    }

    if (event.outcome === 'win') {
      recordOutcome(this.data, 'win');
    } else {
      recordOutcome(this.data, 'loss');
    }

    await this.persist();
    this.emit();
    return true;
  }

  private async persist(): Promise<void> {
    await this.storage.set(STORAGE_KEY, this.data);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export { AUTO_TRADE_STATS_STORAGE_KEY };
