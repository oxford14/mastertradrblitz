# Master Trader Blitz — VB Click Helper

Windows native helper with a **draggable calibrator** for Exnova HIGHER/LOWER buttons and the Invest (AMOUNT) field. Replaces the legacy Python helper.

## Build

Requires Visual Studio 2022 (or Build Tools) with .NET Framework 4.8.

```powershell
cd helper
.\build-helper.ps1
```

Output: `helper/vb/MtbClickHelper/bin/Release/MtbClickHelper.exe`

## Install (once)

```powershell
cd helper
.\install-native-helper.ps1
```

Registers Chrome native messaging to `MtbClickHelper.exe`.

Then reload the extension from `dist/` in `chrome://extensions`.

### Calibrator

Double-click **`run-calibrator.bat`** — drag **HIGHER**, **LOWER**, and **AMOUNT** onto Exnova, then **Save**.

Progression **setAmount** double-clicks AMOUNT, then runs **Python paste** (`paste_amount.py` via Ctrl+V). VK typing is the fallback.

### Python paste (one-time)

```powershell
# From project root:
pip install -r helper/requirements.txt

# Or if you are already in helper/:
pip install -r requirements.txt
```

Manual test (click Invest first): `helper\run-paste-test.bat 488`

Chrome uses **`click_host.bat`** (`--host` mode) — do not run that manually; it has no UI.

## Modes

| Launch | Purpose |
|--------|---------|
| `MtbClickHelper.exe` (default) | HIGHER / LOWER / AMOUNT calibration |
| `MtbClickHelper.exe --keypad` | Digit keypad calibration (0–9 + CLR) via `run-keypad-calibrator.bat` |
| `MtbClickHelper.exe --host` | Chrome native host (via click_host.bat) |

**Keypad mode:** run `run-keypad-calibrator.bat`, then set Options → Amount entry mode → Keypad clicks.

## Legacy Python helper

[`click_host.py`](click_host.py) is deprecated. Use the VB helper instead.

## Security

The helper moves your real mouse cursor at saved screen coordinates. Only install if you trust this extension.
