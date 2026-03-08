# Arena Docker/K8s Build Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create Docker images and Kubernetes deployments for the Arena service, integrate with the auth system, and register it in the Hub service menu.

**Architecture:** Two separate deployments (arena-backend + arena-frontend) on `arena.korczewski.de`, using Traefik priority-based routing (same pattern as L2P). Backend handles `/api` + `/socket.io`, frontend catches all other paths. Auth uses `user-auth-chain` (open to all registered users).

**Tech Stack:** Docker multi-stage builds, nginx, K8s Deployments/Services/IngressRoutes, Traefik, Skaffold, Bash deploy scripts

---

### Task 1: Arena Backend Dockerfile

**Files:**
- Create: `arena/backend/Dockerfile`

**Step 1: Create the Dockerfile**

```dockerfile
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
```

**Step 2: Verify build works**

Run: `cd /home/patrick/projects && docker build -t arena-backend-test -f arena/backend/Dockerfile .`
Expected: Successful build

**Step 3: Commit**

```bash
git add arena/backend/Dockerfile
git commit -m "feat(arena): add backend Dockerfile"
```

---

### Task 2: Arena Frontend Docker Setup (entrypoint + nginx + Dockerfile)

**Files:**
- Create: `arena/frontend/docker-entrypoint.sh`
- Create: `arena/frontend/nginx.conf`
- Create: `arena/frontend/Dockerfile`
- Modify: `arena/frontend/index.html` (add env-config.js script tag)

**Step 1: Create docker-entrypoint.sh**

```bash
#!/bin/sh
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__IMPORT_META_ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-}",
  VITE_NODE_ENV: "${VITE_NODE_ENV:-production}"
};
EOF
exec dumb-init nginx -g "daemon off;"
```

Make executable: `chmod +x arena/frontend/docker-entrypoint.sh`

**Step 2: Create nginx.conf**

```nginx
worker_processes auto;
pid /var/run/nginx.pid;
error_log /var/log/nginx/error.log warn;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';
    access_log /var/log/nginx/access.log main;

    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Runtime env config — never cache
        location = /env-config.js {
            add_header Cache-Control "no-store, no-cache, must-revalidate";
            add_header Pragma "no-cache";
        }

        # Static assets — long cache
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

**Step 3: Add env-config.js script tag to index.html**

In `arena/frontend/index.html`, add this line inside `<head>` BEFORE the Vite entry:

```html
<script src="/env-config.js"></script>
```

**Step 4: Create a placeholder env-config.js**

Create `arena/frontend/public/env-config.js`:

```javascript
// Placeholder — overwritten by docker-entrypoint.sh in production
window.__IMPORT_META_ENV__ = {};
```

**Step 5: Wire up the runtime env in apiService.ts**

The arena frontend already reads `import.meta.env.VITE_API_URL` and `import.meta.env.VITE_SOCKET_URL` in `arena/frontend/src/services/apiService.ts`. In production builds, Vite does NOT replace `import.meta.env.*` for unknown vars. We need to make it read from `window.__IMPORT_META_ENV__` as a fallback.

Modify `arena/frontend/src/services/apiService.ts` lines 3-4:

```typescript
const env = (window as any).__IMPORT_META_ENV__ || {};
const API_URL = import.meta.env.VITE_API_URL || env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || env.VITE_SOCKET_URL || window.location.origin;
```

**Step 6: Create the Dockerfile**

```dockerfile
# Multi-stage build for Arena frontend

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init curl libc6-compat
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs

# Dependencies
FROM base AS dependencies
WORKDIR /app
COPY arena/frontend/package*.json ./
RUN npm ci && npm cache clean --force || true

# Build
FROM dependencies AS build
WORKDIR /app

ARG VITE_NODE_ENV=production
ENV NODE_ENV=production
ENV VITE_NODE_ENV=${VITE_NODE_ENV}

COPY --chown=nodejs:nodejs arena/frontend/package*.json ./
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
```

**Step 7: Verify build works**

Run: `cd /home/patrick/projects && docker build -t arena-frontend-test -f arena/frontend/Dockerfile .`
Expected: Successful build

**Step 8: Commit**

```bash
git add arena/frontend/docker-entrypoint.sh arena/frontend/nginx.conf arena/frontend/Dockerfile arena/frontend/public/env-config.js arena/frontend/index.html arena/frontend/src/services/apiService.ts
git commit -m "feat(arena): add frontend Dockerfile with runtime env injection"
```

---

### Task 3: K8s Manifests — Arena Backend

**Files:**
- Create: `k8s/services/arena-backend/deployment.yaml`
- Create: `k8s/services/arena-backend/service.yaml`
- Create: `k8s/services/arena-backend/ingressroute.yaml`
- Create: `k8s/services/arena-backend/kustomization.yaml`

**Step 1: Create deployment.yaml**

```yaml
---
# =============================================================================
# Arena Backend Deployment
# =============================================================================
# Express.js backend with Socket.io for real-time battle royale game.
# =============================================================================

