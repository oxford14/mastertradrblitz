import type { Signal } from '../../types';

const HIGHER_TERMS = ['higher', 'up', 'call', 'buy', 'above', 'rise'];
const LOWER_TERMS = ['lower', 'down', 'put', 'sell', 'below', 'fall'];

const CLICKABLE =
  'button, [role="button"], a[href], [data-test-id], [class*="button"], [class*="Button"], [class*="call"], [class*="put"], [class*="higher"], [class*="lower"]';

const OVERLAY_ROOT_ID = 'mtb-overlay-root';

function termsFor(signal: Signal): string[] {
  return signal === 'HIGHER' ? HIGHER_TERMS : LOWER_TERMS;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function elementLabel(el: Element): string {
  const aria = el.getAttribute('aria-label');
  const title = el.getAttribute('title');
  const text = el.textContent;
  const dataDir = el.getAttribute('data-direction');
  const className = el.getAttribute('class');
  return normalizeText(
    [aria, title, text, dataDir, className].filter(Boolean).join(' '),
  );
}

function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

function isExtensionElement(el: Element): boolean {
  return Boolean(el.closest(`#${OVERLAY_ROOT_ID}`));
}

function isInTradingPanel(rect: DOMRect): boolean {
  return rect.left > window.innerWidth * 0.5 && rect.width >= 40 && rect.height >= 24;
}

function scoreMatch(label: string, terms: string[]): number {
  if (!label) return 0;
  for (const term of terms) {
    if (label === term) return 100;
    if (label.includes(term)) return 80;
  }
  return 0;
}

function clickableTarget(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el;
  while (node) {
    const style = window.getComputedStyle(node);
    if (style.cursor === 'pointer') return node;
    if (node.tagName === 'BUTTON' || node.getAttribute('role') === 'button') {
      return node;
    }
    node = node.parentElement;
  }
  return el;
}

function scoreExnovaCandidate(
  el: HTMLElement,
  signal: 'HIGHER' | 'LOWER',
): number {
  const label = elementLabel(el);
  const targetWord = signal === 'HIGHER' ? 'higher' : 'lower';
  if (!label.includes(targetWord)) return 0;

  const rect = el.getBoundingClientRect();
  let score = 40;
  if (label === targetWord) score += 35;
  if (label.startsWith(`${targetWord} `)) score += 20;
  if (isInTradingPanel(rect)) score += 35;
  score -= Math.min(25, (rect.width * rect.height) / 8000);
  return score;
}

export function findTradeButton(
  signal: 'HIGHER' | 'LOWER',
  root: Document | Element,
): HTMLElement | null {
  const terms = termsFor(signal);
  let best: HTMLElement | null = null;
  let bestScore = 0;

  const nodes = root.querySelectorAll(CLICKABLE);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (!isVisible(node) || isExtensionElement(node)) continue;
    const label = elementLabel(node);
    const score = scoreMatch(label, terms);
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }

  if (bestScore >= 80 && best) return clickableTarget(best);

  const broad = root.querySelectorAll(
    'div, span, button, a, p, label, [role="button"]',
  );
  const candidates: { el: HTMLElement; score: number }[] = [];

  for (const node of broad) {
    if (!(node instanceof HTMLElement)) continue;
    if (!isVisible(node) || isExtensionElement(node)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) continue;

    const score = scoreExnovaCandidate(node, signal);
    if (score > 0) {
      candidates.push({ el: clickableTarget(node), score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 55 ? candidates[0].el : null;
}

export function searchDocuments(
  doc: Document,
  signal: 'HIGHER' | 'LOWER',
): HTMLElement | null {
  const direct = findTradeButton(signal, doc);
  if (direct) return direct;

  const iframes = doc.querySelectorAll('iframe');
  for (const iframe of iframes) {
    try {
      const nested = iframe.contentDocument;
      if (!nested) continue;
      const found = searchDocuments(nested, signal);
      if (found) return found;
    } catch {
      // Cross-origin iframe — skip.
    }
  }

  return null;
}

export function buttonCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function viewportToScreen(
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const chromeTop = window.outerHeight - window.innerHeight;
  return {
    x: window.screenX + clientX,
    y: window.screenY + chromeTop + clientY,
  };
}
