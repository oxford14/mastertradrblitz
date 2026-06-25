import type { ProgressionProfileId, ProgressionSettings } from '../../types';

export const PROGRESSION_PROFILE_IDS: ProgressionProfileId[] = [
  'D50',
  'D100',
  'D200',
  'D300',
  'D500',
  'D1000',
  'AD50',
  'AD100',
  'AD200',
  'AD300',
  'AD500',
  'AD1000',
  'Custom',
];

export const PROGRESSION_TABLES: Record<
  Exclude<ProgressionProfileId, 'Custom'>,
  readonly number[]
> = {
  D50: [50, 122, 271, 602, 1338, 2973, 6607, 14683, 32628, 72507],
  D100: [100, 244, 542, 1204, 2676, 5945, 13214, 29366, 65255, 145014],
  D200: [200, 488, 1084, 2408, 5352, 11890, 26428, 58731, 130510, 290028],
  D300: [300, 732, 1626, 3612, 8028, 17835, 39642, 88097, 195765, 435041],
  D500: [500, 1220, 2710, 6020, 13380, 29725, 66070, 146828, 326275, 725069],
  D1000: [1000, 2439, 5420, 12041, 26760, 59449, 132139, 293655, 652549, 1450137],
  AD50: [50, 183, 528, 1440, 3850, 10078, 26477, 70205, 187186, 501021],
  AD100: [100, 366, 1056, 2880, 7699, 20155, 52954, 140410, 374371, 1002044],
  AD200: [200, 732, 2112, 5760, 15398, 40310, 105907, 280820, 748743, 2004088],
  AD300: [300, 1098, 3168, 8640, 23097, 60465, 158861, 421230, 1123114, 3006132],
  AD500: [500, 1830, 5280, 14400, 38495, 100775, 264768, 702050, 1871857, 5010220],
  AD1000: [1000, 3660, 10560, 28800, 76990, 201550, 529536, 1404099, 3743714, 10020439],
};

export const DEFAULT_CUSTOM_LEVELS = [...PROGRESSION_TABLES.D200];

export function isProgressionProfileId(value: string): value is ProgressionProfileId {
  return PROGRESSION_PROFILE_IDS.includes(value as ProgressionProfileId);
}

export function getProgressionTable(settings: ProgressionSettings): number[] {
  if (settings.profileId === 'Custom') {
    return settings.customLevels.slice(0, 10);
  }
  return [...PROGRESSION_TABLES[settings.profileId]];
}

export function stakeForLevel(table: number[], level: number): number {
  const index = Math.min(Math.max(Math.round(level), 1), 10) - 1;
  return table[index] ?? table[0] ?? 0;
}
