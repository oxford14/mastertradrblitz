import type {
  AppSettings,
  ProgressionSnapshot,
  ProgressionStateData,
  TradeOutcome,
} from '../../types';
import { PROGRESSION_STATE_STORAGE_KEY } from './progression-state-storage';
import { getProgressionTable, stakeForLevel } from './tables';

const emptyState = (): ProgressionStateData => ({
  currentLevel: 1,
  stopped: false,
  lastAppliedStake: 0,
  lastWarning: null,
});

type StorageAdapter = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (key: string, value: ProgressionStateData) => Promise<void>;
};

const chromeSessionViaBackground: StorageAdapter = {
  get: async (key) => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'mtb-progression-state-get',
      })) as { ok?: boolean; data?: ProgressionStateData };
      if (!response?.ok) return {};
      return { [key]: response.data };
    } catch {
      return {};
    }
  },
  set: async (_key, value) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'mtb-progression-state-set',
        data: value,
      });
    } catch {
      // Keep in-memory state if background is unavailable.
    }
  },
};

const inMemoryFallback: StorageAdapter = (() => {
  let cache: ProgressionStateData | null = null;
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
      type: 'mtb-progression-state-get',
    })) as { ok?: boolean };
    if (response?.ok) return chromeSessionViaBackground;
  } catch {
    // fall through
  }
  return inMemoryFallback;
}

export type AmountUpdateRequest = {
  stake: number;
  dryRun: boolean;
};

export type ProgressionManagerDeps = {
  getSettings: () => AppSettings;
  updateAmount: (request: AmountUpdateRequest) => Promise<{ ok: boolean; message: string }>;
};

export class ProgressionManager {
  private state: ProgressionStateData = emptyState();
  private storage: StorageAdapter = inMemoryFallback;
  private storageReady: Promise<void>;
  private listeners = new Set<(snapshot: ProgressionSnapshot) => void>();
  private updatingAmount = false;
  private amountQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly deps: ProgressionManagerDeps,
    storage?: StorageAdapter,
  ) {
    this.storageReady = storage
      ? Promise.resolve().then(() => {
          this.storage = storage;
        })
      : resolveStorageAdapter().then((adapter) => {
          this.storage = adapter;
        });
  }

  async load(): Promise<{ recoveredFromStop: boolean }> {
    await this.storageReady;
    const result = await this.storage.get(PROGRESSION_STATE_STORAGE_KEY);
    const stored = result[PROGRESSION_STATE_STORAGE_KEY] as ProgressionStateData | undefined;
    let recoveredFromStop = false;
    if (stored) {
      const wasStopped = Boolean(stored.stopped);
      if (wasStopped) {
        recoveredFromStop = true;
        this.state = {
          currentLevel: 1,
          stopped: false,
          lastAppliedStake: Number(stored.lastAppliedStake) || 0,
          lastWarning: null,
        };
        await this.persist();
        this.emit();
        void this.queueAmountUpdate();
      } else {
        this.state = {
          currentLevel: Math.min(Math.max(Number(stored.currentLevel) || 1, 1), 10),
          stopped: false,
          lastAppliedStake: Number(stored.lastAppliedStake) || 0,
          lastWarning: stored.lastWarning ?? null,
        };
      }
    } else {
      this.state = emptyState();
    }
    return { recoveredFromStop };
  }

  onUpdate(listener: (snapshot: ProgressionSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ProgressionSnapshot {
    const progression = this.deps.getSettings().progression;
    const table = getProgressionTable(progression);
    const stake = stakeForLevel(table, this.state.currentLevel);
    return {
      profileId: progression.profileId,
      level: this.state.currentLevel,
      stake,
      stopped: this.state.stopped,
      lastWarning: this.state.lastWarning,
    };
  }

  async reset(): Promise<void> {
    await this.storageReady;
    this.state = emptyState();
    await this.persist();
    this.emit();
    await this.queueAmountUpdate();
  }

  async clearStop(): Promise<void> {
    await this.storageReady;
    this.state.stopped = false;
    this.state.lastWarning = null;
    await this.persist();
    this.emit();
  }

  async applyProfileChange(): Promise<void> {
    await this.storageReady;
    const progression = this.deps.getSettings().progression;
    if (!progression.enabled) return;
    this.state.currentLevel = 1;
    this.state.stopped = false;
    this.state.lastWarning = null;
    await this.persist();
    this.emit();
    await this.queueAmountUpdate();
  }

  async testAmountUpdate(): Promise<{ ok: boolean; message: string }> {
    const snapshot = this.getSnapshot();
    return this.deps.updateAmount({
      stake: snapshot.stake,
      dryRun: this.deps.getSettings().autoTrade.dryRun,
    });
  }

  async ensureAmountApplied(): Promise<{ ok: boolean; message: string }> {
    await this.storageReady;
    const progression = this.deps.getSettings().progression;
    if (!progression.enabled) {
      return { ok: true, message: 'Progression disabled' };
    }

    const snapshot = this.getSnapshot();
    if (
      snapshot.stake === this.state.lastAppliedStake &&
      this.state.lastAppliedStake > 0 &&
      !this.state.lastWarning
    ) {
      return { ok: true, message: 'Stake already applied' };
    }

    await this.queueAmountUpdate();

    if (this.state.lastWarning) {
      return { ok: false, message: this.state.lastWarning };
    }

    const current = this.getSnapshot();
    if (current.stake !== this.state.lastAppliedStake) {
      return { ok: false, message: 'Stake field did not match progression level' };
    }

    return { ok: true, message: 'Stake applied' };
  }

  async onTradeResult(outcome: TradeOutcome, attributed: boolean): Promise<void> {
    await this.storageReady;
    const progression = this.deps.getSettings().progression;
    if (!progression.enabled || !attributed) return;
    if (outcome === 'win') {
      if (!progression.resetOnWin) return;
      this.state.currentLevel = 1;
      this.state.lastWarning = null;
      await this.persist();
      this.emit();
      await this.queueAmountUpdate();
      return;
    }

    if (!progression.advanceOnLoss) return;

    if (this.state.currentLevel >= progression.maxLevel) {
      this.state.currentLevel = 1;
      this.state.lastWarning = null;
      await this.persist();
      this.emit();
      await this.queueAmountUpdate();
      return;
    }

    this.state.currentLevel += 1;
    this.state.lastWarning = null;
    await this.persist();
    this.emit();
    await this.queueAmountUpdate();
  }

  async setWarning(message: string): Promise<void> {
    await this.storageReady;
    this.state.lastWarning = message;
    await this.persist();
    this.emit();
  }

  private async queueAmountUpdate(): Promise<void> {
    this.amountQueue = this.amountQueue.then(() => this.runAmountUpdate());
    await this.amountQueue;
  }

  private async runAmountUpdate(): Promise<void> {
    if (this.updatingAmount) return;
    const progression = this.deps.getSettings().progression;
    if (!progression.enabled) return;

    this.updatingAmount = true;
    try {
      const snapshot = this.getSnapshot();
      const result = await this.deps.updateAmount({
        stake: snapshot.stake,
        dryRun: this.deps.getSettings().autoTrade.dryRun,
      });
      if (result.ok) {
        this.state.lastAppliedStake = snapshot.stake;
        this.state.lastWarning = null;
      } else {
        this.state.lastWarning = result.message;
      }
      await this.persist();
      this.emit();
    } finally {
      this.updatingAmount = false;
    }
  }

  private async persist(): Promise<void> {
    await this.storage.set(PROGRESSION_STATE_STORAGE_KEY, this.state);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
