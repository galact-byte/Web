@echo off
title Project Manager - Quick Start

echo ==================================================
echo   Project Manager - Quick Start
echo ==================================================
echo.

:: Get script directory (project root)
set "ROOT=%~dp0"

:: ---- Check environment ----
echo [Check] Python...
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.9+
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do echo         Python: %%i

echo [Check] Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do echo         Node.js: %%i
echo.

:: ---- Install backend dependencies ----
echo [1/4] Backend dependencies...
if exist "%ROOT%backend\.deps_installed" goto :backend_ok
echo       First run, installing...
pip install -r "%ROOT%backend\requirements.txt" -q
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend dependency installation failed
    pause
    exit /b 1
)
echo ok> "%ROOT%backend\.deps_installed"
goto :backend_done
:backend_ok
echo       Already installed
:backend_done
echo       Backend OK
echo.

:: ---- Install frontend dependencies ----
echo [2/4] Frontend dependencies...
if exist "%ROOT%frontend\node_modules\" goto :frontend_ok
echo       First run, installing...
cd /d "%ROOT%frontend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend dependency installation failed
    pause
    exit /b 1
)
goto :frontend_done
:frontend_ok
echo       Already installed
:frontend_done
echo       Frontend OK
echo.

:: ---- Start backend ----
echo [3/4] Starting backend (port 8000)...
cd /d "%ROOT%backend"
start "Backend - FastAPI" cmd /c "title Backend - FastAPI & python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Wait for backend
timeout /t 2 /nobreak >nul

:: ---- Start frontend ----
echo [4/4] Starting frontend (port 5173)...
cd /d "%ROOT%frontend"
start "Frontend - Vite" cmd /c "title Frontend - Vite & npx vite --host"

:: Wait for frontend
timeout /t 3 /nobreak >nul

echo.
echo ==================================================
echo   [OK] All services started!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo ==================================================
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:5173

echo.
echo Tip: Closing this window will NOT stop the services.
echo Press any key to exit...
pause >nul
