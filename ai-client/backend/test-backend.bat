@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo 测试后端 API Server
echo ========================================
echo.

echo [1] 启动后端...
start "Backend" cmd /k "%~dp0dist\api-server.exe"

echo [2] 等待 5 秒让后端启动...
timeout /t 5 /nobreak >nul

echo [3] 测试健康检查...
curl http://127.0.0.1:8000/health
echo.

echo [4] 测试聊天接口...

REM ==== 用临时文件保存 JSON 数据 ====
set "jsonfile=%temp%\chat_test.json"
echo {"prompt":"你好","api_url":"https://ghjlr-text-op.hf.space/v1/chat/completions","api_key":"sk-xohn2sF09ZTGj3c9OxT0N7GqFqYEAf4Lo4fpIqDKpK3jCaFY","model":"gemini-2.5-flash"} > "%jsonfile%"

curl -X POST http://127.0.0.1:8000/chat ^
  -H "Content-Type: application/json" ^
  -d "@%jsonfile%"
echo.

del "%jsonfile%" >nul 2>&1

echo.
echo ========================================
echo 测试完成！按任意键关闭后端...
echo ========================================
pause >nul

tasklist | find /i "api-server.exe" >nul
if not errorlevel 1 taskkill /F /IM api-server.exe >nul
