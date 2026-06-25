@echo off
REM Double-click this to open the draggable HIGHER/LOWER calibrator.
set EXE=%~dp0vb\MtbClickHelper\bin\Release\MtbClickHelper.exe
if not exist "%EXE%" (
  echo MtbClickHelper.exe not found. Build it first:
  echo   helper\build-helper.ps1
  pause
  exit /b 1
)
start "" "%EXE%"
