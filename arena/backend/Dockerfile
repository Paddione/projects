# Multi-stage build for Arena backend

FROM node:20-bullseye-slim AS base
WORKDIR /app/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init curl wget && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nodejs

# Build stage
FROM base AS build
WORKDIR /app/backend

COPY arena/backend/package*.json ./
RUN npm ci
RUN npm install -g typescript

COPY arena/backend/src ./src
COPY arena/backend/tsconfig.json ./
COPY arena/backend/migrations ./migrations

RUN npm run build

# Production dependencies
FROM base AS prod-deps
WORKDIR /app/backend

COPY arena/backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force || true

# Production stage
FROM base AS production
WORKDIR /app/backend

COPY --from=prod-deps --chown=nodejs:nodejs /app/backend/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/backend/package*.json ./
COPY --from=build --chown=nodejs:nodejs /app/backend/migrations ./migrations

RUN rm -rf /tmp/* /var/tmp/* /root/.npm

USER nodejs
EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3003/api/health || exit 1

CMD ["dumb-init", "node", "dist/server.js"]

LABEL maintainer="Korczewski" \
      description="Arena Backend - Express + Socket.io game server"
