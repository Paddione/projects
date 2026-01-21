# Korczewski Kubernetes Infrastructure

Kubernetes deployment manifests and scripts for the Korczewski monorepo services.

## Overview

This directory contains everything needed to deploy the full Korczewski stack to a k3s Kubernetes cluster:

- **PostgreSQL** - Centralized database with isolated databases per service
- **Traefik** - Ingress controller with TLS and middleware
- **Dashboard** - Cluster control center (HTTP + WebSocket)
- **Auth Service** - JWT authentication and OAuth
- **L2P** - Multiplayer quiz platform (frontend + backend)
- **Payment** - Next.js payment platform with Stripe
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
echo '127.0.0.1 l2p.korczewski.de auth.korczewski.de payment.korczewski.de shop.korczewski.de videovault.korczewski.de video.korczewski.de dashboard.korczewski.de traefik.korczewski.de' | sudo tee -a /etc/hosts
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

# Optional: Setup NFS on master:
sudo ./scripts/storage/setup-nfs-server.sh

# Optional: On workers:
sudo ./scripts/storage/setup-nfs-client.sh <MASTER_IP>

# Optional: Update NFS provisioner config:
# Edit infrastructure/nfs-provisioner/deployment.yaml
# Replace REPLACE_WITH_NFS_SERVER_IP with actual IP

# Deploy:
./scripts/deploy/deploy-all.sh
```

## Directory Structure

```
k8s/
├── scripts/              # Deployment and cluster scripts (see scripts/README.md)
│   ├── cluster/          # Cluster creation and join scripts
│   ├── storage/          # NFS setup scripts
│   ├── deploy/           # Per-service deployment scripts
│   └── utils/            # Secret generation, validation, backup
├── base/                 # Base resources (namespaces)
├── infrastructure/       # Infrastructure components (see infrastructure/README.md)
│   ├── postgres/         # PostgreSQL StatefulSet
│   ├── traefik/          # Traefik deployment + middlewares
│   ├── nfs-provisioner/  # NFS dynamic provisioning
│   └── smb-csi/          # SMB/CIFS storage class
├── services/             # Application services (see services/README.md)
│   ├── auth/             # Auth service manifests
│   ├── dashboard/        # Kubernetes dashboard
│   ├── l2p-backend/      # L2P backend manifests
│   ├── l2p-frontend/     # L2P frontend manifests
│   ├── payment/          # Payment service manifests
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
skaffold dev --profile=payment
skaffold dev --profile=videovault
skaffold dev --profile=infra

# Build and deploy once
skaffold run

# Production build with push
skaffold run --profile=prod
```

Note: The dashboard is not part of the Skaffold profiles. Apply it manually:
```bash
kubectl apply -k services/dashboard
```

### Manual Deployment

```bash
# Deploy individual services
./scripts/deploy/deploy-postgres.sh
kubectl apply -k infrastructure/smb-csi
./scripts/deploy/deploy-traefik.sh
./scripts/deploy/deploy-auth.sh
./scripts/deploy/deploy-l2p.sh
./scripts/deploy/deploy-payment.sh
kubectl apply -k services/dashboard
./scripts/deploy/deploy-videovault.sh
```

## Deployment Order

Services must be deployed in this order due to dependencies:

1. **Namespaces** - `korczewski-infra`, `korczewski-services`
2. **Secrets** - Generate from root `.env`
3. **SMB-CSI** - Required for VideoVault storage
4. **NFS Provisioner** - Optional shared storage
5. **PostgreSQL** - Database must be ready first
6. **Traefik** - Ingress controller
7. **Auth** - Authentication service
8. **L2P Backend** - Depends on PostgreSQL, Auth
9. **L2P Frontend** - Depends on Backend
10. **Payment** - Depends on PostgreSQL, Auth
11. **Dashboard** - Depends on Auth, Traefik
12. **VideoVault** - Depends on PostgreSQL, SMB

## Configuration

### Environment Variables

The secret generation script reads from `../.env` (root of monorepo). Required variables:

```env
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
AUTH_DB_PASSWORD=<password>
L2P_DB_PASSWORD=<password>
PAYMENT_DB_PASSWORD=<password>
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

# Payment
PAYMENT_NEXTAUTH_SECRET=<64-char-hex>
PAYMENT_AUTH_SECRET=<64-char-hex>
PAYMENT_AUTH_GOOGLE_ID=<oauth-client-id>
PAYMENT_AUTH_GOOGLE_SECRET=<oauth-secret>
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

### NFS Configuration

Before deploying NFS provisioner, update the ConfigMap:
```yaml
# infrastructure/nfs-provisioner/deployment.yaml
data:
  nfs_server: "192.168.1.100"  # Your NFS server IP
  nfs_path: "/srv/nfs/k8s-data"
```

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

# Check NFS provisioner (if enabled)
kubectl logs -l app=nfs-subdir-external-provisioner -n kube-system
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
       ┌──────────────────┼──────────────────┐
       │                  │                  │
┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
│    Auth     │   │     L2P     │   │  Payment    │
│  :5500      │   │ FE:80 BE:3001│   │   :3000     │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └───────┬─────────┼─────────┬───────┘
               │         │         │
        ┌──────▼──────┐   │   ┌────▼───────┐
        │ VideoVault  │   │   │ Dashboard  │
        │   :5000     │   │   │   :4242    │
        └──────┬──────┘   │   └────────────┘
               │          │
               └──────────┼──────────┐
                          │          │
                 ┌────────▼───────┐  │
                 │  PostgreSQL    │  │
                 │    :5432       │  │
                 │  (StatefulSet) │  │
                 └────────┬───────┘  │
                          │          │
                 ┌────────▼───────┐  │
                 │   SMB Storage  │  │
                 └────────────────┘  │
```

## Services

| Service | Port | Health Endpoint | Domain |
|---------|------|-----------------|--------|
| Auth | 5500 | /health | auth.korczewski.de |
| Dashboard | 4242 | /health | dashboard.korczewski.de |
| L2P Backend | 3001 | /api/health | l2p.korczewski.de/api |
| L2P Frontend | 80 | / | l2p.korczewski.de |
| Payment | 3000 | / | payment.korczewski.de, shop.korczewski.de |
| VideoVault | 5000 | /api/health | videovault.korczewski.de, video.korczewski.de |
| PostgreSQL | 5432 | pg_isready | (internal) |
| Traefik Dashboard | 8080 | /ping | traefik.korczewski.de |

## License

Internal use only.
