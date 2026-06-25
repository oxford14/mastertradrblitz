@echo off
setlocal
cd /d "%~dp0"
set EXE=vb\MtbClickHelper\bin\Release\MtbClickHelper.exe
if not exist "%EXE%" (
  echo Building helper...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-helper.ps1"
)
start "" "%~dp0%EXE%" --keypad
