# Master Trader Blitz

Chrome Extension (MV3) for [trade.exnova.com](https://trade.exnova.com) that generates **HIGHER**, **LOWER**, or **WAIT** signals using dual-confidence scoring from RSI, Stochastic, engulfing patterns, Bollinger touch, and rejection wicks.

## Features

- Intercepts Exnova WebSocket traffic (no OCR, no screen capture, no AI)
- Builds OHLC bars from tick stream (works with line charts)
- **Trader-first overlay:** dual HIGHER/LOWER confidence %, hero signal, Requirements checklist
- **Threshold-based entries:** configurable minimum confidence (50–90%, default 70%)
- **Edge rule:** when both sides exceed threshold, minimum edge gap (3/5/10%, default 5%) picks the winner
- Collapsible **Advanced** panel for raw values and score breakdown
- **Optional auto-click** on Exnova HIGHER/LOWER (dry-run by default)
- Trade expiry presets: **5s, 10s, 15s, 30s**

## Signal formulas

Each side scores independently (0–100):

| Evidence | HIGHER | LOWER | Points |
|----------|--------|-------|--------|
| RSI extreme | ≤ oversold | ≥ overbought | 25 |
| Stochastic cross | Cross up | Cross down | 30 |
| Engulfing pattern | Bullish | Bearish | 25 |
| Bollinger touch | Near lower band | Near upper band | 5 |
| Rejection wick | Bullish | Bearish | 15 |

**Signal rules:**

- If HIGHER score ≥ minimum confidence → **HIGHER**
- If LOWER score ≥ minimum confidence → **LOWER**
- If both qualify → higher score wins if edge ≥ minimum edge; else **WAIT** (conflicting evidence)
- If neither qualifies → **WAIT** (no side above threshold)

## Overlay layout

1. **Signal** — large HIGHER / LOWER / WAIT (+ subtitle when waiting)
2. **Dual confidence** — 🟢 HIGHER % and 🔴 LOWER % always visible
3. **Premium Setup** — when active signal side ≥ 90%
4. **Requirements** — ✓/✕ checklist for active/dominant side
5. **Pattern** — shown only when engulfing detected
6. **Advanced** — collapsed by default; raw RSI, Stoch, ADX, dual score breakdown

## Auto-Trade (optional)

Off by default. Enable in extension **Options → Auto-Trade**.

Exnova **ignores synthetic JavaScript clicks** (`event.isTrusted === false`). The extension uses **trusted clicks** by default.

### Click engines

| Engine | Separate app? | Notes |
|--------|---------------|-------|
| **Chrome debugger** (default) | No | Real mouse events via CDP. Chrome shows a short automation banner. |
| **Native helper** | Yes (Python) | OS-level clicks — see [`helper/README.md`](helper/README.md) |
| **Synthetic** | No | Legacy DOM/canvas dispatch — usually does not register on Exnova |

### Setup

1. Open **trade.exnova.com** (keep it open in any tab).
2. **Options → Probe buttons** — should report DOM or canvas targets.
3. Leave **Click engine** on **Chrome debugger**.
4. Enable **Dry run** first — confirmed signals log the target without clicking.
5. **Test HIGHER click** (dry run off) — should place a trade or show debugger error.
6. Disable dry run for live auto-trade only after test succeeds.

The extension finds Exnova **HIGHER/LOWER DOM buttons** on the right panel when possible; otherwise it falls back to **#glcanvas** coordinates (adjust X/Y % in Options).

Guards: warmup required, one click per confirmed signal, respects signal cooldown.

## Development

```bash
npm install
npm run dev
```

Load the extension from `dist/` in `chrome://extensions` (Developer mode → Load unpacked).

## Build

```bash
npm run build
npm test
npm run typecheck
```
