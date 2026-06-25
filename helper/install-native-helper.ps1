# Registers the Master Trader Blitz VB native click helper with Chrome (Windows).
# Run in PowerShell:  .\install-native-helper.ps1

param(
  [string]$ExtensionId = "fgoiflmeneldlkciaheheinkbicgbpnl"
)

$ErrorActionPreference = "Stop"
$HelperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $HelperDir "vb\MtbClickHelper\bin\Release\MtbClickHelper.exe"
$BatPath = Join-Path $HelperDir "click_host.bat"
$ManifestPath = Join-Path $HelperDir "com.mastertraderblitz.click.json"
$HostName = "com.mastertraderblitz.click"
$RegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

if (-not (Test-Path $ExePath)) {
  Write-Host "MtbClickHelper.exe not found. Building..." -ForegroundColor Cyan
  & (Join-Path $HelperDir "build-helper.ps1")
}

if (-not (Test-Path $ExePath)) {
  Write-Error "Missing $ExePath - run helper\build-helper.ps1 first"
}

if (-not (Test-Path $BatPath)) {
  Write-Error "Missing $BatPath"
}

$BatPathForJson = (Resolve-Path $BatPath).Path -replace '\\', '/'

$manifest = @{
  name = $HostName
  description = "Master Trader Blitz VB click helper"
  path = $BatPathForJson
  type = "stdio"
  allowed_origins = @("chrome-extension://$ExtensionId/")
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $ManifestPath -Encoding UTF8

New-Item -Path $RegPath -Force | Out-Null
Set-ItemProperty -Path $RegPath -Name "(Default)" -Value $ManifestPath

Write-Host ""
Write-Host "Native helper registered." -ForegroundColor Green
Write-Host "  Host launcher: $BatPath"
Write-Host "  Calibrator exe: $ExePath"
Write-Host "  Manifest: $ManifestPath"
Write-Host "  Registry: $RegPath"
Write-Host "  Extension ID: $ExtensionId"
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Reload extension from dist/"
Write-Host "  2. run-calibrator.bat - HIGHER/LOWER/AMOUNT"
Write-Host '  3. Options: Ping native helper, then Test AMOUNT or Test click'
