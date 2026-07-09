@echo off
setlocal
chcp 65001 >nul
title Picture OCR
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo.
  echo [ERROR] dist\index.html was not found.
  echo Please extract the full Release ZIP first. Do not copy only this bat file.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"

if errorlevel 1 (
  echo.
  echo [ERROR] Failed to start. Please send a screenshot of this window to the maintainer.
  echo.
  pause
)
