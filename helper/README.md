# Master Trader Blitz — Native Click Helper

Use this **only if Chrome debugger clicks are blocked**. Prefer **Chrome debugger** in Options — no Python required.

## Quick install (Windows)

From PowerShell in this folder:

```powershell
pip install pyautogui
.\install-native-helper.ps1
```

The script registers Chrome’s native messaging host and uses the extension’s fixed ID (`fgoiflmeneldlkciaheheinkbicgbpnl` after you reload the extension from a fresh build).

Then:

1. **Rebuild and reload** the extension in `chrome://extensions` (Remove → Load unpacked → `dist/`).
2. Options → Auto-Trade → **Native helper**
3. Click **Ping native helper** — should say `pong`.

## Manual install

1. Install Python 3 and `pip install pyautogui`
2. Edit `com.mastertraderblitz.click.json`:
   - `path` → absolute path to `click_host.bat` (forward slashes OK)
   - `allowed_origins` → `chrome-extension://fgoiflmeneldlkciaheheinkbicgbpnl/`
3. Register:

```powershell
$hostJson = "D:/Cursor Projects/MasterTraderBlitz/helper/com.mastertraderblitz.click.json"
New-Item -Path "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.mastertraderblitz.click" -Force |
  Set-ItemProperty -Name "(Default)" -Value $hostJson
```

## Security

The helper moves your real mouse cursor. Only install if you trust this extension.
