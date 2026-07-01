import type { AutoTradeDirectionFilter } from '../../types';

export function normalizeAutoTradeDirectionFilter(
  value: unknown,
): AutoTradeDirectionFilter {
  if (value === 'higher' || value === 'lower' || value === 'both') return value;
  return 'both';
}

export function isAutoTradeSignalAllowed(
  filter: AutoTradeDirectionFilter,
  signal: 'HIGHER' | 'LOWER',
): boolean {
  if (filter === 'both') return true;
  if (filter === 'higher') return signal === 'HIGHER';
  return signal === 'LOWER';
}

export function autoTradeDirectionFilterLabel(filter: AutoTradeDirectionFilter): string {
  if (filter === 'higher') return 'HIGHER only';
  if (filter === 'lower') return 'LOWER only';
  return 'both directions';
}

export function autoTradeDirectionSkipMessage(
  filter: AutoTradeDirectionFilter,
  signal: 'HIGHER' | 'LOWER',
): string {
  return `Skipped ${signal} — auto-click filter is ${autoTradeDirectionFilterLabel(filter)}`;
}
