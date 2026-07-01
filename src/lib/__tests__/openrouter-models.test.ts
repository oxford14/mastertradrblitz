import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENROUTER_MODEL,
  normalizeOpenRouterModel,
  resolveModelSelectValue,
} from '../ai/openrouter-models';

describe('normalizeOpenRouterModel', () => {
  it('returns default for empty input', () => {
    expect(normalizeOpenRouterModel('')).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(normalizeOpenRouterModel(null)).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it('maps incomplete Claude slug to Sonnet', () => {
    expect(normalizeOpenRouterModel('anthropic/claude-3.5')).toBe(
      'anthropic/claude-sonnet-4.6',
    );
  });

  it('maps shorthand slugs to full provider paths', () => {
    expect(normalizeOpenRouterModel('claude-3.5-sonnet')).toBe(
      'anthropic/claude-sonnet-4.6',
    );
    expect(normalizeOpenRouterModel('gemini-2.0-flash')).toBe(
      'google/gemini-3.5-flash',
    );
  });

  it('maps retired preset slugs to current OpenRouter models', () => {
    expect(normalizeOpenRouterModel('google/gemini-2.0-flash-001')).toBe(
      'google/gemini-3.5-flash',
    );
    expect(normalizeOpenRouterModel('anthropic/claude-3.5-haiku')).toBe(
      'anthropic/claude-haiku-4.5',
    );
  });
});

describe('resolveModelSelectValue', () => {
  it('returns preset id for known models', () => {
    expect(resolveModelSelectValue('google/gemini-3.5-flash')).toBe(
      'google/gemini-3.5-flash',
    );
  });

  it('returns custom marker for unknown models', () => {
    expect(resolveModelSelectValue('some/vendor-model')).toBe('__custom__');
  });
});
