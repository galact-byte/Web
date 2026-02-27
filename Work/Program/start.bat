@chcp 65001 >nul 2>&1 & python "%~dp0launcher.py" || (echo. & echo [错误] 启动失败，请确保已安装 Python 3.9+ & pause)
