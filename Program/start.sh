#!/bin/bash
#
# 项目完结单管理平台 - 一键启动 (Linux/macOS)
#
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}正在关闭服务...${NC}"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}已停止所有服务${NC}"
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "============================================"
echo "  项目完结单管理平台 - 一键启动"
echo "============================================"
echo ""

# ---- 检查环境 ----
command -v python3 &>/dev/null || { echo -e "${RED}[错误] 未找到 python3${NC}"; exit 1; }
command -v node    &>/dev/null || { echo -e "${RED}[错误] 未找到 node${NC}"; exit 1; }
command -v npm     &>/dev/null || { echo -e "${RED}[错误] 未找到 npm${NC}"; exit 1; }

# ---- 后端依赖 ----
echo -e "${YELLOW}[1/4]${NC} 检查后端依赖..."
if ! python3 -c "import fastapi" &>/dev/null; then
    echo "      正在安装后端依赖..."
    pip3 install fastapi uvicorn sqlalchemy "python-jose[cryptography]" "passlib[bcrypt]" python-multipart openpyxl python-docx
fi
echo -e "      后端依赖 ${GREEN}OK${NC}"

# ---- 前端依赖 ----
echo -e "${YELLOW}[2/4]${NC} 检查前端依赖..."
if [ ! -d "$ROOT/frontend/node_modules" ]; then
    echo "      正在安装前端依赖..."
    cd "$ROOT/frontend" && npm install
fi
echo -e "      前端依赖 ${GREEN}OK${NC}"

# ---- 启动后端 ----
echo -e "${YELLOW}[3/4]${NC} 启动后端服务 (端口 8000)..."
cd "$ROOT/backend"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2

# ---- 启动前端 ----
echo -e "${YELLOW}[4/4]${NC} 启动前端服务 (端口 5173)..."
cd "$ROOT/frontend"
npx vite --host &
FRONTEND_PID=$!
sleep 3

echo ""
echo "============================================"
echo -e "  ${GREEN}启动完成！${NC}"
echo "  前端:   http://localhost:5173"
echo "  后端:   http://localhost:8000"
echo "  API文档: http://localhost:8000/docs"
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待子进程
wait