apiVersion: apps/v1
kind: Deployment
metadata:
  name: arena-backend
  namespace: korczewski-services
  labels:
    app: arena-backend
    app.kubernetes.io/name: arena-backend
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: arena-backend
      app.kubernetes.io/component: backend
      app.kubernetes.io/part-of: korczewski
      tier: services
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: arena-backend
        app.kubernetes.io/name: arena-backend
        app.kubernetes.io/component: backend
        app.kubernetes.io/part-of: korczewski
        tier: services
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      nodeSelector:
        kubernetes.io/arch: amd64
      containers:
        - name: arena-backend
          image: registry.local:5000/korczewski/arena-backend
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3003
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3003"
            - name: DATABASE_URL
              value: "postgresql://arena_user:arena_pass@postgres.korczewski-infra.svc.cluster.local:5432/arena_db"
            - name: AUTH_SERVICE_URL
              value: "http://auth.korczewski-services.svc.cluster.local:5500"
            - name: CORS_ORIGIN
              value: "https://arena.korczewski.de"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3003
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3003
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /api/health
              port: 3003
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
```

**Step 2: Create service.yaml**

```yaml
---
# =============================================================================
# Arena Backend Service
# =============================================================================

apiVersion: v1
kind: Service
metadata:
  name: arena-backend
  namespace: korczewski-services
  labels:
    app: arena-backend
    app.kubernetes.io/name: arena-backend
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  type: ClusterIP
  ports:
    - port: 3003
      targetPort: 3003
      protocol: TCP
      name: http
  selector:
    app: arena-backend
```

**Step 3: Create ingressroute.yaml**

Uses same priority-based pattern as L2P: backend gets `/api` (priority 100) and `/socket.io` (priority 110), protected by `user-auth-chain`.

```yaml
---
# =============================================================================
# Arena Backend IngressRoute
# =============================================================================
# Routes /api and /socket.io paths to the backend.
# Higher priority ensures these match before the frontend catch-all.
# =============================================================================

apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: arena-backend
  namespace: korczewski-services
  labels:
    app: arena-backend
    app.kubernetes.io/name: arena-backend
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  routes:
    # Socket.io routes (highest priority, minimal middleware for WebSocket)
    - match: Host(`arena.korczewski.de`) && PathPrefix(`/socket.io`)
      kind: Rule
      priority: 110
      services:
        - name: arena-backend
          port: 3003
      middlewares:
        - name: websocket-chain
          namespace: korczewski-infra

    # API routes (auth required)
    - match: Host(`arena.korczewski.de`) && PathPrefix(`/api`)
      kind: Rule
      priority: 100
      services:
        - name: arena-backend
          port: 3003
      middlewares:
        - name: user-auth-chain
          namespace: korczewski-infra
  tls: {}
```

**Step 4: Create kustomization.yaml**

```yaml
# =============================================================================
# Arena Backend Kustomization
# =============================================================================

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: arena-backend

namespace: korczewski-services

labels:
  - pairs:
      app.kubernetes.io/part-of: korczewski
      app.kubernetes.io/component: arena-backend
      tier: services

resources:
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml
```

**Step 5: Validate manifests**

Run: `cd /home/patrick/projects/k8s && kustomize build services/arena-backend/`
Expected: Valid YAML output with all resources

**Step 6: Commit**

```bash
git add k8s/services/arena-backend/
git commit -m "feat(arena): add backend K8s manifests"
```

---

### Task 4: K8s Manifests — Arena Frontend

**Files:**
- Create: `k8s/services/arena-frontend/deployment.yaml`
- Create: `k8s/services/arena-frontend/service.yaml`
- Create: `k8s/services/arena-frontend/ingressroute.yaml`
- Create: `k8s/services/arena-frontend/kustomization.yaml`

**Step 1: Create deployment.yaml**

```yaml
---
# =============================================================================
# Arena Frontend Deployment
# =============================================================================
# React + PixiJS frontend served by Nginx.
# =============================================================================

