/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateInvestAmount } from '../progression/amount-updater';
import type { ProgressionSettings } from '../../types';

vi.mock('../exnova/trusted-click-client', () => ({
  requestPasteAmount: vi.fn(),
  requestTypeAmount: vi.fn(),
  requestKeypadAmount: vi.fn(),
}));

import {
  requestPasteAmount,
  requestTypeAmount,
  requestKeypadAmount,
} from '../exnova/trusted-click-client';

const baseProgression = (
  overrides: Partial<ProgressionSettings> = {},
): ProgressionSettings => ({
  enabled: true,
  profileId: 'D200',
  customLevels: [200, 488, 1084, 2408, 5352, 11890, 26428, 58731, 130510, 290028],
  maxLevel: 10,
  resetOnWin: true,
  advanceOnLoss: true,
  amountField: null,
  amountEntryMode: 'hybrid',
  ...overrides,
});

describe('updateInvestAmount', () => {
  beforeEach(() => {
    vi.mocked(requestPasteAmount).mockReset();
    vi.mocked(requestTypeAmount).mockReset();
    vi.mocked(requestKeypadAmount).mockReset();
    document.body.innerHTML = '';
  });

  it('returns dry-run message without native call', async () => {
    const result = await updateInvestAmount({
      stake: 1084,
      dryRun: true,
      progression: baseProgression(),
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Dry run');
    expect(requestPasteAmount).not.toHaveBeenCalled();
  });

  it('uses Python paste in hybrid mode', async () => {
    vi.mocked(requestPasteAmount).mockResolvedValue({ ok: true, message: 'pasted 1084' });

    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Invest');
    input.value = '1084';
    document.body.appendChild(input);

    const result = await updateInvestAmount({
      stake: 1084,
      dryRun: false,
      progression: baseProgression(),
    });

    expect(requestPasteAmount).toHaveBeenCalledWith({ amount: '1084' });
    expect(requestTypeAmount).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('falls back to VK typing when paste verify fails', async () => {
    vi.mocked(requestPasteAmount).mockResolvedValue({ ok: true, message: 'pasted 1084' });
    vi.mocked(requestTypeAmount).mockResolvedValue({ ok: true, message: 'typed' });

    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Invest');
    let internal = '200';
    Object.defineProperty(input, 'value', {
      get: () => internal,
      set: () => {},
      configurable: true,
    });
    document.body.appendChild(input);

    const result = await updateInvestAmount({
      stake: 1084,
      dryRun: false,
      progression: baseProgression(),
    });

    expect(requestTypeAmount).toHaveBeenCalledWith({ amount: '1084' });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('verify failed');
  });

  it('surfaces native helper errors on paste', async () => {
    vi.mocked(requestPasteAmount).mockResolvedValue({
      ok: false,
      message: 'Python not found — install Python 3 and run: pip install -r helper\\requirements.txt',
    });

    const result = await updateInvestAmount({
      stake: 200,
      dryRun: false,
      progression: baseProgression(),
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Python');
  });

  it('uses keypad native path when amountEntryMode is keypad', async () => {
    vi.mocked(requestKeypadAmount).mockResolvedValue({ ok: true, message: 'keypad' });

    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Invest');
    input.value = '488';
    document.body.appendChild(input);

    const result = await updateInvestAmount({
      stake: 488,
      dryRun: false,
      progression: baseProgression({ amountEntryMode: 'keypad' }),
    });

    expect(requestKeypadAmount).toHaveBeenCalledWith({ amount: '488' });
    expect(requestPasteAmount).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('trusts native helper when invest field is not readable in DOM', async () => {
    vi.mocked(requestPasteAmount).mockResolvedValue({ ok: true, message: 'pasted 488' });
    vi.mocked(requestTypeAmount).mockResolvedValue({ ok: true, message: 'typed' });

    const result = await updateInvestAmount({
      stake: 488,
      dryRun: false,
      progression: baseProgression(),
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('DOM not readable');
  });
});
