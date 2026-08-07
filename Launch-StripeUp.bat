@echo off
title StripeUp - Local Dev Launcher
cd /d "C:\StripeUp\officials"

echo ===============================================
echo    StripeUp  -  Local Dev Launcher
echo ===============================================
echo.

REM ---------- Check Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js is NOT installed - it is required for local dev.
  echo     Opening the download page in your browser...
  start "" https://nodejs.org/en/download
  echo.
  echo     Install the "LTS" version, then double-click this icon again.
  echo.
  pause
  exit /b
)
for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v detected

REM ---------- Check / install Netlify CLI ----------
where netlify >nul 2>nul
if errorlevel 1 (
  echo [..] Netlify CLI not found - installing it once now ^(takes a minute^)...
  call npm install -g netlify-cli
  if errorlevel 1 (
    echo [X] Netlify CLI install failed. Try running this icon as Administrator.
    pause
    exit /b
  )
)
echo [OK] Netlify CLI ready

REM ---------- Check Claude Code CLI ----------
set "HAVE_CLAUDE=0"
where claude >nul 2>nul
if errorlevel 1 (
  echo [!] Claude Code CLI not found - the server will still start.
  echo     To add it later, run:  npm install -g @anthropic-ai/claude-code
) else (
  echo [OK] Claude Code detected
  set "HAVE_CLAUDE=1"
)

echo.
echo -----------------------------------------------
echo  Starting the local server...
echo  Your browser will open in a few seconds.
echo  KEEP THIS WINDOW OPEN while you work.
echo  Close it to stop the server.
echo -----------------------------------------------
echo.

REM ---------- Open browser once server is up ----------
start "" cmd /c "timeout /t 8 >nul & start http://localhost:8888"

REM ---------- Open Claude Code in its own window ----------
if "%HAVE_CLAUDE%"=="1" start "Claude Code - StripeUp" cmd /k "cd /d C:\StripeUp\officials && claude"

REM ---------- Run the local dev server (stays running here) ----------
netlify dev

echo.
echo Server stopped.
pause