apiVersion: apps/v1
kind: Deployment
metadata:
  name: arena-frontend
  namespace: korczewski-services
  labels:
    app: arena-frontend
    app.kubernetes.io/name: arena-frontend
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: arena-frontend
      app.kubernetes.io/component: frontend
      app.kubernetes.io/part-of: korczewski
      tier: services
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: arena-frontend
        app.kubernetes.io/name: arena-frontend
        app.kubernetes.io/component: frontend
        app.kubernetes.io/part-of: korczewski
        tier: services
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
      nodeSelector:
        kubernetes.io/arch: amd64
      containers:
        - name: arena-frontend
          image: registry.local:5000/korczewski/arena-frontend
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          env:
            - name: VITE_SOCKET_URL
              value: "wss://arena.korczewski.de"
          resources:
            requests:
              memory: "64Mi"
              cpu: "50m"
            limits:
              memory: "128Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
```

**Step 2: Create service.yaml**

```yaml
---
# =============================================================================
# Arena Frontend Service
# =============================================================================

apiVersion: v1
kind: Service
metadata:
  name: arena-frontend
  namespace: korczewski-services
  labels:
    app: arena-frontend
    app.kubernetes.io/name: arena-frontend
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP
      name: http
  selector:
    app: arena-frontend
```

**Step 3: Create ingressroute.yaml**

```yaml
---
# =============================================================================
# Arena Frontend IngressRoute
# =============================================================================
# Serves the frontend for all paths not matched by backend routes.
# Lower priority ensures /api and /socket.io go to backend.
# =============================================================================

apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: arena-frontend
  namespace: korczewski-services
  labels:
    app: arena-frontend
    app.kubernetes.io/name: arena-frontend
    app.kubernetes.io/component: frontend
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  routes:
    - match: Host(`arena.korczewski.de`)
      kind: Rule
      priority: 10
      services:
        - name: arena-frontend
          port: 80
      middlewares:
        - name: user-auth-chain
          namespace: korczewski-infra
  tls: {}
```

**Step 4: Create kustomization.yaml**

```yaml
# =============================================================================
# Arena Frontend Kustomization
# =============================================================================

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: arena-frontend

namespace: korczewski-services

labels:
  - pairs:
      app.kubernetes.io/part-of: korczewski
      app.kubernetes.io/component: arena-frontend
      tier: services

resources:
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml
```

**Step 5: Validate manifests**

Run: `cd /home/patrick/projects/k8s && kustomize build services/arena-frontend/`
Expected: Valid YAML output with all resources

**Step 6: Commit**

```bash
git add k8s/services/arena-frontend/
git commit -m "feat(arena): add frontend K8s manifests"
```

---

### Task 5: Skaffold Integration

**Files:**
- Modify: `k8s/skaffold.yaml`

**Step 1: Add arena artifacts to the build section**

In `k8s/skaffold.yaml`, add these entries to `build.artifacts` (after the SOS entry around line 59):

```yaml
    # Arena Backend
    - image: registry.korczewski.de/korczewski/arena-backend
      context: ..
      docker:
        dockerfile: arena/backend/Dockerfile

    # Arena Frontend
    - image: registry.korczewski.de/korczewski/arena-frontend
      context: ..
      docker:
        dockerfile: arena/frontend/Dockerfile
```

**Step 2: Add arena manifest paths**

In `manifests.kustomize.paths` (after `services/sos` around line 77):

```yaml
      - services/arena-backend
      - services/arena-frontend
```

**Step 3: Add arena port forwarding**

In `portForward` (after the SOS entry around line 139):

```yaml
  - resourceType: service
    resourceName: arena-backend
    namespace: korczewski-services
    port: 3003
    localPort: 3003
  - resourceType: service
    resourceName: arena-frontend
    namespace: korczewski-services
    port: 80
    localPort: 3002
```

**Step 4: Add arena profile**

In `profiles` (after the SOS profile around line 213):

```yaml
  # Arena only (backend + frontend)
  - name: arena
    build:
      artifacts:
        - image: registry.korczewski.de/korczewski/arena-backend
          context: ..
          docker:
            dockerfile: arena/backend/Dockerfile
        - image: registry.korczewski.de/korczewski/arena-frontend
          context: ..
          docker:
            dockerfile: arena/frontend/Dockerfile
    manifests:
      kustomize:
        paths:
          - services/arena-backend
          - services/arena-frontend
```

**Step 5: Add arena to dev profile**

In the `dev` profile's `build.artifacts` (after the SOS entry):

```yaml
        - image: registry.korczewski.de/korczewski/arena-backend
          context: ..
          docker:
            dockerfile: arena/backend/Dockerfile
        - image: registry.korczewski.de/korczewski/arena-frontend
          context: ..
          docker:
            dockerfile: arena/frontend/Dockerfile
