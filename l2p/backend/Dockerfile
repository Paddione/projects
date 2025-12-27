# Multi-stage build for Node.js backend with optimized caching and security

# Base stage with security hardening (Node 20 LTS)
FROM node:20-bullseye-slim AS base
WORKDIR /app/backend

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    wget \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs nodejs

# Development stage
FROM base AS development
WORKDIR /app

# Install system dependencies
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories with proper permissions
RUN mkdir -p /app/node_modules /app/logs /app/coverage /app/test-results /app/shared

# Set proper ownership for app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Copy package files first for better caching
COPY --chown=nodejs:nodejs package*.json ./
COPY --chown=nodejs:nodejs tsconfig*.json ./

# Install global packages as root
USER root
RUN npm install -g typescript tsx nodemon

# Switch to non-root user for project dependencies
USER nodejs

# Install project dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY --chown=nodejs:nodejs . .

# Expose port
EXPOSE 3001

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/api/health || exit 1

# Use tsx for direct TypeScript execution without compilation
CMD ["dumb-init", "npx", "tsx", "src/server.ts"]

# Build dependencies stage (all dependencies for compilation)
FROM base AS build-dependencies
WORKDIR /app/backend

# Copy package files
COPY package*.json ./

# Install all dependencies for build (production + dev)
RUN npm install --legacy-peer-deps && \
    npm cache clean --force || true

# Install TypeScript globally for build
RUN npm install -g typescript

# Production dependencies stage (runtime only)
FROM base AS prod-dependencies
WORKDIR /app

# Copy and build shared modules first (needed for local file dependencies)
COPY --chown=nodejs:nodejs shared/ ./shared/

# Build error-handling module
WORKDIR /app/shared/error-handling
RUN npm install --legacy-peer-deps && npm run build

# Build test-config module
WORKDIR /app/shared/test-config
RUN npm install --legacy-peer-deps && npm run build || true

# Install backend production dependencies with proper context
WORKDIR /app/backend
COPY --chown=nodejs:nodejs backend/package*.json ./

# Install production dependencies (this will resolve local file dependencies correctly)
RUN npm install --production --legacy-peer-deps && \
    npm cache clean --force || true

# Build stage with optimized caching
FROM base AS build
WORKDIR /app

# Copy shared directory first and build shared modules
COPY --chown=nodejs:nodejs shared/ ./shared/

# Build shared modules
WORKDIR /app/shared/error-handling
RUN npm install --legacy-peer-deps && npm run build

WORKDIR /app/shared/test-config
RUN npm install --legacy-peer-deps && npm run build || true

# Copy backend source and install all dependencies for build
WORKDIR /app/backend
COPY --chown=nodejs:nodejs backend/package*.json ./
RUN npm install --legacy-peer-deps

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy backend source code
COPY --chown=nodejs:nodejs backend/. ./

# Build TypeScript
RUN npm run build

# Production stage with minimal footprint
FROM base AS production
WORKDIR /app/backend

# Copy production dependencies
COPY --from=prod-dependencies --chown=nodejs:nodejs /app/backend/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/backend/package*.json ./
# Copy migrations so runtime can execute them
COPY --from=build --chown=nodejs:nodejs /app/backend/migrations ./migrations
# Copy public admin dashboard assets
COPY --from=build --chown=nodejs:nodejs /app/backend/public ./public

# Copy shared modules for runtime resolution by relative imports (e.g., '../../../shared/error-handling')
# This aligns with development where './shared' is mounted into the container.
# Ensures compiled code that references '/app/shared/*' can be resolved at runtime.
COPY --from=build --chown=nodejs:nodejs /app/shared /app/shared

# Workaround: some builds may emit admin route to dist/backend/src/routes instead of dist/routes
# Ensure the expected path exists to avoid ERR_MODULE_NOT_FOUND
RUN if [ -f ./dist/backend/src/routes/admin.js ] && [ ! -f ./dist/routes/admin.js ]; then \
       mkdir -p ./dist/routes && cp ./dist/backend/src/routes/admin.js ./dist/routes/admin.js; \
     fi

# Create necessary directories with proper permissions
RUN mkdir -p logs chroma && \
    chown -R nodejs:nodejs logs chroma

# Remove unnecessary packages and files for security
RUN rm -rf /tmp/* /var/tmp/* /root/.npm

# Switch to non-root user
USER nodejs

EXPOSE 3001

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/api/health || exit 1

# Use dumb-init for proper signal handling and graceful shutdown
CMD ["dumb-init", "node", "dist/server.js"]

# Add labels for monitoring and management
LABEL maintainer="Learn2Play Team" \
      version="1.0" \
      description="Learn2Play Backend API" \
      org.opencontainers.image.source="https://github.com/learn2play/backend"