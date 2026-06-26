/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ProgressionManager } from '../progression/progression-manager';
import { PROGRESSION_STATE_STORAGE_KEY } from '../progression/progression-state-storage';
import type { AppSettings, ProgressionStateData } from '../../types';
import { DEFAULT_SETTINGS } from '../settings/defaults';

function createMemoryStorage() {
  let store: ProgressionStateData | null = null;
  return {
    get: async (key: string) => ({ [key]: store }),
    set: async (_key: string, value: ProgressionStateData) => {
      store = structuredClone(value);
    },
    raw: () => store,
  };
}

function baseSettings(overrides: Partial<AppSettings['progression']> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    progression: {
      ...DEFAULT_SETTINGS.progression,
      enabled: true,
      ...overrides,
    },
  };
}

describe('ProgressionManager', () => {
  let memory: ReturnType<typeof createMemoryStorage>;
  let settings: AppSettings;
  let updateAmount: ReturnType<typeof vi.fn>;
  let manager: ProgressionManager;

  beforeEach(async () => {
    memory = createMemoryStorage();
    settings = baseSettings();
    updateAmount = vi.fn(async () => ({ ok: true, message: 'ok' }));
    manager = new ProgressionManager(
      {
        getSettings: () => settings,
        updateAmount,
      },
      memory,
    );
    await manager.load();
  });

  it('resets to L1 on win when resetOnWin is enabled', async () => {
    await memory.set(PROGRESSION_STATE_STORAGE_KEY, {
      currentLevel: 4,
      stopped: false,
      lastAppliedStake: 2408,
      lastWarning: null,
    });
    await manager.load();

    await manager.onTradeResult('win', true);

    expect(manager.getSnapshot().level).toBe(1);
    expect(manager.getSnapshot().stake).toBe(200);
    expect(updateAmount).toHaveBeenCalled();
  });

  it('advances one level on loss', async () => {
    await manager.onTradeResult('loss', true);
    expect(manager.getSnapshot().level).toBe(2);
    expect(manager.getSnapshot().stake).toBe(488);
    expect(updateAmount).toHaveBeenCalledTimes(1);
  });

  it('resets to L1 when at max level on loss', async () => {
    settings = baseSettings({ maxLevel: 3 });
    await memory.set(PROGRESSION_STATE_STORAGE_KEY, {
      currentLevel: 3,
      stopped: false,
      lastAppliedStake: 1084,
      lastWarning: null,
    });
    await manager.load();

    await manager.onTradeResult('loss', true);

    expect(manager.getSnapshot().level).toBe(1);
    expect(manager.getSnapshot().stake).toBe(200);
    expect(manager.getSnapshot().stopped).toBe(false);
    expect(manager.getSnapshot().lastWarning).toBeNull();
    expect(updateAmount).toHaveBeenCalled();
  });

  it('resets to L1 on L2 loss when max level is L2', async () => {
    settings = baseSettings({ maxLevel: 2, profileId: 'AD50' });
    await memory.set(PROGRESSION_STATE_STORAGE_KEY, {
      currentLevel: 2,
      stopped: false,
      lastAppliedStake: 183,
      lastWarning: null,
    });
    await manager.load();

    await manager.onTradeResult('loss', true);

    expect(manager.getSnapshot().level).toBe(1);
    expect(manager.getSnapshot().stake).toBe(50);
    expect(updateAmount).toHaveBeenCalled();
  });

  it('clears legacy stopped state on load', async () => {
    await memory.set(PROGRESSION_STATE_STORAGE_KEY, {
      currentLevel: 5,
      stopped: true,
      lastAppliedStake: 5000,
      lastWarning: 'Stop Loss Reached — Maximum progression exceeded',
    });
    const { recoveredFromStop } = await manager.load();

    expect(recoveredFromStop).toBe(true);
    expect(manager.getSnapshot().level).toBe(1);
    expect(manager.getSnapshot().stopped).toBe(false);
    expect(manager.getSnapshot().lastWarning).toBeNull();
    expect(memory.raw()?.stopped).toBe(false);
    expect(memory.raw()?.currentLevel).toBe(1);
    expect(updateAmount).toHaveBeenCalled();
  });

  it('ignores unattributed closes', async () => {
    await manager.onTradeResult('loss', false);
    expect(manager.getSnapshot().level).toBe(1);
    expect(updateAmount).not.toHaveBeenCalled();
  });

  it('does not double-advance on sequential losses', async () => {
    await manager.onTradeResult('loss', true);
    await manager.onTradeResult('loss', true);
    expect(manager.getSnapshot().level).toBe(3);
    expect(updateAmount).toHaveBeenCalledTimes(2);
  });

  it('uses custom table stakes', async () => {
    settings = baseSettings({
      profileId: 'Custom',
      customLevels: [11, 22, 33, 44, 55, 66, 77, 88, 99, 110],
    });
    await manager.onTradeResult('loss', true);
    expect(manager.getSnapshot().stake).toBe(22);
  });
});