```

And in the `dev` profile's `portForward`:

```yaml
      - resourceType: service
        resourceName: arena-backend
        namespace: korczewski-dev
        port: 3003
        localPort: 3103
      - resourceType: service
        resourceName: arena-frontend
        namespace: korczewski-dev
        port: 80
        localPort: 3102
```

**Step 6: Commit**

```bash
git add k8s/skaffold.yaml
git commit -m "feat(arena): add Skaffold build config and arena profile"
```

---

### Task 6: Deploy Script

**Files:**
- Create: `k8s/scripts/deploy/deploy-arena.sh`

**Step 1: Create deploy-arena.sh**

Model after `deploy-shop.sh` but with two images (backend + frontend), same as L2P's pattern:

```bash
#!/bin/bash
# =============================================================================
# Deploy Arena Service
# =============================================================================
# Builds Docker images (backend + frontend), pushes to registry, applies
# manifests, and restarts deployments.
#
# Usage: ./deploy-arena.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

REGISTRY="registry.korczewski.de/korczewski"
NAMESPACE="korczewski-services"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

MANIFESTS_ONLY=false
HEALTH_CHECK=true

for arg in "$@"; do
    case $arg in
        --manifests-only) MANIFESTS_ONLY=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
    esac
done

log_step "Deploying Arena Service"

# Build and push images
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building arena-backend..."
    docker build -t "$REGISTRY/arena-backend:latest" -f "$PROJECT_ROOT/arena/backend/Dockerfile" "$PROJECT_ROOT"

    log_info "Building arena-frontend..."
    docker build -t "$REGISTRY/arena-frontend:latest" -f "$PROJECT_ROOT/arena/frontend/Dockerfile" "$PROJECT_ROOT"

    log_info "Pushing arena-backend..."
    docker push "$REGISTRY/arena-backend:latest"

    log_info "Pushing arena-frontend..."
    docker push "$REGISTRY/arena-frontend:latest"
fi

# Apply manifests
log_info "Applying Arena backend manifests..."
kubectl apply -k "$K8S_DIR/services/arena-backend/"

log_info "Applying Arena frontend manifests..."
kubectl apply -k "$K8S_DIR/services/arena-frontend/"

# Restart deployments to pull new images
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/arena-backend -n "$NAMESPACE"
    kubectl rollout restart deployment/arena-frontend -n "$NAMESPACE"
fi

# Wait for rollouts
log_info "Waiting for Arena backend rollout..."
kubectl rollout status deployment/arena-backend -n "$NAMESPACE" --timeout=180s

