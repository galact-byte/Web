@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "REPO=router-for-me/CLIProxyAPI"
set "EXE_NAME=cli-proxy-api.exe"
set "VERSION_FILE=%SCRIPT_DIR%\version.txt"
set "PROXY_URL="
set "FORCE=0"
set "TEMP_TAG=%TEMP%\cliproxyapi_tag.txt"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--proxy" (
    set "PROXY_URL=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--force" (
    set "FORCE=1"
    shift
    goto :parse_args
)
echo [ERROR] Unknown argument: %~1
echo Usage: update.bat [--proxy URL] [--force]
pause
exit /b 1
:args_done

set "CURL_PROXY="
if defined PROXY_URL (
    set "CURL_PROXY=--proxy !PROXY_URL!"
    echo [INFO] Using proxy: !PROXY_URL!
)

echo.
echo ============================================
echo   CLIProxyAPI Auto-Update Script
echo ============================================
echo.

set "CURRENT_VERSION="
if exist "%VERSION_FILE%" (
    set /p CURRENT_VERSION=<"%VERSION_FILE%"
)
if not defined CURRENT_VERSION (
    for %%I in ("%SCRIPT_DIR%") do set "DIR_NAME=%%~nxI"
    for /f "tokens=2 delims=_" %%V in ("!DIR_NAME!") do set "CURRENT_VERSION=%%V"
)
if not defined CURRENT_VERSION (
    echo [ERROR] Cannot determine current version.
    echo Please create version.txt with the version number, e.g. 6.7.47
    pause
exit /b 1
)
echo [INFO] Current version: v%CURRENT_VERSION%

echo [INFO] Checking for latest version...
set "RELEASES_URL=https://github.com/%REPO%/releases/latest"
curl -s !CURL_PROXY! -o nul -w "%%{redirect_url}" "%RELEASES_URL%" > "%TEMP_TAG%" 2>nul
set "REDIRECT_URL="
if exist "%TEMP_TAG%" set /p REDIRECT_URL=<"%TEMP_TAG%"
del "%TEMP_TAG%" 2>nul
if not defined REDIRECT_URL (
    echo [ERROR] Failed to query GitHub. Check your network connection.
    if not defined PROXY_URL echo [TIP] Try: update.bat --proxy http://127.0.0.1:7890
    pause
exit /b 1
)

set "LATEST_TAG="
for /f "delims=" %%A in ("!REDIRECT_URL!") do set "_URL=%%A"
for %%T in ("!_URL:/=" "!") do set "LATEST_TAG=%%~T"
if not defined LATEST_TAG (
    echo [ERROR] Failed to parse latest version.
    pause
exit /b 1
)
set "LATEST_VERSION=!LATEST_TAG:~1!"
if not defined LATEST_VERSION (
    echo [ERROR] Failed to parse version from tag: !LATEST_TAG!
    pause
exit /b 1
)
echo [INFO] Latest version: v!LATEST_VERSION!

if "%FORCE%"=="0" (
    if "!CURRENT_VERSION!"=="!LATEST_VERSION!" (
        echo.
        echo [INFO] Already up to date. No update needed.
        echo [TIP] To force update: update.bat --force
        pause
        exit /b 0
    )
)

echo.
echo [INFO] New version available: v%CURRENT_VERSION% --^> v!LATEST_VERSION!

set "ZIP_NAME=CLIProxyAPI_!LATEST_VERSION!_windows_amd64.zip"
set "DOWNLOAD_URL=https://github.com/%REPO%/releases/download/v!LATEST_VERSION!/!ZIP_NAME!"
set "ZIP_PATH=%SCRIPT_DIR%\!ZIP_NAME!"

echo [INFO] Downloading: !ZIP_NAME!
echo [INFO] URL: !DOWNLOAD_URL!
curl -L !CURL_PROXY! --progress-bar -o "!ZIP_PATH!" "!DOWNLOAD_URL!"
if not exist "!ZIP_PATH!" (
    echo [ERROR] Download failed.
    pause
exit /b 1
)
for %%F in ("!ZIP_PATH!") do set "FILE_SIZE=%%~zF"
if !FILE_SIZE! LSS 1048576 (
    echo [ERROR] Downloaded file too small (!FILE_SIZE! bytes^), download may have failed.
    del "!ZIP_PATH!" 2>nul
    pause
exit /b 1
)
echo [INFO] Download complete (!FILE_SIZE! bytes^)

