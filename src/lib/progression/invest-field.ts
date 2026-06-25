const OVERLAY_ROOT_ID = 'mtb-overlay-root';

function normalizeAmount(value: string | null | undefined): number | null {
  if (value == null) return null;
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function isExtensionElement(el: Element): boolean {
  return Boolean(el.closest(`#${OVERLAY_ROOT_ID}`));
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function labelNearInput(input: HTMLInputElement): string {
  const id = input.id;
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent.toLowerCase();
  }
  const parent = input.closest('label, [class*="invest"], [class*="amount"], [class*="stake"]');
  return (parent?.textContent ?? '').toLowerCase();
}

function scoreInvestInput(input: HTMLInputElement): number {
  let score = 0;
  const attrs = [
    input.getAttribute('name'),
    input.getAttribute('id'),
    input.getAttribute('aria-label'),
    input.getAttribute('placeholder'),
    input.getAttribute('data-test-id'),
    input.className,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (attrs.includes('invest')) score += 100;
  if (attrs.includes('amount')) score += 80;
  if (attrs.includes('stake')) score += 60;

  const label = labelNearInput(input);
  if (label.includes('invest')) score += 90;
  if (label.includes('amount')) score += 70;

  const rect = input.getBoundingClientRect();
  if (rect.left > window.innerWidth * 0.5) score += 20;
  if (rect.width >= 40 && rect.height >= 20) score += 10;

  return score;
}

export function findInvestInput(doc: Document = document): HTMLInputElement | null {
  const inputs = Array.from(doc.querySelectorAll('input')).filter(
    (el): el is HTMLInputElement =>
      el instanceof HTMLInputElement &&
      !isExtensionElement(el) &&
      isVisible(el) &&
      !el.disabled &&
      el.type !== 'hidden' &&
      el.type !== 'checkbox' &&
      el.type !== 'radio',
  );

  let best: HTMLInputElement | null = null;
  let bestScore = 0;
  for (const input of inputs) {
    const score = scoreInvestInput(input);
    if (score > bestScore) {
      bestScore = score;
      best = input;
    }
  }

  if (best && bestScore >= 60) return best;

  const panelInputs = inputs.filter((input) => {
    const rect = input.getBoundingClientRect();
    return rect.left > window.innerWidth * 0.55;
  });
  return panelInputs[0] ?? best;
}

export function readInvestAmount(doc: Document = document): number | null {
  const input = findInvestInput(doc);
  if (!input) return null;
  return normalizeAmount(input.value);
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  );
  const setter = descriptor?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
}

function dispatchInputEvents(input: HTMLInputElement): void {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

export interface WriteInvestAmountResult {
  ok: boolean;
  message: string;
}

export function writeInvestAmount(
  stake: number,
  doc: Document = document,
): WriteInvestAmountResult {
  const input = findInvestInput(doc);
  if (!input) {
    return { ok: false, message: 'Invest field not found in DOM' };
  }

  const text = String(Math.round(stake));
  try {
    input.focus({ preventScroll: true });
    setNativeInputValue(input, text);
    dispatchInputEvents(input);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'DOM write failed',
    };
  }

  if (!amountsMatch(stake, readInvestAmount(doc))) {
    return {
      ok: false,
      message: `DOM write did not stick — expected ${text}, saw ${input.value || '(empty)'}`,
    };
  }

  return { ok: true, message: `Stake set to ${text} via DOM` };
}

export function amountsMatch(expected: number, actual: number | null): boolean {
  if (actual == null) return false;
  return Math.abs(actual - expected) <= 1;
}

export async function waitForInvestAmount(
  expected: number,
  doc: Document = document,
  timeoutMs = 800,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (amountsMatch(expected, readInvestAmount(doc))) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return amountsMatch(expected, readInvestAmount(doc));
}
