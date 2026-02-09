# Infrastructure

Core infrastructure components for the Korczewski Kubernetes cluster.

## Components

| Component | Namespace | Purpose |
|-----------|-----------|---------|
| PostgreSQL | `korczewski-infra` | Centralized database server |
| Traefik | `korczewski-infra` | Ingress controller with TLS |
| SMB-CSI | `kube-system` | SMB/CIFS storage class (VideoVault PVCs) |

## PostgreSQL (`postgres/`)

StatefulSet running PostgreSQL with persistent storage.

**Files:**
- `statefulset.yaml` - PostgreSQL StatefulSet with PVC
- `service.yaml` - ClusterIP service on port 5432
- `init-configmap.yaml` - Database initialization scripts
- `kustomization.yaml` - Kustomize configuration

**Databases:**
- `auth_db` - Auth service
- `l2p_db` - L2P service
- `shop_db` - Shop service
- `videovault_db` - VideoVault service

## Traefik (`traefik/`)

Traefik v3 ingress controller with dashboard and TLS support.

**Files:**
- `deployment.yaml` - Traefik deployment
- `service.yaml` - LoadBalancer service (80, 443) + ClusterIP dashboard (8080)
- `rbac.yaml` - Traefik ServiceAccount + permissions
- `middlewares.yaml` - Shared middleware (auth, headers, compression)
- `ingressroute-dashboard.yaml` - Dashboard ingress
- `tlsstore.yaml` - Default TLS store and options
- `kustomization.yaml` - Kustomize configuration

**Endpoints:**
- `:80` - HTTP (redirects to HTTPS)
- `:443` - HTTPS
- `:8080` - Dashboard (protected, internal service)

## SMB-CSI (`smb-csi/`)

CSI driver for SMB/CIFS storage access.

**Files:**
- `storageclass.yaml` - SMB StorageClass configuration
- `kustomization.yaml` - Kustomize configuration

**Notes:**
- VideoVault PVCs use the `smb-storage` StorageClass
- SMB credentials come from the `smbcreds` secret in `korczewski-infra`

## Deployment Order

1. Namespaces (from `base/`)
2. Secrets (from `secrets/`)
3. SMB-CSI
4. PostgreSQL
5. Traefik
6. Application services
