@echo off
chcp 65001 >nul
title 项目完结单管理平台 - 一键启动

echo ============================================
echo   项目完结单管理平台 - 一键启动
echo ============================================
echo.

:: 获取脚本所在目录（项目根目录）
set "ROOT=%~dp0"

:: ---- 检查环境 ----
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

:: ---- 安装后端依赖 ----
echo [1/4] 检查后端依赖...
if not exist "%ROOT%backend\.deps_installed" (
    echo       正在安装后端依赖...
    pip install -r "%ROOT%backend\requirements.txt"
    if %ERRORLEVEL% neq 0 (
        echo [错误] 后端依赖安装失败
        pause
        exit /b 1
    )
    echo. > "%ROOT%backend\.deps_installed"
)
echo       后端依赖 OK

:: ---- 安装前端依赖（首次运行时） ----
echo [2/4] 检查前端依赖...
if not exist "%ROOT%frontend\node_modules\" (
    echo       正在安装前端依赖...
    cd /d "%ROOT%frontend"
    npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 前端依赖安装失败
        pause
        exit /b 1
    )
)
echo       前端依赖 OK

:: ---- 启动后端 ----
echo [3/4] 启动后端服务 (端口 8000)...
cd /d "%ROOT%backend"
start "后端 - FastAPI" cmd /c "title 后端 - FastAPI && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: 等一下让后端先启动
timeout /t 2 /nobreak >nul

:: ---- 启动前端 ----
echo [4/4] 启动前端服务 (端口 5173)...
cd /d "%ROOT%frontend"
start "前端 - Vite" cmd /c "title 前端 - Vite && npx vite --host"

:: 等前端启动
timeout /t 3 /nobreak >nul

echo.
echo.============================================
echo.  [OK] Started!
echo.  Frontend - http://localhost:5173
echo.  Backend  - http://localhost:8000
echo.  API Docs - http://localhost:8000/docs
echo.============================================
echo.
echo.Press any key to open browser...
pause >nul

start http://localhost:5173

echo.
echo.If the browser did not open, visit http://localhost:5173
echo.Closing this window will NOT stop the services.
pause >nul
