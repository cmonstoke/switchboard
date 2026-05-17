# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache nginx

# Static files
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx site config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Node proxy
WORKDIR /app
COPY proxy-server.mjs .

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
