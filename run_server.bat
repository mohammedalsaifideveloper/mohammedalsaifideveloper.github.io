@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  echo Site build failed.
  pause
  exit /b 1
)

call npm start
