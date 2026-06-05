#!/usr/bin/env bash
#
# 项目完结单管理平台 - 一键启动 (Linux/macOS)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
ENV_FILE="$BACKEND_DIR/.env"
BACKEND_PID=""
FRONTEND_PID=""
BACKEND_PYTHON=""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

load_env_file() {
    if [ -f "$ENV_FILE" ]; then
        set -a
        # shellcheck disable=SC1090
        . "$ENV_FILE"
        set +a
    fi
}

open_browser() {
    local url="$1"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 || true
    elif command -v open >/dev/null 2>&1; then
        open "$url" >/dev/null 2>&1 || true
    fi
}

cleanup() {
    echo ""
    echo -e "${YELLOW}正在关闭服务...${NC}"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}已停止所有服务${NC}"
}

trap cleanup EXIT INT TERM

echo "============================================"
echo "  项目完结单管理平台 - 一键启动"
echo "============================================"
echo ""

load_env_file

APP_ENV="${ENV:-dev}"
BACKEND_HOST="${HOST:-0.0.0.0}"
BACKEND_PORT="${PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PY_MIN_MAJOR=3
PY_MIN_MINOR=10
PY_MAX_MINOR=12
NODE_MIN_MAJOR=20
NODE_MIN_MINOR=19
NODE_ALT_MIN_MAJOR=22
NODE_ALT_MIN_MINOR=12

command -v node >/dev/null 2>&1 || { echo -e "${RED}[错误] 未找到 node${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}[错误] 未找到 npm${NC}"; exit 1; }

echo -e "${YELLOW}[模式]${NC} 当前环境: ${APP_ENV}"

supported_python() {
    "$1" -c "import sys; raise SystemExit(0 if (sys.version_info.major, sys.version_info.minor) >= ($PY_MIN_MAJOR, $PY_MIN_MINOR) and (sys.version_info.major, sys.version_info.minor) <= ($PY_MIN_MAJOR, $PY_MAX_MINOR) else 1)" >/dev/null 2>&1
}

find_supported_python() {
    local candidates=()
    if [ -x "$VENV_DIR/bin/python" ]; then candidates+=("$VENV_DIR/bin/python"); fi
    if [ -n "${PROJECT_PYTHON:-}" ]; then candidates+=("$PROJECT_PYTHON"); fi
    candidates+=("python3.12" "python3.11" "python3.10" "python3" "python")
    for candidate in "${candidates[@]}"; do
        if command -v "$candidate" >/dev/null 2>&1 && supported_python "$candidate"; then
            command -v "$candidate"
            return 0
        fi
    done
    return 1
}

if [ -x "$VENV_DIR/bin/python" ] && supported_python "$VENV_DIR/bin/python"; then
    BACKEND_PYTHON="$VENV_DIR/bin/python"
else
    HAS_EXISTING_VENV=0
    if [ -x "$VENV_DIR/bin/python" ]; then HAS_EXISTING_VENV=1; fi
    BASE_PYTHON="$(find_supported_python || true)"
    if [ -z "$BASE_PYTHON" ]; then
        echo -e "${RED}[错误] 未找到支持的 Python 解释器（${PY_MIN_MAJOR}.${PY_MIN_MINOR} - ${PY_MIN_MAJOR}.${PY_MAX_MINOR}）${NC}"
        echo "       请安装 Python 3.12，或设置 PROJECT_PYTHON 指向受支持的 python。"
        exit 1
    fi
    PY_VERSION_TEXT="$("$BASE_PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
    if [ "$HAS_EXISTING_VENV" = "1" ]; then
        echo "      检测到后端虚拟环境版本不受支持，正在重建: $VENV_DIR (Python $PY_VERSION_TEXT)"
        "$BASE_PYTHON" -m venv --clear "$VENV_DIR"
    else
        echo "      正在创建后端虚拟环境: $VENV_DIR (Python $PY_VERSION_TEXT)"
        "$BASE_PYTHON" -m venv "$VENV_DIR"
    fi
    if ! supported_python "$VENV_DIR/bin/python"; then
        echo -e "${RED}[错误] 后端虚拟环境创建后版本仍不受支持${NC}"
        exit 1
    fi
    BACKEND_PYTHON="$VENV_DIR/bin/python"
fi
PY_VERSION_TEXT="$("$BACKEND_PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
echo "      后端 Python: $PY_VERSION_TEXT ($BACKEND_PYTHON)"

