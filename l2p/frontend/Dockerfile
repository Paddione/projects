# Multi-stage build for React frontend with optimized caching and security

# Base stage with security hardening (align with Node 18 used elsewhere)
FROM node:20-alpine AS base
WORKDIR /app

# Install required packages (avoid upgrading base OS packages)
RUN apk add --no-cache \
    dumb-init \
    curl \
    wget \
    libc6-compat

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Development stage
FROM base AS development
WORKDIR /app

# Install dependencies first (better caching)
COPY l2p/frontend/package*.json ./
RUN npm install --legacy-peer-deps && \
    npm cache clean --force || true

# Copy source code and shared design system
COPY --chown=nodejs:nodejs l2p/frontend/ ./
COPY --chown=nodejs:nodejs shared-infrastructure/shared/design-system/ ../shared-infrastructure/shared/design-system/

# Create necessary directories with proper permissions
RUN mkdir -p coverage test-results playwright-report .vite && \
    chown -R nodejs:nodejs coverage test-results playwright-report .vite

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Run Vite dev server directly without TypeScript compilation
CMD ["dumb-init", "npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Dependencies stage - separate for better caching
FROM base AS dependencies
WORKDIR /app

# Copy frontend package files
COPY l2p/frontend/package*.json ./

# Install all dependencies
RUN npm install --legacy-peer-deps && \
    npm cache clean --force || true

# Build stage with optimized caching
FROM dependencies AS build
WORKDIR /app

# Accept build arguments (URL config is injected at runtime via docker-entrypoint.sh)
ARG VITE_NODE_ENV=production
ARG VITE_APP_ENVIRONMENT=production

# Copy source code (this layer will be cached if source doesn't change)
# Copy package.json first if it's different from dependencies stage
COPY --chown=nodejs:nodejs l2p/frontend/package*.json ./
# Copy shared design system first
COPY --chown=nodejs:nodejs shared-infrastructure/shared/design-system/ ../shared-infrastructure/shared/design-system/
# Copy source files without overwriting node_modules
COPY --chown=nodejs:nodejs l2p/frontend/src ./src
COPY --chown=nodejs:nodejs l2p/frontend/public ./public
COPY --chown=nodejs:nodejs l2p/frontend/index.html ./
COPY --chown=nodejs:nodejs l2p/frontend/vite.config.ts ./
COPY --chown=nodejs:nodejs l2p/frontend/tsconfig*.json ./
COPY --chown=nodejs:nodejs l2p/frontend/nginx.conf ./ 

# Set production environment variables for Vite build
ENV NODE_ENV=production
ENV VITE_NODE_ENV=${VITE_NODE_ENV}
ENV VITE_APP_ENVIRONMENT=${VITE_APP_ENVIRONMENT}

# Build the application with optimizations
RUN npm run build

# Production stage with Nginx and security hardening
FROM nginx:alpine AS production

# Install security updates and required packages
RUN apk add --no-cache \
    dumb-init \
    curl

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 -G nginx-app

# Copy built application with proper ownership
COPY --from=build --chown=nginx-app:nginx-app /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY --from=build --chown=nginx-app:nginx-app /app/nginx.conf /etc/nginx/nginx.conf

# Copy runtime environment entrypoint
COPY --chown=nginx-app:nginx-app l2p/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

# Remove unnecessary packages and files for security
RUN rm -rf /tmp/* /var/tmp/*

# Switch to non-root user
USER nginx-app

EXPOSE 80

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Use entrypoint to inject runtime env config, then start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]

# Add labels for monitoring and management
LABEL maintainer="Learn2Play Team" \
      version="1.0" \
      description="Learn2Play Frontend Application" \
      org.opencontainers.image.source="https://github.com/learn2play/frontend"
