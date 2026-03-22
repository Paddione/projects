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
| `bootstrap-cluster.sh` | Full cluster bootstrap (SSH as patrick with sudo) |
| `k3d-create.sh` | Create local k3d development cluster |
| `k3s-init-master.sh` | Initialize k3s master node (production) |
| `k3s-join-server.sh` | Join additional control plane node |
| `k3s-join-worker.sh` | Join worker node to cluster |
| `k3s-get-token.sh` | Retrieve cluster join token |
| `node-prerequisites.sh` | Install required packages on cluster nodes |
| `setup-registry.sh` | Set up private Docker registry |

## Deployment Scripts (`deploy/`)

| Script | Description |
|--------|-------------|
| `deploy-all.sh` | Full stack deployment in correct order |
| `deploy-changed.sh` | Auto-detect and deploy only changed services |
| `deploy-postgres.sh` | Deploy PostgreSQL StatefulSet |
| `deploy-traefik.sh` | Deploy Traefik ingress controller |
| `deploy-kube-vip.sh` | Deploy kube-vip (API VIP + Service LB) |
| `deploy-pgbouncer.sh` | Deploy PgBouncer connection pooler |
| `deploy-registry.sh` | Deploy private Docker registry |
| `deploy-smb-csi.sh` | Deploy SMB-CSI storage driver |
| `deploy-keda.sh` | Deploy KEDA (event-driven autoscaling) |
| `deploy-auth.sh` | Deploy Auth service |
| `deploy-l2p.sh` | Deploy L2P backend + frontend |
| `deploy-arena.sh` | Deploy Arena backend + frontend |
| `deploy-shop.sh` | Deploy Shop service |
| `deploy-videovault.sh` | Deploy VideoVault service |
| `deploy-sos.sh` | Deploy SOS (Taschentherapeut) service |
| `deploy-assetgenerator.sh` | Deploy Assetgenerator + GPU worker |

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
| `deploy-tracker.sh` | ConfigMap-based SHA deploy tracking |
| `detect-registry.sh` | Detect and configure Docker registry |
| `service-registry.sh` | Service registry management |
| `set-assetgen-keys.sh` | Set Assetgenerator API keys |
| `sync-dr-secrets.sh` | Sync disaster recovery secrets |
| `migrate-smb-storage.sh` | Migrate SMB storage configuration |
| `vault-sync.sh` | Sync .env secrets to HashiCorp Vault |
| `create_users.sql` | SQL script for database user creation |
