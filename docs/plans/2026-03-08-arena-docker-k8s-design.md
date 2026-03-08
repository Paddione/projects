# Arena Docker/K8s Build Design

## Overview

Add Docker and Kubernetes build/deployment for the Arena service (top-down battle royale game). Arena has a separate backend (Express + Socket.io, port 3003) and frontend (React + PixiJS + Vite, port 3002) following the same workspace monorepo pattern as L2P.

## Architecture

### Deployment Topology

Two separate K8s deployments (mirrors L2P):
- **arena-backend**: Node.js server (Express + Socket.io + Drizzle ORM), port 3003
- **arena-frontend**: nginx serving Vite-built static files, port 80

Frontend nginx reverse-proxies `/api/*` and `/socket.io/*` to the backend cluster service internally. Only the frontend is exposed externally via Traefik IngressRoute at `arena.korczewski.de`.

### Auth Integration

- Uses existing `user-auth-chain` Traefik middleware (authentication only, no per-app access gate)
- Arena is open to all registered users — no app-specific ForwardAuth middleware needed
- Register arena in `auth.apps` table so it appears in the Hub page
- Static assets route (`/assets`, `/env-config.js`, favicon) bypasses auth

### Runtime Environment Injection

Same pattern as L2P frontend:
- `docker-entrypoint.sh` writes `env-config.js` from K8s env vars at container startup
- `env-config.js` sets `window.__IMPORT_META_ENV__` with `VITE_API_URL` and `VITE_SOCKET_URL`
- Arena's `apiService.ts` already reads these from `import.meta.env` with fallbacks

## Components

### Dockerfiles

**`arena/backend/Dockerfile`**:
- Base: `node:20-bullseye-slim` + `dumb-init`
- Build stage: install all deps, `tsc` compile
- Production stage: production deps + `dist/` + `migrations/`
- Non-root user (1001), health check on `/api/health`

**`arena/frontend/Dockerfile`**:
- Dependencies stage: `npm ci`
- Build stage: `vite build`
- Production: `nginx:alpine`, `docker-entrypoint.sh` for runtime env injection
- `nginx.conf` with SPA fallback, reverse proxy to backend, `env-config.js` no-cache

### K8s Manifests

**`k8s/services/arena-backend/`**: deployment.yaml, service.yaml, kustomization.yaml
- Image: `registry.local:5000/korczewski/arena-backend`
- Env: `DATABASE_URL`, `AUTH_SERVICE_URL`, `CORS_ORIGIN`, `NODE_ENV`, `PORT`
- Resources: 128Mi-256Mi memory, 100m-500m CPU

**`k8s/services/arena-frontend/`**: deployment.yaml, service.yaml, ingressroute.yaml, kustomization.yaml
- Image: `registry.local:5000/korczewski/arena-frontend`
- Env: `VITE_API_URL` (empty — nginx proxies internally), `VITE_SOCKET_URL` (`wss://arena.korczewski.de`)
- Resources: 64Mi-128Mi memory, 50m-200m CPU

### Infrastructure Integration

- **Skaffold**: Add `arena-backend` + `arena-frontend` artifacts, `arena` profile
- **Deploy script**: `k8s/scripts/deploy/deploy-arena.sh`
- **Deploy-changed**: Add arena to `SERVICE_DIRS`, `SERVICE_DOCKERFILES`, `SERVICE_MANIFESTS`, `SERVICE_DEPLOYMENTS`, `SERVICE_HEALTH`
- **Deploy-tracker**: Add arena to `ALL_SERVICES`

### Auth DB Registration

SQL INSERT into `auth.apps`:
```sql
INSERT INTO auth.apps (key, name, description, url)
VALUES ('arena', 'Arena', 'Top-down battle royale multiplayer game', 'https://arena.korczewski.de')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, url = EXCLUDED.url;
```

Grant access to all existing users:
```sql
INSERT INTO auth.user_app_access (user_id, app_id)
SELECT u.id, a.id FROM auth.users u, auth.apps a WHERE a.key = 'arena'
ON CONFLICT DO NOTHING;
```

## URL

- Production: `https://arena.korczewski.de`
- Dev: `https://dev-arena.korczewski.de` (future, via dev overlay)
