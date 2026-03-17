"""CodeAudit WebUI 启动器 —— 环境检查、依赖安装、启动服务。"""

import subprocess
import sys
import threading
import webbrowser


def run(cmd: str, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, shell=True, capture_output=capture, text=True)


def check_python():
    ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print(f"[OK] Python 版本: {ver}")
    if sys.version_info < (3, 8):
        print("[X] 需要 Python 3.8+，请升级后重试")
        sys.exit(1)


def check_dependencies():
    print()
    print("检查依赖包...")
    packages = {
        "flask": "flask flask-sqlalchemy",
        "pymysql": "pymysql cryptography",
        "markdown": "markdown",
        "requests": "requests",
        "bleach": "bleach",
        "docx": "python-docx",
        "openpyxl": "openpyxl",
    }
    for import_name, install_name in packages.items():
        try:
            __import__(import_name)
            print(f"  [OK] {import_name}")
        except ImportError:
            print(f"  [..] {import_name} 未安装，正在安装...")
            run(f"{sys.executable} -m pip install {install_name} -q")
            try:
                __import__(import_name)
                print(f"  [OK] {import_name} 安装成功")
            except ImportError:
                print(f"  [X] {import_name} 安装失败，请手动执行: pip install {install_name}")
                sys.exit(1)


def check_mysql():
    print()
    print("检查 MySQL 连接...")
    try:
        from config import Config
        import pymysql
        if not Config.DB_PASSWORD:
            print("  [!] 未配置数据库密码，请在 .env 文件中设置 DB_PASSWORD")
            print("  参考 .env.example 文件")
            input("按回车键仍然尝试启动，按 Ctrl+C 退出...")
            return
        pymysql.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
        )
        print("  [OK] MySQL 连接正常")
    except Exception as e:
        print(f"  [!] MySQL 连接失败: {e}")
        print("  请确认:")
        print("    1. MySQL 服务已启动")
        print("    2. .env 文件中的数据库配置正确")
        print()
        input("按回车键仍然尝试启动，按 Ctrl+C 退出...")


def start_app():
    print()
    print("正在启动 CodeAudit WebUI...")
    print("访问地址: http://localhost:5000")
    print("=" * 50)
    print()
    # 延迟 1.5 秒后自动打开浏览器
    threading.Timer(1.5, lambda: webbrowser.open("http://localhost:5000")).start()
    try:
        run(f"{sys.executable} app.py")
    except KeyboardInterrupt:
        print("\n已停止")


def main():
    print("=" * 50)
    print("  CodeAudit WebUI v1.0")
    print("=" * 50)
    print()

    check_python()
    check_dependencies()
    check_mysql()
    start_app()


if __name__ == "__main__":
    main()
