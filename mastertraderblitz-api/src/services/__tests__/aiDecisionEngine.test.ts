import { describe, expect, it } from 'vitest';
import { AiDecisionSchema } from '@mtb/shared';

describe('AiDecisionSchema', () => {
  it('validates a well-formed decision', () => {
    const result = AiDecisionSchema.safeParse({
      decision: 'BUY',
      confidence: 92,
      reasoning: ['Strong trend', 'Bullish MACD crossover'],
      risks: ['Near resistance'],
      supportingIndicators: ['RSI', 'MACD'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid decision values', () => {
    const result = AiDecisionSchema.safeParse({
      decision: 'HOLD',
      confidence: 50,
      reasoning: [],
      risks: [],
    });
    expect(result.success).toBe(false);
  });
});
