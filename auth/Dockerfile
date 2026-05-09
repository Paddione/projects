# Multi-stage build for auth service
# Build context: project root
FROM node:20-bullseye-slim AS base

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Mirror monorepo layout so file:../packages/* resolves from /app/auth/
WORKDIR /app/auth

COPY packages/ /app/packages/
COPY auth/package*.json ./

# Build stage
FROM base AS build

# Install auth deps (includes workspace link to error-handling)
RUN npm ci

# Build @korczewski/error-handling to JS so Node can import it at runtime
# Use tsc from auth's node_modules (TypeScript is a dev dep of auth)
RUN cd /app/packages/error-handling && \
    printf '{"compilerOptions":{"outDir":"dist","module":"ESNext","target":"ES2022","moduleResolution":"node","skipLibCheck":true,"declaration":true,"typeRoots":["/app/auth/node_modules/@types"],"types":["node"]},"include":["src/**/*"]}' > tsconfig.json && \
    /app/auth/node_modules/.bin/tsc -p tsconfig.json && \
    npm pkg set main=dist/index.js types=dist/index.d.ts

COPY auth/. .
RUN npm run build
RUN cd frontend && npm install && npm run build

# Production stage
FROM node:20-bullseye-slim AS production

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/auth

# Include compiled error-handling so runtime imports resolve
COPY --from=build /app/packages/ /app/packages/
COPY auth/package*.json ./
RUN npm ci --only=production

COPY --from=build /app/auth/dist ./dist
COPY --from=build /app/auth/migrations ./migrations

RUN groupadd -r authuser && useradd -r -g authuser authuser
RUN chown -R authuser:authuser /app
USER authuser

EXPOSE 5500

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5500/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
