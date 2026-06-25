import { describe, expect, it } from 'vitest';
import {
  getProgressionTable,
  PROGRESSION_TABLES,
  stakeForLevel,
} from '../progression/tables';
import type { ProgressionSettings } from '../../types';

describe('progression tables', () => {
  it('D200 values match spec', () => {
    expect(PROGRESSION_TABLES.D200).toEqual([
      200, 488, 1084, 2408, 5352, 11890, 26428, 58731, 130510, 290028,
    ]);
  });

  it('AD50 values match spec', () => {
    expect(PROGRESSION_TABLES.AD50).toEqual([
      50, 183, 528, 1440, 3850, 10078, 26477, 70205, 187186, 501021,
    ]);
  });

  it('AD1000 values match spec', () => {
    expect(PROGRESSION_TABLES.AD1000).toEqual([
      1000, 3660, 10560, 28800, 76990, 201550, 529536, 1404099, 3743714, 10020439,
    ]);
  });

  it('returns custom levels when profile is Custom', () => {
    const settings: ProgressionSettings = {
      enabled: true,
      profileId: 'Custom',
      customLevels: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      maxLevel: 10,
      resetOnWin: true,
      advanceOnLoss: true,
      amountField: null,
    };
    expect(getProgressionTable(settings)).toEqual(settings.customLevels);
  });

  it('stakeForLevel clamps to table bounds', () => {
    const table = PROGRESSION_TABLES.D50;
    expect(stakeForLevel(table, 1)).toBe(50);
    expect(stakeForLevel(table, 10)).toBe(72507);
    expect(stakeForLevel(table, 99)).toBe(72507);
  });
});