log_info "Waiting for Arena frontend rollout..."
kubectl rollout status deployment/arena-frontend -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    BACKEND_POD=$(kubectl get pods -n "$NAMESPACE" -l app=arena-backend \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$BACKEND_POD" ]; then
        HEALTH=$(kubectl exec "$BACKEND_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:3003/api/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Arena backend health: OK"
        else
            log_warn "Arena backend health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set arena
fi

log_info "Arena service deployed successfully!"
kubectl get pods -l "app in (arena-backend, arena-frontend)" -n "$NAMESPACE"
```

**Step 2: Make executable**

Run: `chmod +x k8s/scripts/deploy/deploy-arena.sh`

**Step 3: Commit**

```bash
git add k8s/scripts/deploy/deploy-arena.sh
git commit -m "feat(arena): add deploy-arena.sh script"
```

---

### Task 7: Deploy-Changed & Deploy-Tracker Integration

**Files:**
- Modify: `k8s/scripts/deploy/deploy-changed.sh`
- Modify: `k8s/scripts/utils/deploy-tracker.sh`

**Step 1: Add arena to deploy-changed.sh SERVICE_DIRS**

In `k8s/scripts/deploy/deploy-changed.sh`, add to the `SERVICE_DIRS` associative array (around line 78):

```bash
    ["arena"]="arena"
```

**Step 2: Add arena to SERVICE_DOCKERFILES**

```bash
    ["arena-backend"]="arena/backend/Dockerfile"
    ["arena-frontend"]="arena/frontend/Dockerfile"
```

**Step 3: Add arena to SERVICE_MANIFESTS**

```bash
    ["arena-backend"]="services/arena-backend"
    ["arena-frontend"]="services/arena-frontend"
```

**Step 4: Add arena to SERVICE_DEPLOYMENTS**

```bash
    ["arena-backend"]="arena-backend"
    ["arena-frontend"]="arena-frontend"
```

**Step 5: Add arena to SERVICE_HEALTH**

```bash
    ["arena-backend"]="app=arena-backend|3003|/api/health"
    ["arena-frontend"]="app=arena-frontend|80|/"
```

**Step 6: Check `get_image_targets` function**

Read `k8s/scripts/deploy/deploy-changed.sh` around lines 122+. If the function maps top-level service names to image targets, add arena (which produces two images, like L2P):

```bash
    arena) echo "arena-backend arena-frontend" ;;
```

**Step 7: Add arena to deploy-tracker.sh ALL_SERVICES**

In `k8s/scripts/utils/deploy-tracker.sh` line 38, add `arena`:

```bash
ALL_SERVICES=(auth l2p shop videovault sos arena)
```

**Step 8: Commit**

```bash
git add k8s/scripts/deploy/deploy-changed.sh k8s/scripts/utils/deploy-tracker.sh
git commit -m "feat(arena): integrate with deploy-changed and deploy-tracker"
```

---

### Task 8: Auth DB Registration & Root Config Updates

**Files:**
- Create: `arena/scripts/register-app.sql`
- Modify: `package.json` (root — add dev:arena script)
- Modify: `CLAUDE.md` (root — add arena to service table)

**Step 1: Create SQL script for auth app registration**

Create `arena/scripts/register-app.sql`:

```sql
-- Register Arena in the auth service app catalog
-- Run against auth_db: psql -h <host> -U auth_user -d auth_db -f register-app.sql

INSERT INTO auth.apps (key, name, description, url)
VALUES ('arena', 'Arena', 'Top-down battle royale multiplayer game', 'https://arena.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    url = EXCLUDED.url;

-- Grant access to all existing users (arena is open to all registered users)
INSERT INTO auth.user_app_access (user_id, app_id)
SELECT u.id, a.id FROM auth.users u, auth.apps a WHERE a.key = 'arena'
ON CONFLICT DO NOTHING;
```

**Step 2: Add dev:arena to root package.json**

In `/home/patrick/projects/package.json`, add to the `scripts` section:

```json
"dev:arena": "cd arena && npm run dev:frontend & cd arena && npm run dev:backend"
```

Check the exact pattern used by existing scripts (e.g. `dev:l2p`).

**Step 3: Add arena to CLAUDE.md service table**

In `/home/patrick/projects/CLAUDE.md`, add to the project table:

```markdown
| arena | React, PixiJS, Vite, Express, Socket.io, Drizzle ORM | 3002, 3003 |
```

**Step 4: Commit**

```bash
git add arena/scripts/register-app.sql package.json CLAUDE.md
git commit -m "feat(arena): add auth registration SQL and root config updates"
```

---

### Task 9: Run Auth DB Registration

**Step 1: Execute the SQL against production auth DB**

Run:
```bash
kubectl exec -n korczewski-infra deploy/postgres -- \
    psql -U auth_user -d auth_db -f - < arena/scripts/register-app.sql
```

Or via the postgres MCP tool / direct connection:
```sql
INSERT INTO auth.apps (key, name, description, url)
VALUES ('arena', 'Arena', 'Top-down battle royale multiplayer game', 'https://arena.korczewski.de')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, url = EXCLUDED.url;

INSERT INTO auth.user_app_access (user_id, app_id)
SELECT u.id, a.id FROM auth.users u, auth.apps a WHERE a.key = 'arena'
ON CONFLICT DO NOTHING;
```

**Step 2: Verify it shows in the Hub**

Run:
```bash
kubectl exec -n korczewski-infra deploy/postgres -- \
    psql -U auth_user -d auth_db -c "SELECT key, name, url, is_active FROM auth.apps WHERE key = 'arena';"
```

Expected: One row with `arena | Arena | https://arena.korczewski.de | t`

---

### Task 10: Build, Push, and Deploy

**Step 1: Build and push images**

```bash
cd /home/patrick/projects
docker build -t registry.korczewski.de/korczewski/arena-backend:latest -f arena/backend/Dockerfile .
docker build -t registry.korczewski.de/korczewski/arena-frontend:latest -f arena/frontend/Dockerfile .
docker push registry.korczewski.de/korczewski/arena-backend:latest
docker push registry.korczewski.de/korczewski/arena-frontend:latest
```

**Step 2: Deploy**

```bash
./k8s/scripts/deploy/deploy-arena.sh --manifests-only
```

(Since we already pushed images, `--manifests-only` applies manifests + restarts.)

**Step 3: Verify**

```bash
kubectl get pods -n korczewski-services -l "app in (arena-backend, arena-frontend)"
./k8s/scripts/utils/deploy-tracker.sh status
```

Expected: Both pods running, tracker shows arena as deployed.

**Step 4: Verify auth Hub**

Open https://auth.korczewski.de in browser, log in, and confirm Arena card appears in the Hub with an "Open" button linking to https://arena.korczewski.de.
