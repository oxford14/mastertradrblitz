@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Usage: run-paste-test.bat AMOUNT
  echo Example: run-paste-test.bat 488
  echo.
  echo Click the Exnova Invest field first, then run this within 3 seconds.
  exit /b 1
)
python --version >nul 2>&1
if errorlevel 1 (
  py -3 --version >nul 2>&1
  if errorlevel 1 (
    echo Python 3 not found. Install from https://python.org
    exit /b 1
  )
  set PY=py -3
) else (
  set PY=python
)
echo Focus Invest field now...
timeout /t 3 /nobreak >nul
%PY% "%~dp0paste_amount.py" %1 --mode paste
exit /b %ERRORLEVEL%
