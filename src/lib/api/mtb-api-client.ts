import type { AiDecision, MarketSnapshot } from '@mtb/shared';
import type { AppSettings } from '../../types';
import {
  EXTENSION_RELOAD_MESSAGE,
  isExtensionContextValid,
  toExtensionRuntimeError,
} from '../extension-runtime';

export interface MtbApiConfig {
  apiBaseUrl: string;
  apiKey: string;
}

export interface AiDecisionResponse extends AiDecision {
  id?: string | null;
}

export interface SyncTradePayload {
  externalId: string;
  asset: string;
  timestamp: string;
  expiry: number;
  indicators: MarketSnapshot;
  aiDecision: string;
  confidence: number;
  reasoning: string[];
  risks: string[];
  result?: 'win' | 'loss';
  pnl?: number;
  streak?: number;
  direction?: 'HIGHER' | 'LOWER';
  mode: 'legacy' | 'ai';
  strategyId?: string | null;
  aiDecisionId?: string | null;
}

interface MtbApiProxyResponse {
  ok: boolean;
  status: number;
  body: string;
  message?: string;
}

function baseUrl(config: MtbApiConfig): string {
  return config.apiBaseUrl.replace(/\/$/, '');
}

function headers(config: MtbApiConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-mtb-api-key': config.apiKey,
  };
}

function isContentScriptContext(): boolean {
  return typeof window !== 'undefined';
}

function networkErrorMessage(config: MtbApiConfig, cause: string): string {
  const url = baseUrl(config);
  if (cause.includes('Failed to fetch') || cause.includes('NetworkError')) {
    return `Cannot reach API at ${url} — ensure mastertraderblitz-api is running (npm run dev in mastertraderblitz-api).`;
  }
  return cause;
}

async function mtbApiFetch(
  config: MtbApiConfig,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const url = `${baseUrl(config)}${path}`;

  if (isContentScriptContext()) {
    if (!isExtensionContextValid()) {
      throw new Error(EXTENSION_RELOAD_MESSAGE);
    }

    let proxy: MtbApiProxyResponse | undefined;
    try {
      proxy = (await chrome.runtime.sendMessage({
        type: 'mtb-api-request',
        apiBaseUrl: config.apiBaseUrl,
        apiKey: config.apiKey,
        path,
        method: init.method ?? 'GET',
        body: typeof init.body === 'string' ? init.body : undefined,
      })) as MtbApiProxyResponse | undefined;
    } catch (error) {
      throw toExtensionRuntimeError(error);
    }

    if (!proxy) {
      throw new Error(EXTENSION_RELOAD_MESSAGE);
    }

    if (!proxy.ok && proxy.status === 0) {
      throw new Error(
        networkErrorMessage(config, proxy.message ?? 'Failed to fetch'),
      );
    }

    return new Response(proxy.body, {
      status: proxy.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    return await fetch(url, { ...init, headers: { ...headers(config), ...init.headers } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    throw new Error(networkErrorMessage(config, message));
  }
}

export function isMtbApiConfigured(settings: AppSettings): boolean {
  return Boolean(
    settings.aiBackend.apiBaseUrl.trim() && settings.aiBackend.apiKey.trim(),
  );
}

export async function requestAiDecision(
  config: MtbApiConfig,
  snapshot: MarketSnapshot,
): Promise<AiDecisionResponse> {
  const res = await mtbApiFetch(config, '/api/decide', {
    method: 'POST',
    body: JSON.stringify({ snapshot }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI decision failed (${res.status}): ${err.slice(0, 120)}`);
  }

  return res.json() as Promise<AiDecisionResponse>;
}

export async function syncTradeClose(
  config: MtbApiConfig,
  payload: SyncTradePayload,
): Promise<void> {
  const res = await mtbApiFetch(config, '/api/trades', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Trade sync failed (${res.status}): ${err.slice(0, 120)}`);
  }
}

export async function fetchAiSettings(config: MtbApiConfig) {
  const res = await mtbApiFetch(config, '/api/settings', { method: 'GET' });
  if (!res.ok) return null;
  return res.json();
}
