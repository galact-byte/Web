@echo off
chcp 65001 >nul 2>&1
title Program1 Launcher v1.0

echo ==================================================
echo   Program1 Launcher v1.0
echo ==================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do echo [INFO] Python version: %%i

echo.
echo [INFO] Checking virtual environment...

:: Check if virtual environment exists
if not exist .venv\Scripts\python.exe goto SETUP_VENV

:CHECK_DEPS
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)

echo [INFO] Checking dependencies...

:: Install dependencies silently
python -m pip install -q --disable-pip-version-check -r requirements.txt >nul 2>&1
if errorlevel 1 (
    echo [WARN] Dependency installation may have issues, trying to continue...
) else (
    echo [INFO] Dependencies ready
)

goto LAUNCH


:SETUP_VENV
echo [INFO] Creating virtual environment...

python -m venv .venv
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment
    pause
    exit /b 1
)

echo [INFO] Installing dependencies (first run)...

python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

goto LAUNCH


:LAUNCH
if "%DATABASE_URL%"=="" set "DATABASE_URL=sqlite:///./app.db"

echo.
echo [INFO] Starting service...
echo ==================================================
echo   Access URL: http://127.0.0.1:8000
echo ==================================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
if errorlevel 1 (
    echo.
    echo [ERROR] Program exited abnormally. Please check error messages.
    pause
)
