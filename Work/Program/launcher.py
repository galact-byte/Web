"""
项目完结单管理平台 - 一键启动脚本
此脚本由 start.bat 调用，负责环境检查、依赖安装和服务启动。
关闭此窗口将自动停止所有服务。
"""

import os
import sys
import subprocess
import time
import webbrowser
import atexit

# 项目根目录（start.bat 所在目录）
ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

# 全局子进程列表，用于统一管理
_child_processes: list[subprocess.Popen] = []


def cleanup():
    """终止所有子进程"""
    for proc in _child_processes:
        try:
            proc.terminate()
        except OSError:
            pass
    # 给进程一点时间优雅退出
    time.sleep(1)
    for proc in _child_processes:
        try:
            proc.kill()
        except OSError:
            pass


# 注册退出时自动清理
atexit.register(cleanup)


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
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")

    # 如依赖文件比标记文件更新，则需要重新安装
    need_install = not os.path.exists(flag_file)
    if not need_install and os.path.exists(req_file):
        if os.path.getmtime(req_file) > os.path.getmtime(flag_file):
            need_install = True
            print("      检测到依赖变更，正在更新...")

    if need_install:
        print("      正在安装后端依赖...")
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
    else:
        print("      后端依赖已安装")

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
    """启动后端服务（当前进程的子进程，关窗口自动停止）"""
    print("[3/4] 启动后端服务 (端口 8000)...")

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR
    )
    _child_processes.append(proc)
    time.sleep(2)


def start_frontend():
    """启动前端服务（当前进程的子进程，关窗口自动停止）"""
    print("[4/4] 启动前端服务 (端口 5173)...")

    npx_cmd = "npx.cmd" if os.name == "nt" else "npx"

    proc = subprocess.Popen(
        [npx_cmd, "vite", "--host"],
        cwd=FRONTEND_DIR
    )
    _child_processes.append(proc)
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

    webbrowser.open("http://localhost:5173")

    print()
    print("提示: 关闭此窗口将自动停止所有服务。")
    print("      按 Ctrl+C 或直接关闭窗口即可停止。")
    print()

    try:
        # 持续等待子进程，任一退出则全部停止
        while True:
            for proc in _child_processes:
                if proc.poll() is not None:
                    print(f"\n[警告] 子进程 (PID {proc.pid}) 已退出，正在停止所有服务...")
                    cleanup()
                    return
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[INFO] 正在停止所有服务...")
        cleanup()
        print("[INFO] 已停止。")


if __name__ == "__main__":
    main()
