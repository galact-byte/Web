@echo off
chcp 65001 >nul 2>&1
title Project Completion Launcher
python "%~dp0launcher.py"
if errorlevel 1 pause
