@echo off
chcp 65001 >nul
echo ========================================
echo   Reduce v1.2.0 - 构建 Release APK
echo ========================================
echo.

set "JAVA_HOME=E:\Java\JDK17"
set "BUILD_TYPE=release"

cd /d "%~dp0android"
if %errorlevel% neq 0 (
    echo !! 找不到 android 目录 !!
    goto :end
)

echo [1/3] 正在清理旧构建...
cmd /c gradlew.bat clean
if %errorlevel% neq 0 (
    echo.
    echo !! 清理失败 !!
    goto :end
)

echo.
echo [2/3] 正在构建 Release APK...
cmd /c gradlew.bat :app:assemble%BUILD_TYPE%
if %errorlevel% neq 0 (
    echo.
    echo !! 构建失败，请检查上方错误信息 !!
    goto :end
)

echo.
echo [3/3] 正在打开输出目录...
set "APK_DIR=app\build\outputs\apk\%BUILD_TYPE%"
if exist "%APK_DIR%\app-%BUILD_TYPE%.apk" (
    echo ========================================
    echo   构建成功!
    echo ========================================
    explorer "%APK_DIR%"
) else (
    echo !! APK 文件未找到，请检查签名配置 !!
)

:end
echo.
pause
