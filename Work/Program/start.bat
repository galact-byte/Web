@chcp 65001 >nul 2>&1
@echo off
title 项目完结单管理平台 - 一键启动

echo ==================================================
echo   项目完结单管理平台 - 一键启动
echo ==================================================
echo.

:: 获取脚本所在目录（项目根目录）
set "ROOT=%~dp0"

:: ---- 检查环境 ----
echo [检查] Python 环境...
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do echo         Python 版本: %%i

echo [检查] Node.js 环境...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)
for /f "tokens=1" %%i in ('node --version 2^>^&1') do echo         Node.js 版本: %%i
echo.

:: ---- 安装后端依赖 ----
echo [1/4] 检查后端依赖...
if exist "%ROOT%backend\.deps_installed" goto :backend_ok
echo       首次运行，正在安装后端依赖...
pip install -r "%ROOT%backend\requirements.txt" -q
if %ERRORLEVEL% neq 0 (
    echo [错误] 后端依赖安装失败
    pause
    exit /b 1
)
echo ok> "%ROOT%backend\.deps_installed"
goto :backend_done
:backend_ok
echo       后端依赖已安装
:backend_done
echo       后端依赖 OK
echo.

:: ---- 安装前端依赖（首次运行时） ----
echo [2/4] 检查前端依赖...
if exist "%ROOT%frontend\node_modules\" goto :frontend_ok
echo       首次运行，正在安装前端依赖...
cd /d "%ROOT%frontend"
call npm install
if %ERRORLEVEL% neq 0 (
    echo [错误] 前端依赖安装失败
    pause
    exit /b 1
)
goto :frontend_done
:frontend_ok
echo       前端依赖已安装
:frontend_done
echo       前端依赖 OK
echo.

:: ---- 启动后端 ----
echo [3/4] 启动后端服务 (端口 8000)...
cd /d "%ROOT%backend"
start "后端 - FastAPI" cmd /c "chcp 65001 >nul & title 后端 - FastAPI & python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: 等一下让后端先启动
timeout /t 2 /nobreak >nul

:: ---- 启动前端 ----
echo [4/4] 启动前端服务 (端口 5173)...
cd /d "%ROOT%frontend"
start "前端 - Vite" cmd /c "chcp 65001 >nul & title 前端 - Vite & npx vite --host"

:: 等前端启动
timeout /t 3 /nobreak >nul

echo.
echo ==================================================
echo   [OK] 启动完成!
echo   前端地址: http://localhost:5173
echo   后端地址: http://localhost:8000
echo   API文档:  http://localhost:8000/docs
echo ==================================================
echo.
echo 按任意键打开浏览器...
pause >nul
start http://localhost:5173
call :exit_msg
goto :eof

:exit_msg
chcp 65001 >nul
echo.
echo 提示: 关闭此窗口不会停止服务。
echo 按任意键退出...
pause >nul
goto :eof
