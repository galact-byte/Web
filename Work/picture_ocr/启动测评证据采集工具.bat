@echo off
setlocal
chcp 65001 >nul 2>&1
title Picture OCR
cd /d "%~dp0"

if not exist "dist\index.html" (
  set "SERVER_EXIT_CODE=1"
  echo [ERROR] dist\index.html was not found. Extract the complete release package.
  goto failed
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"
set "SERVER_EXIT_CODE=%ERRORLEVEL%"
if "%SERVER_EXIT_CODE%"=="0" exit /b 0

:failed
echo.
echo [ERROR] Web service stopped or failed. Exit code: %SERVER_EXIT_CODE%
echo [INFO] Read the PowerShell error shown above before closing this window.
echo.
pause
exit /b %SERVER_EXIT_CODE%
