import type { AppSettings, MinimumSignalConfidence, MinimumSignalEdge } from '../../types';
import { validateSettings } from '../settings/defaults';

export const MAX_PATCH_KEYS_PER_TRADE = 2;

/** Dot-path keys the AI may suggest changing. */
export const SETTINGS_PATCH_WHITELIST = new Set([
  'market.minimumSignalConfidence',
  'market.minimumSignalEdge',
  'market.signalCooldownSec',
  'market.signalHoldSec',
  'rsi.oversold',
  'rsi.overbought',
  'rsi.requireExtreme',
  'stochastic.overbought',
  'stochastic.oversold',
  'stochastic.crossValidityBars',
  'adx.threshold',
  'bollinger.bandProximityPct',
]);

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function setAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = cur[part];
    if (next === null || typeof next !== 'object') {
      cur[part] = {};
    }
    cur = cur[part] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function filterWhitelistedPatch(
  patch: Record<string, unknown>,
  maxKeys = MAX_PATCH_KEYS_PER_TRADE,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(patch)) {
    if (!SETTINGS_PATCH_WHITELIST.has(path)) continue;
    filtered[path] = value;
    if (Object.keys(filtered).length >= maxKeys) break;
  }
  return filtered;
}

export function applySettingsPatch(
  settings: AppSettings,
  patch: Record<string, unknown>,
  maxKeys = MAX_PATCH_KEYS_PER_TRADE,
): { settings: AppSettings; applied: { path: string; before: unknown; after: unknown }[] } {
  const whitelisted = filterWhitelistedPatch(patch, maxKeys);
  const clone = structuredClone(settings) as unknown as Record<string, unknown>;
  const applied: { path: string; before: unknown; after: unknown }[] = [];

  for (const [path, value] of Object.entries(whitelisted)) {
    const before = getAtPath(clone, path);
    if (before === undefined && path.split('.').length > 1) continue;
    setAtPath(clone, path, value);
    const after = getAtPath(clone, path);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      applied.push({ path, before, after });
    }
  }

  const validated = validateSettings(clone as unknown as AppSettings);

  const finalApplied = applied.map((entry) => {
    const after = getAtPath(validated as unknown as Record<string, unknown>, entry.path);
    return { ...entry, after };
  }).filter((entry) => JSON.stringify(entry.before) !== JSON.stringify(entry.after));

  return { settings: validated, applied: finalApplied };
}

export function parseSettingsPatchFromJson(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key === 'string' && key.includes('.')) {
      patch[key] = value;
    }
  }
  return patch;
}

export function coercePatchValue(path: string, value: unknown): unknown {
  if (path === 'market.minimumSignalConfidence') {
    const n = Number(value);
    if ([50, 60, 70, 80, 90].includes(n)) return n as MinimumSignalConfidence;
    return undefined;
  }
  if (path === 'market.minimumSignalEdge') {
    const n = Number(value);
    if ([3, 5, 10].includes(n)) return n as MinimumSignalEdge;
    return undefined;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

export function sanitizePatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(patch)) {
    const coerced = coercePatchValue(path, value);
    if (coerced !== undefined) out[path] = coerced;
  }
  return out;
}
