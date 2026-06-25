# Build MtbClickHelper.exe (Release)
$ErrorActionPreference = "Stop"
$Project = Join-Path $PSScriptRoot "vb\MtbClickHelper\MtbClickHelper.vbproj"

$msbuild = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" `
  -latest -requires Microsoft.Component.MSBuild `
  -find "MSBuild\**\Bin\MSBuild.exe" 2>$null | Select-Object -First 1

if (-not $msbuild) {
  Write-Error "MSBuild not found. Install Visual Studio 2022 with .NET desktop development."
}

& $msbuild $Project /p:Configuration=Release /v:minimal
if ($LASTEXITCODE -ne 0) {
  Write-Error "MSBuild failed with exit code $LASTEXITCODE"
}
Write-Host "Built: $(Join-Path $PSScriptRoot 'vb\MtbClickHelper\bin\Release\MtbClickHelper.exe')" -ForegroundColor Green
