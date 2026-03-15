# Services

Application services deployed to the `korczewski-services` namespace.

## Overview

| Service | Port | Domain | Dependencies |
|---------|------|--------|--------------|
| Auth | 5500 | auth.korczewski.de | PostgreSQL |
| L2P Backend | 3001 | l2p.korczewski.de (`/api`, `/socket.io`) | PostgreSQL, Auth |
| L2P Frontend | 80 | l2p.korczewski.de | L2P Backend |
| Arena Backend | 3003 | arena.korczewski.de (`/api`, `/socket.io`) | PostgreSQL, Auth |
| Arena Frontend | 80 | arena.korczewski.de | Arena Backend |
| Shop | 3000 | shop.korczewski.de | PostgreSQL, Auth |
| VideoVault | 5000 | videovault.korczewski.de, video.korczewski.de | PostgreSQL, SMB |
| SOS | 3005 | sos.korczewski.de | None |

## Auth (`auth/`)

JWT authentication and OAuth service.

**Endpoints:**
- `/health/live`, `/health/ready` - Health checks
- `/api/auth/*` - Authentication endpoints
- `/api/oauth/*` - OAuth providers (Google)
- `/api/auth/forward-auth` - Traefik ForwardAuth

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## L2P Backend (`l2p-backend/`)

Multiplayer quiz platform API with WebSocket support.

**Endpoints:**
- `/api/health` - Health check
- `/api/*` - REST API
- `/socket.io/*` - WebSocket connections

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## L2P Frontend (`l2p-frontend/`)

React SPA for the L2P quiz platform. Runtime env injection via `docker-entrypoint.sh`.

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Arena Backend (`arena-backend/`)

Battle royale game API with Socket.io for real-time multiplayer.

**Endpoints:**
- `/api/health` - Health check
- `/api/*` - REST API (lobbies, matches, stats)
- `/socket.io/*` - WebSocket connections (game state)

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Arena Frontend (`arena-frontend/`)

React + PixiJS SPA for the Arena battle royale game.

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Shop (`shop/`)

Next.js shop platform with Stripe integration.

**Endpoints:**
- `/api/health/live`, `/api/health/ready` - Health checks
- `/api/*` - API routes
- `/api/stripe/webhook` - Stripe webhooks

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## VideoVault (`videovault/`)

Video management service with SMB-backed storage.

**Endpoints:**
- `/api/health/public` - Public health check
- `/api/*` - Video API
- `/videos/*` - Video streaming

**Requirements:** `smb-storage` StorageClass for video storage

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `pvc.yaml`, `kustomization.yaml`

## SOS (`sos/`)

Mental health companion app (Taschentherapeut). Static HTML, no database.

**Endpoints:**
- `/health/live`, `/health/ready` - Health checks
- `/*` - Static HTML SPA (15 screens, German)

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Common Patterns

All services share:
- Kustomize-based configuration
- Three-tier health probes (startup → readiness → liveness)
- IngressRoute for Traefik
- Namespace: `korczewski-services`
- Labels: `app.kubernetes.io/part-of: korczewski`

## Testing

See [`PRODUCTION_TESTING.md`](../../PRODUCTION_TESTING.md) at the project root for comprehensive production testing checklists covering all services.
