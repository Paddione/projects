# =============================================================================
# SOS (Taschentherapeut) Dockerfile
# =============================================================================
# Multi-stage build: deps → build → production
# Context: project root (docker build -f SOS/Dockerfile .)
# =============================================================================

# --- Base ---
FROM node:20-bullseye-slim AS base
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY SOS/package.json SOS/package-lock.json ./
RUN npm ci

# --- Build ---
FROM deps AS build
COPY SOS/src ./src
COPY SOS/tsconfig.json ./
RUN npx tsc

# --- Production ---
FROM base AS production
ENV NODE_ENV=production
ENV PORT=3005
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs appuser

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY SOS/public ./public
COPY SOS/package.json ./

USER 1001:1001

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3005/health/live').then(r=>{if(!r.ok)throw 1})" || exit 1

CMD ["node", "dist/server.js"]
