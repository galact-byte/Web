@echo off
chcp 65001 >nul
echo ========================================
echo   Reduce - 构建 Release APK
echo ========================================
echo.

set JAVA_HOME=E:\Java\JDK17

cd /d "%~dp0android"

echo [1/2] 正在清理旧构建...
call gradlew.bat clean

echo.
echo [2/2] 正在构建 Release APK...
call gradlew.bat :app:assembleRelease

if %errorlevel% neq 0 (
    echo.
    echo !! 构建失败，请检查上方错误信息 !!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   构建成功！
echo   APK 路径：
echo   android\app\build\outputs\apk\release\app-release.apk
echo ========================================
echo.

explorer "app\build\outputs\apk\release"
pause
