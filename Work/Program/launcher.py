"""
项目完结单管理平台 - 一键启动脚本
此脚本由 start.bat 调用，负责环境检查、依赖安装和服务启动。
"""

import os
import sys
import subprocess
import shutil
import time
import webbrowser

# 项目根目录（start.bat 所在目录）
ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")


def print_banner():
    print("=" * 50)
    print("  项目完结单管理平台 - 一键启动")
    print("=" * 50)
    print()


def check_command(name, version_arg="--version"):
    """检查命令是否可用，返回版本号或 None"""
    try:
        result = subprocess.run(
            [name, version_arg],
            capture_output=True, text=True, timeout=10
        )
        version = result.stdout.strip() or result.stderr.strip()
        return version
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def check_environment():
    """检查 Python 和 Node.js 环境"""
    print("[检查] Python 环境...")
    py_version = sys.version.split()[0]
    print(f"        Python 版本: {py_version}")

    print("[检查] Node.js 环境...")
    node_version = check_command("node", "--version")
    if not node_version:
        print("[错误] 未找到 Node.js，请先安装 Node.js 18+")
        input("按回车键退出...")
        sys.exit(1)
    print(f"        Node.js 版本: {node_version}")
    print()


def install_backend_deps():
    """安装后端依赖"""
    print("[1/4] 检查后端依赖...")
    flag_file = os.path.join(BACKEND_DIR, ".deps_installed")

    if os.path.exists(flag_file):
        print("      后端依赖已安装")
    else:
        print("      首次运行，正在安装后端依赖...")
        req_file = os.path.join(BACKEND_DIR, "requirements.txt")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", req_file, "-q"],
            cwd=BACKEND_DIR
        )
        if result.returncode != 0:
            print("[错误] 后端依赖安装失败")
            input("按回车键退出...")
            sys.exit(1)
        with open(flag_file, "w") as f:
            f.write("ok")

    print("      后端依赖 OK")
    print()


def install_frontend_deps():
    """安装前端依赖"""
    print("[2/4] 检查前端依赖...")
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")

    if os.path.isdir(node_modules):
        print("      前端依赖已安装")
    else:
        print("      首次运行，正在安装前端依赖...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        result = subprocess.run(
            [npm_cmd, "install"],
            cwd=FRONTEND_DIR
        )
        if result.returncode != 0:
            print("[错误] 前端依赖安装失败")
            input("按回车键退出...")
            sys.exit(1)

    print("      前端依赖 OK")
    print()


def start_backend():
    """启动后端服务"""
    print("[3/4] 启动后端服务 (端口 8000)...")

    if os.name == "nt":
        # Windows: 在新窗口中启动
        subprocess.Popen(
            f'chcp 65001 >nul & title 后端 - FastAPI & "{sys.executable}" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000',
            cwd=BACKEND_DIR,
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
    else:
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app",
             "--reload", "--host", "0.0.0.0", "--port", "8000"],
            cwd=BACKEND_DIR
        )

    time.sleep(2)


def start_frontend():
    """启动前端服务"""
    print("[4/4] 启动前端服务 (端口 5173)...")

    npx_cmd = "npx.cmd" if os.name == "nt" else "npx"

    if os.name == "nt":
        subprocess.Popen(
            f'chcp 65001 >nul & title 前端 - Vite & {npx_cmd} vite --host',
            cwd=FRONTEND_DIR,
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
    else:
        subprocess.Popen(
            [npx_cmd, "vite", "--host"],
            cwd=FRONTEND_DIR
        )

    time.sleep(3)


def main():
    print_banner()
    check_environment()
    install_backend_deps()
    install_frontend_deps()
    start_backend()
    start_frontend()

    print()
    print("=" * 50)
    print("  [OK] 启动完成!")
    print("  前端地址: http://localhost:5173")
    print("  后端地址: http://localhost:8000")
    print("  API文档:  http://localhost:8000/docs")
    print("=" * 50)
    print()

    input("按任意键打开浏览器...")
    webbrowser.open("http://localhost:5173")

    print()
    print("提示: 关闭此窗口不会停止服务。")
    input("按任意键退出...")


if __name__ == "__main__":
    main()
