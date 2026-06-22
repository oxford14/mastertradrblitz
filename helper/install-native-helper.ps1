# Registers the Master Trader Blitz native click helper with Chrome (Windows).
# Run in PowerShell:  .\install-native-helper.ps1
# Or with extension ID:  .\install-native-helper.ps1 -ExtensionId "abcdefghijklmnop"

param(
  [string]$ExtensionId = "fgoiflmeneldlkciaheheinkbicgbpnl"
)

$ErrorActionPreference = "Stop"
$HelperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BatPath = Join-Path $HelperDir "click_host.bat"
$ManifestPath = Join-Path $HelperDir "com.mastertraderblitz.click.json"
$HostName = "com.mastertraderblitz.click"
$RegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

if (-not (Test-Path $BatPath)) {
  Write-Error "Missing $BatPath"
}

# Resolve extension ID
if (-not $ExtensionId) {
  $prefsPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
  if (Test-Path $prefsPath) {
    $prefs = Get-Content $prefsPath -Raw | ConvertFrom-Json
    $settings = $prefs.extensions.settings
    if ($settings) {
      $settings.PSObject.Properties | ForEach-Object {
        $ext = $_.Value
        if ($ext.path -and ($ext.path -like "*MasterTraderBlitz*")) {
          $ExtensionId = $_.Name
        }
      }
    }
  }
}

if (-not $ExtensionId) {
  Write-Host ""
  Write-Host "Could not auto-detect extension ID." -ForegroundColor Yellow
  Write-Host "Open chrome://extensions (Developer mode ON), copy the ID under Master Trader Blitz, then run:"
  Write-Host "  .\install-native-helper.ps1 -ExtensionId YOUR_ID_HERE" -ForegroundColor Cyan
  Write-Host ""
  $ExtensionId = Read-Host "Extension ID (or Enter to exit)"
  if (-not $ExtensionId) { exit 1 }
}

# Check Python + pyautogui
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  Write-Host "Warning: python not found on PATH. Install Python 3 and re-run." -ForegroundColor Yellow
} else {
  & python -c "import pyautogui" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing pyautogui..." -ForegroundColor Cyan
    & python -m pip install pyautogui
  }
}

# Chrome wants forward slashes in the manifest path field
$BatPathForJson = $BatPath -replace '\\', '/'

$manifest = @{
  name = $HostName
  description = "Master Trader Blitz OS-level click helper"
  path = $BatPathForJson
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8

New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath

Write-Host ""
Write-Host "Native helper registered." -ForegroundColor Green
Write-Host "  Manifest: $ManifestPath"
Write-Host "  Registry: $RegPath"
Write-Host "  Extension ID: $ExtensionId"
Write-Host ""
Write-Host "Next: reload extension in chrome://extensions, then Options -> Ping native helper."
Write-Host "Tip: Chrome debugger mode works without Python - try that first if native helper is optional."
