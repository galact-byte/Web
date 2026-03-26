@chcp 65001 >nul 2>&1
@echo off
title Program1 Launcher v1.2
setlocal
for /f %%e in ('echo prompt $E^| cmd') do set "ESC=%%e"
set "INFO=%ESC%[96m[INFO]%ESC%[0m"
set "OK=%ESC%[92m[ OK ]%ESC%[0m"
set "WARN=%ESC%[93m[WARN]%ESC%[0m"
set "ERR=%ESC%[91m[ERROR]%ESC%[0m"
set "HEAD=%ESC%[95m"
set "RESET=%ESC%[0m"

cd /d "%~dp0"

echo %HEAD%==================================================%RESET%
echo %HEAD%  Program1 Launcher v1.2%RESET%
echo %HEAD%==================================================%RESET%
echo.

if "%STRICT_DEP_LOCK%"=="" set "STRICT_DEP_LOCK=0"
if "%STRICT_PY312%"=="" set "STRICT_PY312=0"
if "%PREFER_REQUIREMENTS_TXT%"=="" set "PREFER_REQUIREMENTS_TXT=0"
if "%AUTO_OPEN_BROWSER%"=="" set "AUTO_OPEN_BROWSER=1"
if "%BROWSER_WAIT_SECONDS%"=="" set "BROWSER_WAIT_SECONDS=30"
set "VENV_PY=%CD%\.venv\Scripts\python.exe"

if "%STRICT_DEP_LOCK%"=="1" if "%PREFER_REQUIREMENTS_TXT%"=="1" (
    echo %ERR% STRICT_DEP_LOCK=1 cannot be used with PREFER_REQUIREMENTS_TXT=1
    pause
    exit /b 1
)

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo %ERR% Python not found. Please install Python 3.12 recommended.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set "PY_VER=%%i"
echo %INFO% Python version: %PY_VER%
for /f "delims=" %%i in ('python -c "import sys; print(sys.executable)"') do set "SYS_PY=%%i"
echo %INFO% Python path: %SYS_PY%
for /f "delims=" %%i in ('python -m pip --version 2^>^&1') do set "SYS_PIP_VER=%%i"
echo %INFO% System pip: %SYS_PIP_VER%
for /f "delims=" %%i in ('python -c "import sys; print(sys.maxsize.bit_length()+1)"') do set "PY_BITS=%%i"
echo %INFO% Python architecture: %PY_BITS%-bit
if not "%PY_BITS%"=="64" (
    echo %ERR% Unsupported Python architecture: %PY_BITS%-bit
    echo %ERR% Please install 64-bit Python 3.12.x
    pause
    exit /b 1
)
for /f "tokens=1,2 delims=." %%a in ("%PY_VER%") do (
    set "PY_MAJOR=%%a"
    set "PY_MINOR=%%b"
)
if "%PY_MAJOR%.%PY_MINOR%"=="3.12" (
    echo %OK% Python 3.12 check passed
) else (
    if "%STRICT_PY312%"=="1" (
        echo %ERR% Unsupported Python version: %PY_VER%
        echo %ERR% STRICT_PY312=1 requires Python 3.12.x
        pause
        exit /b 1
    )
    echo %WARN% Recommended Python version is 3.12.x, current is %PY_VER%
    echo %WARN% Set STRICT_PY312=1 to enforce strict Python version check.
)

echo.
echo %INFO% Checking virtual environment...

if "%PREFER_REQUIREMENTS_TXT%"=="1" (
    set "DEP_FILE=requirements.txt"
    echo %WARN% PREFER_REQUIREMENTS_TXT=1, skip lock file and use requirements.txt
) else (
    set "DEP_FILE=requirements.lock.txt"
)
if not exist "%DEP_FILE%" (
    if "%STRICT_DEP_LOCK%"=="1" (
        echo %ERR% Missing requirements.lock.txt
        echo %ERR% STRICT_DEP_LOCK=1 requires lock file for deterministic installs.
        pause
        exit /b 1
    )
    set "DEP_FILE=requirements.txt"
    echo %WARN% requirements.lock.txt not found, fallback to requirements.txt
)
if not exist "%DEP_FILE%" (
    echo %ERR% Missing dependency file: %DEP_FILE%
    pause
    exit /b 1
)
echo %INFO% Using dependency file: %DEP_FILE%

