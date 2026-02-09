# Scripts

Deployment and cluster management scripts for the Korczewski Kubernetes infrastructure.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `cluster/` | Cluster creation and node joining |
| `deploy/` | Service deployment scripts |
| `utils/` | Secrets, backup, validation utilities |

## Cluster Scripts (`cluster/`)

| Script | Description |
|--------|-------------|
| `k3d-create.sh` | Create local k3d development cluster |
| `k3s-init-master.sh` | Initialize k3s master node (production) |
| `k3s-join-server.sh` | Join additional control plane node |
| `k3s-join-worker.sh` | Join worker node to cluster |
| `k3s-get-token.sh` | Retrieve cluster join token |

## Deployment Scripts (`deploy/`)

| Script | Description |
|--------|-------------|
| `deploy-all.sh` | Full stack deployment in correct order |
| `deploy-postgres.sh` | Deploy PostgreSQL StatefulSet |
| `deploy-traefik.sh` | Deploy Traefik ingress controller |
| `deploy-auth.sh` | Deploy Auth service |
| `deploy-l2p.sh` | Deploy L2P backend + frontend |
| `deploy-shop.sh` | Deploy Shop service |
| `deploy-videovault.sh` | Deploy VideoVault service |

Note: SMB-CSI is deployed via `kubectl apply -k k8s/infrastructure/smb-csi` (no dedicated script).

### deploy-all.sh Options

```bash
./deploy-all.sh                  # Full deployment
./deploy-all.sh --skip-secrets   # Skip secret generation
./deploy-all.sh --skip-infra     # Skip infrastructure (postgres, traefik)
```

## Utility Scripts (`utils/`)

| Script | Description |
|--------|-------------|
| `generate-secrets.sh` | Generate K8s secrets from root `.env` |
| `validate-cluster.sh` | Validate cluster health and services |
| `backup-postgres.sh` | Backup PostgreSQL databases |
| `create_users.sql` | SQL script for database user creation |
