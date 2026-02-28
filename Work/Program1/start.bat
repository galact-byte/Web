@chcp 65001 >nul 2>&1
@echo off
title Program1 Launcher v1.0

echo ==================================================
echo   Program1 Launcher v1.0
echo ==================================================
echo.

if "%STRICT_DEP_LOCK%"=="" set "STRICT_DEP_LOCK=0"
if "%STRICT_PY312%"=="" set "STRICT_PY312=0"

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.12 (recommended)
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PY_VER=%%i"
echo [INFO] Python version: %PY_VER%
for /f "delims=" %%i in ('python -c "import sys; print(sys.executable)"') do set "SYS_PY=%%i"
echo [INFO] Python path: %SYS_PY%
for /f "tokens=1,2 delims=." %%a in ("%PY_VER%") do (
    set "PY_MAJOR=%%a"
    set "PY_MINOR=%%b"
)
if "%PY_MAJOR%.%PY_MINOR%"=="3.12" (
    echo [INFO] Python 3.12 check passed
) else (
    if "%STRICT_PY312%"=="1" (
        echo [ERROR] Unsupported Python version: %PY_VER%
        echo [ERROR] STRICT_PY312=1 requires Python 3.12.x
        pause
        exit /b 1
    )
    echo [WARN] Recommended Python version is 3.12.x, current is %PY_VER%
    echo [WARN] Set STRICT_PY312=1 to enforce strict Python version check.
)
python -m pip --version

echo.
echo [INFO] Checking virtual environment...

set "DEP_FILE=requirements.lock.txt"
if not exist "%DEP_FILE%" (
    if "%STRICT_DEP_LOCK%"=="1" (
        echo [ERROR] Missing requirements.lock.txt
        echo [ERROR] STRICT_DEP_LOCK=1 requires lock file for deterministic installs.
        pause
        exit /b 1
    )
    set "DEP_FILE=requirements.txt"
    echo [WARN] requirements.lock.txt not found, fallback to requirements.txt
)
if not exist "%DEP_FILE%" (
    echo [ERROR] Missing dependency file: %DEP_FILE%
    pause
    exit /b 1
)
echo [INFO] Using dependency file: %DEP_FILE%

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
echo [INFO] Venv interpreter: %CD%\.venv\Scripts\python.exe
python --version
call :ENSURE_VENV_PIP
if errorlevel 1 (
    pause
    exit /b 1
)
python -m pip --version

:: Install dependencies from locked list when available
python -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 --disable-pip-version-check -r %DEP_FILE%
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
echo [INFO] Venv interpreter: %CD%\.venv\Scripts\python.exe
python --version
call :ENSURE_VENV_PIP
if errorlevel 1 (
    pause
    exit /b 1
)
python -m pip --version

python -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 -r %DEP_FILE%
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

goto LAUNCH

:ENSURE_VENV_PIP
python -m pip --version >nul 2>&1
if not errorlevel 1 goto :eof

echo [WARN] pip not found in virtual environment, bootstrapping...
"%SYS_PY%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] System Python pip is unavailable. Please install pip first.
    exit /b 1
)

"%SYS_PY%" -m pip --python "%CD%\.venv\Scripts\python.exe" install -i https://pypi.org/simple --timeout 20 --retries 1 --disable-pip-version-check pip setuptools wheel
if errorlevel 1 (
    echo [ERROR] Failed to bootstrap pip into virtual environment.
    exit /b 1
)

python -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is still unavailable in virtual environment.
    exit /b 1
)
echo [INFO] pip bootstrap completed.
goto :eof


:LAUNCH
if "%DATABASE_URL%"=="" set "DATABASE_URL=sqlite:///./app.db"
if "%API_AUTH_REQUIRED%"=="" set "API_AUTH_REQUIRED=1"
if "%APP_PORT%"=="" set "APP_PORT=8011"
if "%PUBLIC_BASE_URL%"=="" set "PUBLIC_BASE_URL=http://127.0.0.1:%APP_PORT%"

echo.
echo [INFO] Starting service...
echo ==================================================
echo   Access URL: http://127.0.0.1:%APP_PORT%
echo ==================================================
echo.

python -m uvicorn app.main:app --host 0.0.0.0 --port %APP_PORT% --reload
if errorlevel 1 (
    echo.
    echo [ERROR] Program exited abnormally. Please check error messages.
    pause
)