echo [INFO] Stopping %EXE_NAME%...
tasklist /FI "IMAGENAME eq %EXE_NAME%" 2>nul | %SystemRoot%\System32\find.exe /I "%EXE_NAME%" >nul
if !errorlevel! equ 0 (
    taskkill /F /IM %EXE_NAME% >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo [INFO] Process stopped
) else (
    echo [INFO] No running process detected
)

for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "DT=%%T"
set "BACKUP_DIR=%SCRIPT_DIR%\backup_!DT!"
echo [INFO] Backing up to: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" 2>nul
if exist "%SCRIPT_DIR%\%EXE_NAME%" copy /Y "%SCRIPT_DIR%\%EXE_NAME%" "%BACKUP_DIR%\" >nul
if exist "%SCRIPT_DIR%\README.md" copy /Y "%SCRIPT_DIR%\README.md" "%BACKUP_DIR%\" >nul
if exist "%SCRIPT_DIR%\README_CN.md" copy /Y "%SCRIPT_DIR%\README_CN.md" "%BACKUP_DIR%\" >nul
if exist "%SCRIPT_DIR%\LICENSE" copy /Y "%SCRIPT_DIR%\LICENSE" "%BACKUP_DIR%\" >nul
if exist "%SCRIPT_DIR%\config.yaml" copy /Y "%SCRIPT_DIR%\config.yaml" "%BACKUP_DIR%\" >nul
echo [INFO] Backup complete

set "EXTRACT_DIR=%SCRIPT_DIR%\_update_temp"
echo [INFO] Extracting...
if exist "%EXTRACT_DIR%" rmdir /S /Q "%EXTRACT_DIR%" 2>nul
powershell -NoProfile -Command "Expand-Archive -Path '!ZIP_PATH!' -DestinationPath '%EXTRACT_DIR%' -Force"
if !errorlevel! neq 0 (
    echo [ERROR] Extraction failed.
    del "!ZIP_PATH!" 2>nul
    pause
exit /b 1
)

echo [INFO] Updating files...
set "SOURCE_DIR="
for /d %%D in ("%EXTRACT_DIR%\*") do set "SOURCE_DIR=%%D"
if not defined SOURCE_DIR set "SOURCE_DIR=%EXTRACT_DIR%"

for %%F in ("!SOURCE_DIR!\*") do (
    set "FNAME=%%~nxF"
    if /i not "!FNAME!"=="config.yaml" (
        copy /Y "%%F" "%SCRIPT_DIR%\" >nul
        echo   Updated: !FNAME!
    ) else (
        echo   Skipped: config.yaml (user config preserved^)
    )
)

for /d %%D in ("!SOURCE_DIR!\*") do (
    set "DNAME=%%~nxD"
    if /i not "!DNAME!"=="logs" (
        xcopy /E /I /Y "%%D" "%SCRIPT_DIR%\!DNAME!" >nul 2>&1
        echo   Updated dir: !DNAME!
    )
)

echo !LATEST_VERSION!> "%VERSION_FILE%"

echo [INFO] Cleaning up...
del "!ZIP_PATH!" 2>nul
rmdir /S /Q "%EXTRACT_DIR%" 2>nul

echo [INFO] Starting %EXE_NAME%...
start "" /D "%SCRIPT_DIR%" "%SCRIPT_DIR%\%EXE_NAME%"
timeout /t 2 /nobreak >nul
tasklist /FI "IMAGENAME eq %EXE_NAME%" 2>nul | %SystemRoot%\System32\find.exe /I "%EXE_NAME%" >nul
if !errorlevel! equ 0 (
    echo [INFO] %EXE_NAME% started successfully
) else (
    echo [WARN] %EXE_NAME% may not have started, please check logs
)

echo.
echo ============================================
echo   Update complete! v%CURRENT_VERSION% --^> v!LATEST_VERSION!
echo   Backup location: %BACKUP_DIR%
echo ============================================
echo.

endlocal
pause
exit /b 0
