import type { ProgressionSettings } from '../../types';
import {
  requestKeypadAmount,
  requestPasteAmount,
  requestTypeAmount,
} from '../exnova/trusted-click-client';
import {
  amountsMatch,
  readInvestAmount,
  waitForInvestAmount,
} from './invest-field';

export interface AmountUpdateOptions {
  stake: number;
  dryRun: boolean;
  progression: ProgressionSettings;
  doc?: Document;
}

export interface AmountUpdateResult {
  ok: boolean;
  message: string;
}

function formatStake(stake: number): string {
  return String(Math.round(stake));
}

async function verifyStake(
  rounded: number,
  doc: Document,
  methodLabel: string,
): Promise<AmountUpdateResult> {
  const domReadable = readInvestAmount(doc) != null;
  if (!domReadable) {
    return {
      ok: true,
      message: `Stake set to ${rounded} via ${methodLabel} (DOM not readable)`,
    };
  }

  let verified = await waitForInvestAmount(rounded, doc, 600);
  if (!verified) {
    await new Promise((r) => setTimeout(r, 300));
    verified = await waitForInvestAmount(rounded, doc, 600);
  }

  if (verified) {
    return { ok: true, message: `Stake set to ${rounded}` };
  }

  const actual = readInvestAmount(doc);
  if (actual == null) {
    return {
      ok: true,
      message: `Stake set to ${rounded} via ${methodLabel} (DOM not readable)`,
    };
  }

  return {
    ok: false,
    message: `Amount verify failed — expected ${rounded}, saw ${actual}`,
  };
}

export async function updateInvestAmount(
  options: AmountUpdateOptions,
): Promise<AmountUpdateResult> {
  const { stake, dryRun, progression } = options;
  const doc = options.doc ?? document;
  const rounded = Math.round(stake);
  const amountText = formatStake(rounded);

  if (dryRun) {
    return {
      ok: true,
      message: `Dry run: would set stake to ${rounded}`,
    };
  }

  if (progression.amountEntryMode === 'keypad') {
    const keypad = await requestKeypadAmount({ amount: amountText });
    if (!keypad.ok) {
      return {
        ok: false,
        message: keypad.message || 'Native keypad amount entry failed',
      };
    }
    return verifyStake(rounded, doc, 'keypad clicks');
  }

  const paste = await requestPasteAmount({ amount: amountText });
  if (!paste.ok) {
    const msg = paste.message || 'Python paste failed';
    const needsPip =
      /python not found|missing dependency|paste_amount|no module named/i.test(msg);
    return {
      ok: false,
      message: needsPip
        ? `${msg} — run: pip install -r helper\\requirements.txt`
        : msg,
    };
  }

  const pasteVerified = await verifyStake(rounded, doc, 'Python paste');
  if (pasteVerified.ok) return pasteVerified;

  const typed = await requestTypeAmount({ amount: amountText });
  if (!typed.ok) {
    return {
      ok: false,
      message: typed.message || 'Native VK typing failed',
    };
  }

  const vkVerified = await verifyStake(rounded, doc, 'native VK typing');
  if (!vkVerified.ok) {
    return {
      ok: false,
      message:
        vkVerified.message +
        ' Try keypad entry mode after calibrating digits in helper\\run-keypad-calibrator.bat.',
    };
  }
  return vkVerified;
}

export { amountsMatch, readInvestAmount };
