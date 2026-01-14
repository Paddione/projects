# Multi-stage build for auth service
FROM node:20-bullseye-slim AS base

# Install dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy shared design system
COPY shared-infrastructure/shared/design-system /app/shared-infrastructure/shared/design-system

# Copy package files
COPY auth/package*.json ./

# Development stage
FROM base AS development
RUN npm ci
COPY auth/. .
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY shared-infrastructure/shared/design-system /app/shared-infrastructure/shared/design-system
COPY auth/. .
# Build backend
RUN npm run build
# Build frontend
RUN cd frontend && npm install && npm run build

# Production stage
FROM node:20-bullseye-slim AS production

# Install only production dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY auth/package*.json ./
RUN npm ci --only=production

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations

# Create non-root user
RUN groupadd -r authuser && useradd -r -g authuser authuser
RUN chown -R authuser:authuser /app
USER authuser

# Expose port
EXPOSE 5500

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5500/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
