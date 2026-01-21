# Services

Application services deployed to the `korczewski-services` namespace.

## Overview

| Service | Port | Domain | Dependencies |
|---------|------|--------|--------------|
| Auth | 5500 | auth.korczewski.de | PostgreSQL |
| Dashboard | 4242 | dashboard.korczewski.de | Auth |
| L2P Backend | 3001 | l2p.korczewski.de (`/api`, `/socket.io`) | PostgreSQL, Auth |
| L2P Frontend | 80 | l2p.korczewski.de | L2P Backend |
| Payment | 3000 | payment.korczewski.de, shop.korczewski.de | PostgreSQL, Auth |
| VideoVault | 5000 | videovault.korczewski.de, video.korczewski.de | PostgreSQL, SMB |

## Auth (`auth/`)

JWT authentication and OAuth service.

**Endpoints:**
- `/health` - Health check
- `/api/auth/*` - Authentication endpoints
- `/api/oauth/*` - OAuth providers (Google)

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Dashboard (`dashboard/`)

Kubernetes Dashboard for cluster management.

**Namespace:** `korczewski-infra`

**Endpoints:**
- `/health` - Health check
- `/socket.io/*` - WebSocket connections

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `rbac.yaml`, `kustomization.yaml`

## L2P Backend (`l2p-backend/`)

Multiplayer quiz platform API with WebSocket support.

**Endpoints:**
- `/api/health` - Health check
- `/api/*` - REST API
- `/socket.io/*` - WebSocket connections

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## L2P Frontend (`l2p-frontend/`)

React SPA for the L2P quiz platform.

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## Payment (`payment/`)

Next.js payment platform with Stripe integration.

**Endpoints:**
- `/` - Main application
- `/api/*` - API routes
- `/api/stripe/webhook` - Stripe webhooks

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `kustomization.yaml`

## VideoVault (`videovault/`)

Video management service with SMB-backed storage.

**Endpoints:**
- `/api/health` - Health check
- `/api/*` - Video API
- `/videos/*` - Video streaming

**Requirements:** `smb-storage` StorageClass for video storage

**Manifests:** `deployment.yaml`, `service.yaml`, `ingressroute.yaml`, `pvc.yaml`, `kustomization.yaml`

## Common Patterns

All services share:
- Kustomize-based configuration
- Health probes configured
- IngressRoute for Traefik
- Namespace: `korczewski-services` (Dashboard runs in `korczewski-infra`)
- Labels: `app.kubernetes.io/part-of: korczewski`
