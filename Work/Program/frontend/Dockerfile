ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM ${NGINX_IMAGE}
# 自签名证书生成需要 openssl
RUN apk add --no-cache openssl
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker-entrypoint.d/40-ensure-ssl-cert.sh /docker-entrypoint.d/40-ensure-ssl-cert.sh
RUN chmod +x /docker-entrypoint.d/40-ensure-ssl-cert.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
