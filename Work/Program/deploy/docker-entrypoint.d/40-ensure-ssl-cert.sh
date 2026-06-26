#!/bin/sh
# nginx 启动前置脚本：确保 /etc/nginx/ssl 下存在 TLS 证书。
# 证书卷为空时自动生成自签名证书（有效期 10 年），已存在则跳过。
# 如需替换为正式证书，将 server.crt / server.key 放进挂载的证书卷即可。
set -e

SSL_DIR="/etc/nginx/ssl"
CRT="${SSL_DIR}/server.crt"
KEY="${SSL_DIR}/server.key"

if [ -f "$CRT" ] && [ -f "$KEY" ]; then
    echo "[ssl] 已存在证书，跳过生成"
    exit 0
fi

echo "[ssl] 未检测到证书，生成自签名证书..."
mkdir -p "$SSL_DIR"
CN="${SSL_CN:-localhost}"

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$KEY" -out "$CRT" \
    -subj "/CN=${CN}" \
    -addext "subjectAltName=DNS:${CN},DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY"
echo "[ssl] 证书已生成: CN=${CN}"
