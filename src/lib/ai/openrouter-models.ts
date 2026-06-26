export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

export const OPENROUTER_MODEL_CUSTOM = '__custom__';

export interface OpenRouterModelPreset {
  id: string;
  label: string;
}

export const OPENROUTER_MODEL_PRESETS: OpenRouterModelPreset[] = [
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (default)' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B Instruct' },
];

const MODEL_ALIASES: Record<string, string> = {
  'anthropic/claude-3.5': 'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-5-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'claude-3.5-haiku': 'anthropic/claude-3.5-haiku',
  'gemini-2.0-flash': 'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash': 'google/gemini-2.0-flash-001',
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
