#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/.env.production"

cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] docker is not installed or not in PATH."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "[ERROR] docker compose is not available. Install Docker Compose v2 first."
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    cp "$ROOT/.env.production.example" "$ENV_FILE"
    echo "[ERROR] Created .env.production from template."
    echo "        Edit .env.production and replace all change-this-* values, then run this script again."
    exit 1
fi

if grep -q "change-this" "$ENV_FILE"; then
    echo "[ERROR] .env.production still contains change-this placeholders."
    echo "        Set real POSTGRES_PASSWORD, SECRET_KEY and DEFAULT_ADMIN_PASSWORD before deployment."
    exit 1
fi

echo "[INFO] Building and starting services..."
docker compose --env-file "$ENV_FILE" up -d --build

echo "[INFO] Service status:"
docker compose --env-file "$ENV_FILE" ps

echo "[OK] Deployment started."
echo "     Open: http://<server-ip>:$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2- || echo 80)"