:: Check if virtual environment exists and is valid
if not exist "%VENV_PY%" goto SETUP_VENV

:: Validate that venv python actually works (detect broken venv from different machine)
"%VENV_PY%" --version >nul 2>&1
if errorlevel 1 (
    echo %WARN% Virtual environment exists but interpreter is broken.
    echo %WARN% This usually happens when .venv was copied from another machine.
    echo %INFO% Rebuilding virtual environment...
    rmdir /s /q .venv 2>nul
    goto SETUP_VENV
)

:CHECK_DEPS
if not exist "%VENV_PY%" (
    echo %ERR% Virtual environment interpreter missing: %VENV_PY%
    pause
    exit /b 1
)

echo %INFO% Checking dependencies...
echo %INFO% Venv interpreter: %VENV_PY%
"%VENV_PY%" --version
call :ENSURE_VENV_PIP
if errorlevel 1 (
    pause
    exit /b 1
)
for /f "delims=" %%i in ('"%VENV_PY%" -m pip --version 2^>^&1') do set "VENV_PIP_VER=%%i"
echo %INFO% Venv pip: %VENV_PIP_VER%

call :INSTALL_DEPS
if errorlevel 1 (
    echo %WARN% Dependency installation failed. Checking existing environment...
    "%VENV_PY%" -c "import fastapi, pydantic" >nul 2>&1
    if errorlevel 1 (
        echo %ERR% Required dependencies are not available.
        pause
        exit /b 1
    )
    echo %WARN% Using existing installed dependencies.
)

goto LAUNCH


:SETUP_VENV
echo %INFO% Creating virtual environment...

python -m venv .venv
if errorlevel 1 (
    echo %WARN% "python -m venv" failed, trying with --without-pip...
    python -m venv --without-pip .venv
    if errorlevel 1 (
        echo %ERR% Failed to create virtual environment
        pause
        exit /b 1
    )
)
set "VENV_PY=%CD%\.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo %ERR% Failed to locate virtual environment interpreter: %VENV_PY%
    pause
    exit /b 1
)

echo %INFO% Installing dependencies (first run)...
echo %INFO% Venv interpreter: %VENV_PY%
"%VENV_PY%" --version
call :ENSURE_VENV_PIP
if errorlevel 1 (
    pause
    exit /b 1
)
for /f "delims=" %%i in ('"%VENV_PY%" -m pip --version 2^>^&1') do set "VENV_PIP_VER=%%i"
echo %INFO% Venv pip: %VENV_PIP_VER%

call :INSTALL_DEPS
if errorlevel 1 (
    echo %ERR% Failed to install dependencies
    pause
    exit /b 1
)

goto LAUNCH

:ENSURE_VENV_PIP
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 goto :eof

echo %WARN% pip not found in virtual environment, bootstrapping...

:: Method 1: ensurepip
echo %INFO% Trying ensurepip...
"%VENV_PY%" -m ensurepip --upgrade >nul 2>&1
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 (
    echo %OK% pip bootstrap completed via ensurepip.
    goto :eof
)

:: Method 2: get-pip.py
echo %WARN% ensurepip failed, trying get-pip.py...
set "GET_PIP=%TEMP%\get-pip.py"

