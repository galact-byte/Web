@echo off
chcp 65001 >nul

echo ====================================
echo   AI客户端后端打包脚本
echo ====================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

REM 检查main.py是否存在
if not exist "main.py" (
    echo [错误] 找不到 main.py 文件
    echo 请在包含 main.py 的目录下运行此脚本
    pause
    exit /b 1
)

echo [1/4] 检查并安装依赖包...

set PACKAGES=fastapi uvicorn requests pyinstaller

for %%p in (%PACKAGES%) do (
    echo 正在检查 %%p ...
    pip show %%p >nul 2>&1
    if %errorlevel% neq 0 (
        echo 未找到 %%p，正在安装...
        pip install %%p -i https://pypi.tuna.tsinghua.edu.cn/simple
        if %errorlevel% neq 0 (
            echo [错误] 安装 %%p 失败！
            pause
            exit /b 1
        )
    ) else (
        echo 已安装：%%p
    )
)


echo.
echo [2/4] 清理旧文件...
if exist "dist" rmdir /s /q dist
if exist "build" rmdir /s /q build
if exist "*.spec" del /q *.spec
if exist "..\src-tauri\binaries\api-server" rmdir /s /q ..\src-tauri\binaries\api-server

echo.
echo [3/4] 打包后端程序...
pyinstaller ^
    --onefile ^
    --noconsole ^
    --name api-server ^
    --distpath ..\ai-client\src-tauri\binaries\api-server ^
    --workpath build ^
    --specpath . ^
    --hidden-import=uvicorn.logging ^
    --hidden-import=uvicorn.loops ^
    --hidden-import=uvicorn.loops.auto ^
    --hidden-import=uvicorn.protocols ^
    --hidden-import=uvicorn.protocols.http ^
    --hidden-import=uvicorn.protocols.http.auto ^
    --hidden-import=uvicorn.protocols.websockets ^
    --hidden-import=uvicorn.protocols.websockets.auto ^
    --hidden-import=uvicorn.lifespan ^
    --hidden-import=uvicorn.lifespan.on ^
    main.py

if %errorlevel% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo [4/4] 验证打包结果...
if exist "..\ai-client\src-tauri\binaries\api-server\api-server.exe" (
    echo ✅ 打包成功！
    echo.
    echo 输出位置: ..\ai-client\src-tauri\binaries\api-server\api-server.exe
    
    REM 获取文件大小
    for %%F in ("..\ai-client\src-tauri\binaries\api-server\api-server.exe") do (
        echo 文件大小: %%~zF 字节 ^(约 %%~zF /1024/1024 MB^)
    )
) else (
    echo ❌ 打包失败：找不到输出文件
    pause
    exit /b 1
)

echo.
echo ====================================
echo   后端打包完成！
echo ====================================
echo.
echo 下一步：
echo 1. 运行 "npm run tauri build" 构建完整应用
echo 2. 安装包位于: src-tauri\target\release\bundle\
echo.

pause