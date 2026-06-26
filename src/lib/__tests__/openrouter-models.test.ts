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
      'anthropic/claude-3.5-sonnet',
    );
  });

  it('maps shorthand slugs to full provider paths', () => {
    expect(normalizeOpenRouterModel('claude-3.5-sonnet')).toBe(
      'anthropic/claude-3.5-sonnet',
    );
    expect(normalizeOpenRouterModel('gemini-2.0-flash')).toBe(
      'google/gemini-2.0-flash-001',
    );
  });

  it('passes through valid preset slugs unchanged', () => {
    expect(normalizeOpenRouterModel('google/gemini-2.0-flash-001')).toBe(
      'google/gemini-2.0-flash-001',
    );
    expect(normalizeOpenRouterModel('anthropic/claude-3.5-haiku')).toBe(
      'anthropic/claude-3.5-haiku',
    );
  });
});

describe('resolveModelSelectValue', () => {
  it('returns preset id for known models', () => {
    expect(resolveModelSelectValue('google/gemini-2.0-flash-001')).toBe(
      'google/gemini-2.0-flash-001',
    );
  });

  it('returns custom marker for unknown models', () => {
    expect(resolveModelSelectValue('some/vendor-model')).toBe('__custom__');
  });
});
