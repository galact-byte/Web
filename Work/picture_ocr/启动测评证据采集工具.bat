@echo off
setlocal
chcp 65001 >nul
title 测评证据采集工具
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo.
  echo [错误] 未找到 dist\index.html。
  echo 请确认已经解压完整 Release 压缩包，不要只复制这个 bat 文件。
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1"

if errorlevel 1 (
  echo.
  echo [错误] 启动失败，请把本窗口截图发给维护人员。
  echo.
  pause
)