NODE_VERSION_TEXT="$(node --version)"
NODE_VERSION_OK="$(node -e "const [maj,min]=process.versions.node.split('.').map(Number); process.stdout.write(String(Number((maj === $NODE_MIN_MAJOR && min >= $NODE_MIN_MINOR) || (maj > $NODE_ALT_MIN_MAJOR || (maj === $NODE_ALT_MIN_MAJOR && min >= $NODE_ALT_MIN_MINOR)))))")"
if [ "$NODE_VERSION_OK" != "1" ]; then
    echo -e "${RED}[错误] 当前 Node.js ${NODE_VERSION_TEXT} 不满足前端工具链要求${NC}"
    echo "       请使用 Node.js ${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}+ 或 ${NODE_ALT_MIN_MAJOR}.${NODE_ALT_MIN_MINOR}+；推荐 Node.js 22 LTS。"
    exit 1
fi

backend_deps_ok() {
    (cd "$BACKEND_DIR" && "$BACKEND_PYTHON" -c 'import dotenv; import fastapi; import sqlalchemy; import pydantic; import jose; import passlib; import uvicorn; import docx; import openpyxl') >/dev/null 2>&1
}

frontend_deps_ok() {
    local runtime_core="$FRONTEND_DIR/node_modules/@vue/runtime-core/dist/runtime-core.cjs.prod.js"
    [ -f "$runtime_core" ] || return 1
    (cd "$FRONTEND_DIR" && npm ls --depth=0 >/dev/null 2>&1) || return 1
    node --check "$runtime_core" >/dev/null 2>&1
}

echo -e "${YELLOW}[1/4]${NC} 检查后端依赖..."
if [ ! -f "$BACKEND_DIR/.deps_installed" ] || [ "$BACKEND_DIR/requirements.txt" -nt "$BACKEND_DIR/.deps_installed" ] || ! backend_deps_ok; then
    echo "      正在安装后端依赖..."
    "$BACKEND_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
    if ! backend_deps_ok; then
        echo -e "${RED}[错误] 后端依赖安装后仍无法导入，请检查 Python 环境${NC}"
        exit 1
    fi
    "$BACKEND_PYTHON" -c 'import sys; print(sys.executable)' > "$BACKEND_DIR/.deps_installed"
else
    echo "      后端依赖已安装"
fi
echo -e "      后端依赖 ${GREEN}OK${NC}"

echo -e "${YELLOW}[2/4]${NC} 检查前端依赖..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "      正在安装前端依赖..."
    (cd "$FRONTEND_DIR" && npm install)
elif ! frontend_deps_ok; then
    echo "      前端依赖不完整或已损坏，正在重新安装..."
    (cd "$FRONTEND_DIR" && npm install --force)
else
    echo "      前端依赖已安装"
fi
if ! frontend_deps_ok; then
    echo -e "${RED}[错误] 前端依赖安装后仍无法解析，请删除 node_modules 后重新安装${NC}"
    exit 1
fi
echo -e "      前端依赖 ${GREEN}OK${NC}"

echo -e "${YELLOW}[3/4]${NC} 启动后端服务 (端口 ${BACKEND_PORT})..."
cd "$BACKEND_DIR"
if [ "$APP_ENV" = "prod" ]; then
    "$BACKEND_PYTHON" -m uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
else
    "$BACKEND_PYTHON" -m uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
fi
BACKEND_PID=$!
sleep 2

echo -e "${YELLOW}[4/4]${NC} 启动前端服务 (端口 ${FRONTEND_PORT})..."
cd "$FRONTEND_DIR"
if [ "$APP_ENV" = "prod" ]; then
    if [ -z "${VITE_API_URL:-}" ]; then
        echo -e "${YELLOW}[提示]${NC} prod 模式未设置 VITE_API_URL，前端将使用相对路径 /api。"
        echo "      本脚本使用 vite preview 时会代理到本机后端；若改为 Nginx 托管静态文件，请额外配置 /api 反向代理。"
    fi
    npm run build
    npm run preview -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
else
    npx vite --host 0.0.0.0 --port "$FRONTEND_PORT" &
fi
FRONTEND_PID=$!
sleep 3

echo ""
echo "============================================"
echo -e "  ${GREEN}启动完成！${NC}"
echo "  前端:   http://localhost:${FRONTEND_PORT}"
echo "  后端:   http://localhost:${BACKEND_PORT}"
if [ "$APP_ENV" = "dev" ]; then
    echo "  API文档: http://localhost:${BACKEND_PORT}/docs"
fi
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

open_browser "http://localhost:${FRONTEND_PORT}"
wait