:: Try curl first, then certutil, then python urllib
curl -sS -o "%GET_PIP%" https://bootstrap.pypa.io/get-pip.py >nul 2>&1
if errorlevel 1 (
    certutil -urlcache -split -f "https://bootstrap.pypa.io/get-pip.py" "%GET_PIP%" >nul 2>&1
)
if errorlevel 1 (
    "%VENV_PY%" -c "import urllib.request; urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', r'%GET_PIP%')" >nul 2>&1
)

if exist "%GET_PIP%" (
    "%VENV_PY%" "%GET_PIP%" >nul 2>&1
    del /f "%GET_PIP%" 2>nul
    "%VENV_PY%" -m pip --version >nul 2>&1
    if not errorlevel 1 (
        echo %OK% pip bootstrap completed via get-pip.py.
        goto :eof
    )
)

:: Method 3: System pip to install into venv
echo %WARN% get-pip.py failed, trying system pip...
python "%~dp0launch_runtime.py" python -m pip install --target "%CD%\.venv\Lib\site-packages" pip
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 (
    echo %OK% pip bootstrap completed via system pip.
    goto :eof
)

echo %ERR% Failed to bootstrap pip into virtual environment.
echo %ERR% All methods exhausted: ensurepip, get-pip.py, system pip.
echo %ERR% Please ensure your Python installation is complete and has network access.
exit /b 1

:INSTALL_DEPS
echo %INFO% Installing dependencies from %DEP_FILE%...
"%VENV_PY%" "%~dp0launch_runtime.py" "%VENV_PY%" -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 --disable-pip-version-check --quiet -r "%DEP_FILE%"
if not errorlevel 1 (
    echo %OK% Dependencies ready
    exit /b 0
)

if /I not "%DEP_FILE%"=="requirements.lock.txt" exit /b 1
if "%STRICT_DEP_LOCK%"=="1" (
    echo %ERR% Locked dependency install failed and STRICT_DEP_LOCK=1 forbids fallback.
    exit /b 1
)
if not exist "requirements.txt" exit /b 1

echo %WARN% Locked dependency install failed, fallback to requirements.txt
"%VENV_PY%" "%~dp0launch_runtime.py" "%VENV_PY%" -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 --disable-pip-version-check --quiet -r requirements.txt
if errorlevel 1 exit /b 1
echo %OK% Dependencies ready (fallback requirements.txt)
exit /b 0


:LAUNCH
if "%LAUNCH_ENTERED%"=="1" goto :eof
set "LAUNCH_ENTERED=1"
if "%DATABASE_URL%"=="" set "DATABASE_URL=sqlite:///./app.db"
set "APP_LITE_MODE=0"
set "API_AUTH_REQUIRED=1"
if "%APP_PORT%"=="" set "APP_PORT=8011"
set "PUBLIC_BASE_URL=http://127.0.0.1:%APP_PORT%"

echo.
echo %INFO% Starting service...
echo %INFO% Launch mode: full
echo %INFO% APP_LITE_MODE=%APP_LITE_MODE%
echo %INFO% API_AUTH_REQUIRED=%API_AUTH_REQUIRED%
echo %HEAD%==================================================%RESET%
echo %HEAD%  Access URL: http://127.0.0.1:%APP_PORT%%RESET%
echo %HEAD%==================================================%RESET%
echo.
if "%DRY_RUN%"=="1" (
    echo %INFO% DRY_RUN=1, skip launching uvicorn.
    exit /b 0
)

if "%AUTO_OPEN_BROWSER%"=="1" (
    echo %INFO% Browser will open when service is ready: http://127.0.0.1:%APP_PORT%
    start "" /b "%VENV_PY%" "%~dp0launcher.py" "%APP_PORT%" "%BROWSER_WAIT_SECONDS%" >nul 2>&1
)

"%VENV_PY%" "%~dp0launch_runtime.py" "%VENV_PY%" -m uvicorn app.main:app --host 0.0.0.0 --port %APP_PORT% --reload
if errorlevel 1 (
    echo.
    echo %ERR% Program exited abnormally. Please check error messages.
    pause
)
