# Korczewski Kubernetes Infrastructure

Kubernetes deployment manifests and scripts for the Korczewski monorepo services.

## Overview

This directory contains everything needed to deploy the full Korczewski stack to a k3s Kubernetes cluster:

- **PostgreSQL** - Centralized database with isolated databases per service
- **Traefik** - Ingress controller with TLS and middleware
- **Auth Service** - JWT authentication and OAuth
- **L2P** - Multiplayer quiz platform (frontend + backend)
- **Shop** - Next.js shop platform with Stripe
- **VideoVault** - Video management with SMB-backed storage

## Quick Start

### Local Development (k3d)

```bash
# 1. Create local cluster
./scripts/cluster/k3d-create.sh

# 2. Generate secrets from .env
./scripts/utils/generate-secrets.sh

# 3. Deploy everything
./scripts/deploy/deploy-all.sh

# 4. Add hosts entries
echo '127.0.0.1 l2p.korczewski.de auth.korczewski.de shop.korczewski.de videovault.korczewski.de video.korczewski.de traefik.korczewski.de' | sudo tee -a /etc/hosts
```

### Production (Multi-Node k3s)

```bash
# On master node:
sudo ./scripts/cluster/k3s-init-master.sh

# On each worker node:
sudo ./scripts/cluster/k3s-join-worker.sh <MASTER_IP> '<TOKEN>'

# Ensure SMB share is reachable (for VideoVault):
# Update infrastructure/smb-csi/storageclass.yaml with SMB server + share
# Set SMB_USER/SMB_PASSWORD in .env for secret generation

# Deploy:
./scripts/deploy/deploy-all.sh
```

## Directory Structure

```
k8s/
├── scripts/              # Deployment and cluster scripts (see scripts/README.md)
│   ├── cluster/          # Cluster creation and join scripts
│   ├── deploy/           # Per-service deployment scripts
│   └── utils/            # Secret generation, validation, backup
├── base/                 # Base resources (namespaces)
├── infrastructure/       # Infrastructure components (see infrastructure/README.md)
│   ├── postgres/         # PostgreSQL StatefulSet
│   ├── traefik/          # Traefik deployment + middlewares
│   └── smb-csi/          # SMB/CIFS storage class
├── services/             # Application services (see services/README.md)
│   ├── auth/             # Auth service manifests
│   ├── l2p-backend/      # L2P backend manifests
│   ├── l2p-frontend/     # L2P frontend manifests
│   ├── shop/             # Shop service manifests
│   └── videovault/       # VideoVault manifests
├── overlays/             # Kustomize overlays (dev/prod)
├── secrets/              # Generated secrets (see secrets/README.md)
└── skaffold.yaml         # Skaffold configuration
```

## Development Workflow

### Using Skaffold

```bash
# Full development mode (all services)
cd k8s
skaffold dev

# Single service
skaffold dev --profile=auth
skaffold dev --profile=l2p
skaffold dev --profile=shop
skaffold dev --profile=videovault
skaffold dev --profile=infra

# Build and deploy once
skaffold run

# Production build with push
skaffold run --profile=prod
```

### Manual Deployment

```bash
# Deploy individual services
./scripts/deploy/deploy-postgres.sh
kubectl apply -k infrastructure/smb-csi
./scripts/deploy/deploy-traefik.sh
./scripts/deploy/deploy-auth.sh
./scripts/deploy/deploy-l2p.sh
./scripts/deploy/deploy-shop.sh
./scripts/deploy/deploy-videovault.sh
```

## Deployment Order

Services must be deployed in this order due to dependencies:

1. **Namespaces** - `korczewski-infra`, `korczewski-services`
2. **Secrets** - Generate from root `.env`
3. **SMB-CSI** - Required for VideoVault storage
4. **PostgreSQL** - Database must be ready first
5. **Traefik** - Ingress controller
6. **Auth** - Authentication service
7. **L2P Backend** - Depends on PostgreSQL, Auth
8. **L2P Frontend** - Depends on Backend
9. **Shop** - Depends on PostgreSQL, Auth
10. **VideoVault** - Depends on PostgreSQL, SMB

## Configuration

### Environment Variables

The secret generation script reads from `../.env` (root of monorepo). Required variables:

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
AUTH_DB_PASSWORD=<password>
L2P_DB_PASSWORD=<password>
SHOP_DB_PASSWORD=<password>
VIDEOVAULT_DB_PASSWORD=<password>

# Auth Service
AUTH_JWT_SECRET=<64-char-hex>
AUTH_JWT_REFRESH_SECRET=<64-char-hex>
AUTH_SESSION_SECRET=<64-char-hex>
AUTH_GOOGLE_CLIENT_ID=<oauth-client-id>
AUTH_GOOGLE_CLIENT_SECRET=<oauth-secret>

# L2P
L2P_JWT_SECRET=<64-char-hex>
L2P_JWT_REFRESH_SECRET=<64-char-hex>

