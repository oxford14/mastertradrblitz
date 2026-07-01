import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAiDecisionState,
  resetAiDecisionState,
  resolveBarCloseDecision,
} from '../decision/decision-adapter';
import { DEFAULT_SETTINGS } from '../settings/defaults';
import type { IndicatorSnapshot } from '../../types';

vi.mock('../api/mtb-api-client', () => ({
  requestAiDecision: vi.fn(),
}));

import { requestAiDecision } from '../api/mtb-api-client';

const mockedRequest = vi.mocked(requestAiDecision);

const baseIndicators = (): IndicatorSnapshot => ({
  rsi: 22,
  stochK: 18,
  stochD: 25,
  price: 1.085,
  bbUpper: 1.09,
  bbLower: 1.08,
  bbMiddle: 1.085,
  stochCrossUp: true,
  stochCrossDown: false,
  crossUpOnThisBar: true,
  crossDownOnThisBar: false,
  bullishCrossValid: true,
  bearishCrossValid: false,
  barsSinceBullishCross: 0,
  barsSinceBearishCross: null,
  warmedUp: true,
  warmupRequired: 20,
  warmupCurrent: 30,
  maFast: 1.086,
  maSlow: 1.084,
  maTrend: 'up',
  cci: -120,
});

const baseInput = () => ({
  settings: {
    ...DEFAULT_SETTINGS,
    tradingMode: 'AI' as const,
    aiBackend: { apiBaseUrl: 'http://localhost:3001', apiKey: 'test-key' },
  },
  asset: 'EURUSD',
  indicators: baseIndicators(),
  pattern: { pattern: 'None', bullishEngulfing: false, bearishEngulfing: false },
  wick: { bullishRejection: false, bearishRejection: false },
  adxResult: { adx: 34, plusDi: 28, minusDi: 12 },
  fractal: { bullish: false, bearish: false },
});

describe('decision-adapter stale AI requests', () => {
  afterEach(() => {
    resetAiDecisionState();
    vi.clearAllMocks();
  });

  it('ignores in-flight API completion after resetAiDecisionState', async () => {
    let resolveApi!: (value: unknown) => void;
    mockedRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveApi = resolve;
      }) as ReturnType<typeof requestAiDecision>,
    );

    const input = baseInput();
    const pending = resolveBarCloseDecision(input);

    resetAiDecisionState();

    resolveApi({
      decision: 'BUY',
      confidence: 90,
      reasoning: ['stale'],
      risks: [],
      supportingIndicators: [],
    });

    const result = await pending;
    expect(getAiDecisionState().decision).toBeNull();
    expect(getAiDecisionState().error).toBeNull();
    expect(getAiDecisionState().loading).toBe(false);
    expect(result.signal).toBe('HIGHER');
  });

  it('does not call API when tradingMode is LEGACY', async () => {
    const input = {
      ...baseInput(),
      settings: { ...baseInput().settings, tradingMode: 'LEGACY' as const },
    };

    await resolveBarCloseDecision(input);

    expect(mockedRequest).not.toHaveBeenCalled();
  });
});
