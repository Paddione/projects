# Multi-stage build for Arena frontend

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init curl libc6-compat
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

# Dependencies
FROM base AS dependencies
WORKDIR /app
COPY arena/frontend/package*.json ./
RUN npm install && npm cache clean --force || true

# Build
FROM dependencies AS build
WORKDIR /app

ARG VITE_NODE_ENV=production
ENV NODE_ENV=production
ENV VITE_NODE_ENV=${VITE_NODE_ENV}

COPY --chown=nodejs:nodejs arena/frontend/package*.json ./
# Copy shared-3d package and create symlink so it resolves three from app's node_modules
COPY --chown=nodejs:nodejs shared-infrastructure/shared/3d/package.json ../shared-infrastructure/shared/3d/package.json
COPY --chown=nodejs:nodejs shared-infrastructure/shared/3d/dist/ ../shared-infrastructure/shared/3d/dist/
RUN ln -s /app/node_modules ../shared-infrastructure/shared/3d/node_modules
COPY --chown=nodejs:nodejs arena/frontend/src ./src
COPY --chown=nodejs:nodejs arena/frontend/public ./public
COPY --chown=nodejs:nodejs arena/frontend/index.html ./
COPY --chown=nodejs:nodejs arena/frontend/vite.config.ts ./
COPY --chown=nodejs:nodejs arena/frontend/tsconfig*.json ./
COPY --chown=nodejs:nodejs arena/frontend/nginx.conf ./

RUN npm run build

# Production
FROM nginx:alpine AS production

RUN apk add --no-cache dumb-init curl
RUN addgroup -g 1001 -S nginx-app && adduser -S nginx-app -u 1001 -G nginx-app

COPY --from=build --chown=nginx-app:nginx-app /app/dist /usr/share/nginx/html
COPY --from=build --chown=nginx-app:nginx-app /app/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx-app:nginx-app arena/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

RUN rm -rf /tmp/* /var/tmp/*

USER nginx-app
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]

LABEL maintainer="Korczewski" \
      description="Arena Frontend - React + PixiJS game client"
