#!/usr/bin/env bash
#
# 项目完结单管理平台 - 一键启动 (Linux/macOS)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
ENV_FILE="$BACKEND_DIR/.env"
BACKEND_PID=""
FRONTEND_PID=""

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

command -v python3 >/dev/null 2>&1 || { echo -e "${RED}[错误] 未找到 python3${NC}"; exit 1; }
command -v node >/dev/null 2>&1 || { echo -e "${RED}[错误] 未找到 node${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}[错误] 未找到 npm${NC}"; exit 1; }

echo -e "${YELLOW}[模式]${NC} 当前环境: ${APP_ENV}"

echo -e "${YELLOW}[1/4]${NC} 检查后端依赖..."
if [ ! -f "$BACKEND_DIR/.deps_installed" ] || [ "$BACKEND_DIR/requirements.txt" -nt "$BACKEND_DIR/.deps_installed" ]; then
    echo "      正在安装后端依赖..."
    python3 -m pip install -r "$BACKEND_DIR/requirements.txt"
    printf 'ok\n' > "$BACKEND_DIR/.deps_installed"
else
    echo "      后端依赖已安装"
fi
echo -e "      后端依赖 ${GREEN}OK${NC}"

echo -e "${YELLOW}[2/4]${NC} 检查前端依赖..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "      正在安装前端依赖..."
    (cd "$FRONTEND_DIR" && npm install)
else
    echo "      前端依赖已安装"
fi
echo -e "      前端依赖 ${GREEN}OK${NC}"

echo -e "${YELLOW}[3/4]${NC} 启动后端服务 (端口 ${BACKEND_PORT})..."
cd "$BACKEND_DIR"
if [ "$APP_ENV" = "prod" ]; then
    python3 -m uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
else
    python3 -m uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT" &
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
