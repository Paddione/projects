# k3d Dev Overlay

These manifests are applied in a local k3d development cluster to redirect SMB
storage from the production NAS (`10.0.0.11`) to the local Windows share
(`//10.10.0.3/storage-desktop`).

## Files

| File | Purpose |
|------|---------|
| `videovault-dev-pvs.yaml` | Static PVs for VideoVault media libraries (movies, audiobooks, ebooks, hdd-ext) |
| `smb-dev-storageclass.yaml` | `smb-storage` StorageClass override for dynamically-provisioned PVCs (videovault-media, videovault-thumbnails) |

## Source mapping

| PV / usage | Production source | Dev source |
|-----------|-------------------|------------|
| `videovault-movies-pv` | `//10.0.0.11/SDD-Share/movies` | `//10.10.0.3/storage-desktop/movies` |
| `videovault-audiobooks-pv` | `//10.0.0.11/storage-pve3b/audiobooks` | `//10.10.0.3/storage-desktop/audiobooks` |
| `videovault-ebooks-pv` | `//10.0.0.11/storage-pve3b/ebooks` | `//10.10.0.3/storage-desktop/ebooks` |
| `videovault-hdd-ext-pv` | `//10.0.0.11/SDD-Share` | `//10.10.0.3/storage-desktop` |
| `smb-storage` StorageClass | `//10.0.0.11/storage-pve3b` | `//10.10.0.3/storage-desktop` |

## Prerequisites

Before applying, ensure the `smbcreds` secret exists in the `korczewski-infra`
namespace. If you have not already generated it:

1. Fill in `SMB_USER` and `SMB_PASSWORD` in your `.env` file.
2. Re-run the secrets generator:
   ```bash
   ./k8s/scripts/generate-secrets.sh
   ```

## Apply

```bash
kubectl apply -f k8s/overlays/k3d/
```

Do **not** apply these manifests against the production cluster — use the
files under `k8s/services/videovault/` and `k8s/infrastructure/smb-csi/`
for production.
