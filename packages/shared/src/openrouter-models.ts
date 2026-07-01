export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3.5-flash';

export const OPENROUTER_MODEL_CUSTOM = '__custom__';

export interface OpenRouterModelPreset {
  id: string;
  label: string;
}

export const OPENROUTER_MODEL_PRESETS: OpenRouterModelPreset[] = [
  { id: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash (default)' },
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
];

const MODEL_ALIASES: Record<string, string> = {
  'google/gemini-2.0-flash-001': 'google/gemini-3.5-flash',
  'google/gemini-2.0-flash': 'google/gemini-3.5-flash',
  'gemini-2.0-flash': 'google/gemini-3.5-flash',
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-3.5': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-3-5-sonnet': 'anthropic/claude-sonnet-4.6',
  'claude-3.5-sonnet': 'anthropic/claude-sonnet-4.6',
  'anthropic/claude-3.5-haiku': 'anthropic/claude-haiku-4.5',
  'claude-3.5-haiku': 'anthropic/claude-haiku-4.5',
};

const PRESET_IDS = new Set(OPENROUTER_MODEL_PRESETS.map((p) => p.id));

export function isKnownOpenRouterPreset(model: string): boolean {
  return PRESET_IDS.has(model);
}

export function normalizeOpenRouterModel(input: string | undefined | null): string {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!trimmed) return DEFAULT_OPENROUTER_MODEL;

  const lower = trimmed.toLowerCase();
  const alias = MODEL_ALIASES[lower] ?? MODEL_ALIASES[trimmed];
  if (alias) return alias;

  return trimmed;
}

export function resolveModelSelectValue(model: string): string {
  return isKnownOpenRouterPreset(model) ? model : OPENROUTER_MODEL_CUSTOM;
}
