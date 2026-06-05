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
import json

# 项目根目录（start.bat 所在目录）
ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")
BACKEND_VENV_DIR = os.path.join(BACKEND_DIR, ".venv")
SUPPORTED_PYTHON_MIN = (3, 10)
SUPPORTED_PYTHON_MAX = (3, 12)
SUPPORTED_NODE_MIN = (20, 19)
SUPPORTED_NODE_ALT_MIN = (22, 12)
BACKEND_PYTHON = sys.executable

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


def pause_and_exit(code=1):
    """在交互窗口中暂停；非交互环境直接退出，避免 EOFError traceback。"""
    try:
        input("按回车键退出...")
    except EOFError:
        pass
    sys.exit(code)


def _venv_python_path():
    if os.name == "nt":
        return os.path.join(BACKEND_VENV_DIR, "Scripts", "python.exe")
    return os.path.join(BACKEND_VENV_DIR, "bin", "python")


def _python_version(command):
    try:
        result = subprocess.run(
            command + ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _is_supported_python(command):
    try:
        result = subprocess.run(
            command + [
                "-c",
                (
                    "import sys; "
                    f"print(int({SUPPORTED_PYTHON_MIN!r} <= sys.version_info[:2] <= {SUPPORTED_PYTHON_MAX!r}))"
                ),
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0 and result.stdout.strip() == "1"


def _conda_python_commands():
    """从 conda 环境列表中发现 Python；仅作为普通解释器查找失败后的兜底。"""
    conda_candidates = []
    conda_exe = os.getenv("CONDA_EXE", "").strip()
    if conda_exe:
        conda_candidates.append([conda_exe])
    conda_candidates.append(["conda"])

    seen_conda = set()
    env_prefixes = []
    for conda_cmd in conda_candidates:
        key = tuple(conda_cmd)
        if key in seen_conda:
            continue
        seen_conda.add(key)
        try:
            result = subprocess.run(
                conda_cmd + ["env", "list", "--json"],
                capture_output=True,
                text=True,
                timeout=15,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        if result.returncode != 0:
            continue
        try:
            env_prefixes.extend(json.loads(result.stdout).get("envs", []))
        except json.JSONDecodeError:
            continue
        break

    commands = []
    for prefix in env_prefixes:
        if os.name == "nt":
            python_path = os.path.join(prefix, "python.exe")
        else:
            python_path = os.path.join(prefix, "bin", "python")
        if os.path.exists(python_path):
            commands.append([python_path])
    return commands


def _candidate_python_commands():
    candidates = []
    venv_python = _venv_python_path()
    if os.path.exists(venv_python):
        candidates.append([venv_python])

    env_python = os.getenv("PROJECT_PYTHON", "").strip()
    if env_python:
        candidates.append([env_python])

    if os.name == "nt":
        candidates.extend([
            ["py", "-3.12"],
            ["py", "-3.11"],
            ["py", "-3.10"],
        ])
    candidates.extend([
        [sys.executable],
        ["python3.12"],
        ["python3.11"],
        ["python3.10"],
        ["python3"],
        ["python"],
    ])
    return candidates


def _find_supported_python():
    seen = set()
    for command_group in (_candidate_python_commands(), _conda_python_commands()):
        for command in command_group:
            key = tuple(command)
            if key in seen:
                continue
            seen.add(key)
            if _is_supported_python(command):
                return command
    return None


def _ensure_backend_python():
    """确保后端使用项目虚拟环境中的受支持 Python。"""
    global BACKEND_PYTHON

    venv_python = _venv_python_path()
    if os.path.exists(venv_python) and _is_supported_python([venv_python]):
        BACKEND_PYTHON = venv_python
        return

    has_existing_venv = os.path.exists(venv_python)
    base_python = _find_supported_python()
    if not base_python:
        min_text = ".".join(str(v) for v in SUPPORTED_PYTHON_MIN)
        max_text = ".".join(str(v) for v in SUPPORTED_PYTHON_MAX)
        print(f"[错误] 未找到支持的 Python 解释器（{min_text} - {max_text}）")
        print("       请安装 Python 3.12，或设置 PROJECT_PYTHON 指向受支持的 python.exe。")
        pause_and_exit(1)

    version = _python_version(base_python) or "unknown"
    if has_existing_venv:
        print(f"        检测到后端虚拟环境版本不受支持，正在重建: {BACKEND_VENV_DIR} (Python {version})")
        venv_args = ["-m", "venv", "--clear", BACKEND_VENV_DIR]
    else:
        print(f"        正在创建后端虚拟环境: {BACKEND_VENV_DIR} (Python {version})")
        venv_args = ["-m", "venv", BACKEND_VENV_DIR]
    result = subprocess.run(base_python + venv_args, cwd=BACKEND_DIR)
    if result.returncode != 0:
        print("[错误] 创建后端虚拟环境失败")
        pause_and_exit(1)
    if not _is_supported_python([venv_python]):
        print("[错误] 后端虚拟环境创建后版本仍不受支持")
        pause_and_exit(1)

    BACKEND_PYTHON = venv_python


def check_environment():
    """检查 Python 和 Node.js 环境"""
    print("[检查] Python 环境...")
    _ensure_backend_python()
    py_version = _python_version([BACKEND_PYTHON]) or "unknown"
    print(f"        后端 Python: {py_version} ({BACKEND_PYTHON})")

    print("[检查] Node.js 环境...")
    node_version = check_command("node", "--version")
    if not node_version:
        print("[错误] 未找到 Node.js，请先安装 Node.js 20.19+ 或 22.12+")
        pause_and_exit(1)
    print(f"        Node.js 版本: {node_version}")
    node_parts = node_version.lstrip("v").split(".")
    try:
        node_tuple = (int(node_parts[0]), int(node_parts[1]))
    except (IndexError, ValueError):
        print("[错误] 无法识别 Node.js 版本，请安装 Node.js 20.19+ 或 22.12+")
        pause_and_exit(1)
    node_supported = (
        node_tuple[0] == SUPPORTED_NODE_MIN[0] and node_tuple >= SUPPORTED_NODE_MIN
    ) or node_tuple >= SUPPORTED_NODE_ALT_MIN
    if not node_supported:
        min_text = ".".join(str(v) for v in SUPPORTED_NODE_MIN)
        alt_min_text = ".".join(str(v) for v in SUPPORTED_NODE_ALT_MIN)
        print(f"[错误] 当前 Node.js {node_version} 不满足前端工具链要求")
        print(f"       请使用 Node.js {min_text}+ 或 {alt_min_text}+；推荐使用 Node.js 22 LTS。")
        pause_and_exit(1)
    print()


def _run_check(command, cwd):
    """运行环境检查命令，只关心退出码。"""
    try:
        return subprocess.run(
            command,
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=20,
        ).returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _backend_deps_ok():
    """确认当前 Python 解释器能导入后端关键依赖。"""
    imports = (
        "import dotenv; import fastapi; import sqlalchemy; import pydantic; "
        "import jose; import passlib; import uvicorn; import docx; import openpyxl"
    )
    return _run_check([BACKEND_PYTHON, "-c", imports], BACKEND_DIR)


def install_backend_deps():
    """安装后端依赖"""
    print("[1/4] 检查后端依赖...")
    flag_file = os.path.join(BACKEND_DIR, ".deps_installed")
    req_file = os.path.join(BACKEND_DIR, "requirements.txt")

    # 如依赖文件比标记文件更新，或当前解释器缺少依赖，则需要重新安装
    need_install = not os.path.exists(flag_file)
    if not need_install and os.path.exists(req_file):
        if os.path.getmtime(req_file) > os.path.getmtime(flag_file):
            need_install = True
            print("      检测到依赖变更，正在更新...")
    if not need_install and not _backend_deps_ok():
        need_install = True
        print(f"      当前后端虚拟环境依赖不完整，正在更新... ({BACKEND_PYTHON})")

    if need_install:
        print("      正在安装后端依赖...")
        result = subprocess.run(
            [BACKEND_PYTHON, "-m", "pip", "install", "-r", req_file, "-q"],
            cwd=BACKEND_DIR
        )
        if result.returncode != 0:
            print("[错误] 后端依赖安装失败")
            pause_and_exit(1)
        if not _backend_deps_ok():
            print("[错误] 后端依赖安装后仍无法导入，请检查 Python 环境")
            pause_and_exit(1)
        with open(flag_file, "w") as f:
            f.write(BACKEND_PYTHON)
    else:
        print("      后端依赖已安装")

    print("      后端依赖 OK")
    print()


def _frontend_deps_ok():
    """确认前端依赖可被 Node 正常解析，避免 node_modules 损坏被误判。"""
    runtime_core = os.path.join(
        FRONTEND_DIR, "node_modules", "@vue", "runtime-core", "dist", "runtime-core.cjs.prod.js"
    )
    if not os.path.exists(runtime_core):
        return False
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    return (
        _run_check([npm_cmd, "ls", "--depth=0"], FRONTEND_DIR)
        and _run_check(["node", "--check", runtime_core], FRONTEND_DIR)
    )


def install_frontend_deps():
    """安装前端依赖"""
    print("[2/4] 检查前端依赖...")
    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"

    if os.path.isdir(node_modules) and _frontend_deps_ok():
        print("      前端依赖已安装")
    else:
        if os.path.isdir(node_modules):
            print("      前端依赖不完整或已损坏，正在重新安装...")
            install_args = [npm_cmd, "install", "--force"]
        else:
            print("      首次运行，正在安装前端依赖...")
            install_args = [npm_cmd, "install"]
        result = subprocess.run(
            install_args,
            cwd=FRONTEND_DIR
        )
        if result.returncode != 0:
            print("[错误] 前端依赖安装失败")
            pause_and_exit(1)
        if not _frontend_deps_ok():
            print("[错误] 前端依赖安装后仍无法解析，请删除 node_modules 后重新安装")
            pause_and_exit(1)

    print("      前端依赖 OK")
    print()


def start_backend():
    """启动后端服务（当前进程的子进程，关窗口自动停止）"""
    print("[3/4] 启动后端服务 (端口 8000)...")

    proc = subprocess.Popen(
        [BACKEND_PYTHON, "-m", "uvicorn", "app.main:app",
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
