@echo off
chcp 65001 >nul 2>&1
title CodeAudit WebUI v1.0
python "%~dp0launch.py"
if errorlevel 1 pause