# Shop
SHOP_NEXTAUTH_SECRET=<64-char-hex>
SHOP_AUTH_SECRET=<64-char-hex>
SHOP_AUTH_GOOGLE_ID=<oauth-client-id>
SHOP_AUTH_GOOGLE_SECRET=<oauth-secret>
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# VideoVault
VIDEO_SESSION_SECRET=<64-char-hex>
VIDEO_ADMIN_USER=admin
VIDEO_ADMIN_PASS=<password>

# SMTP (shared)
SMTP_USER=<email>
SMTP_PASS=<app-password>
SMTP_FROM=<email>

# Traefik
TRAEFIK_DASHBOARD_USER=admin
TRAEFIK_DASHBOARD_PASSWORD_HASH=<htpasswd-hash>

# SMB (VideoVault storage)
SMB_USER=<username>
SMB_PASSWORD=<password>

# IPv64 (DNS-01)
IPV64_API_KEY=<api-key>

```

Generate secrets with:
```bash
openssl rand -hex 32  # For JWT/session secrets
htpasswd -nb admin password  # For Traefik dashboard
```

### TLS Certificates

Option 1: Manual certificate:
```bash
kubectl create secret tls korczewski-tls \
  --cert=/etc/ssl/korczewski.de/fullchain.pem \
  --key=/etc/ssl/korczewski.de/privkey.pem \
  -n korczewski-infra
```

Option 2: Use cert-manager (recommended for production):
```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
# Then create ClusterIssuer and Certificate resources
```

### SMB Configuration

Update the SMB share and credentials before deploying VideoVault:
```yaml
# infrastructure/smb-csi/storageclass.yaml
parameters:
  source: "//10.10.0.3/SMB-Share"
```

Generate `smb-secret.yaml` with `SMB_USER` and `SMB_PASSWORD` in `.env`.

## Validation

After deployment, validate cluster health:

```bash
./scripts/utils/validate-cluster.sh
```

This checks:
- Node status
- Pod status
- Service health endpoints
- IngressRoutes
- PVC bindings

## Backup

Create PostgreSQL backups:

```bash
./scripts/utils/backup-postgres.sh ./backups
```

## Troubleshooting

### Pod not starting

```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Database connection issues

```bash
# Check PostgreSQL is ready
kubectl exec -it statefulset/postgres -n korczewski-infra -- pg_isready

# Check service DNS
kubectl run -it --rm debug --image=busybox -- nslookup postgres.korczewski-infra.svc.cluster.local
```

### Ingress not working

```bash
# Check Traefik logs
kubectl logs -l app=traefik -n korczewski-infra

# Verify IngressRoutes
kubectl get ingressroutes -A

# Check TLS secret
kubectl get secret korczewski-tls -n korczewski-infra
```

### Storage issues

```bash
# Check PVC status
kubectl get pvc -A

# Check SMB CSI logs
kubectl logs -l app=csi-smb-controller -n kube-system

```

## Architecture

```
                 ┌─────────────────┐
                 │    Internet     │
                 └────────┬────────┘
                          │
                 ┌────────▼────────┐
                 │     Traefik     │
                 │   (LoadBalancer)│
                 └────────┬────────┘
                          │
       ┌──────────┬───────┼───────┬──────────┐
       │          │       │       │          │
┌──────▼───┐ ┌───▼────┐ ┌▼────┐ ┌▼───────┐ ┌▼──────────┐
│   Auth   │ │  L2P   │ │ L2P │ │ Shop  │ │VideoVault │
│  :5500   │ │Backend │ │ FE  │ │ :3000  │ │  :5000    │
└──────┬───┘ │ :3001  │ │ :80 │ └───┬────┘ └─────┬─────┘
       │     └───┬────┘ └─────┘     │            │
       │         │                   │            │
       └─────────┼───────────────────┘            │
                 │                                │
        ┌────────▼───────┐                ┌───────▼──────┐
        │  PostgreSQL    │                │ SMB Storage  │
        │    :5432       │                │ (movies,     │
        │  (StatefulSet) │                │  audiobooks, │
        └────────────────┘                │  ebooks)     │
                                          └──────────────┘
```

## L2P Frontend Runtime Config

The L2P frontend image is environment-agnostic — URLs are injected at container startup, not at build time. The `docker-entrypoint.sh` script reads K8s deployment env vars (`VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_AUTH_SERVICE_URL`) and writes `/usr/share/nginx/html/env-config.js` before starting nginx. This means the same image works for both production (`l2p.korczewski.de`) and dev (`dev-l2p.korczewski.de`) environments.

## Services

| Service | Port | Health Endpoint | Domain |
|---------|------|-----------------|--------|
| Auth | 5500 | /health | auth.korczewski.de |
| L2P Backend | 3001 | /api/health | l2p.korczewski.de/api |
| L2P Frontend | 80 | / | l2p.korczewski.de |
| Shop | 3000 | / | shop.korczewski.de |
| VideoVault | 5000 | /api/health | videovault.korczewski.de, video.korczewski.de |
| PostgreSQL | 5432 | pg_isready | (internal) |
| Traefik Dashboard | 8080 | /ping | traefik.korczewski.de |

## License

Internal use only.
