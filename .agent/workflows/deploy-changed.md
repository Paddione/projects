---
description: Deploy only changed k3d services
---

This workflow deploys only the k3d services that have uncommitted changes, leaving everything else running as is.

## Quick Start

```bash
# From project root
./scripts/deploy-changed.sh
```

Or from the k8s directory:

```bash
# From k8s directory
./scripts/deploy/deploy-changed.sh
```

## How It Works

The script:
1. Detects which service directories have uncommitted changes using `git status`
2. Maps changed directories to Skaffold profiles (auth, l2p, payment, videovault, dashboard)
3. Rebuilds only the changed services using `skaffold run -p <profile>`
4. Waits for pods to be ready
5. Shows deployment summary

## Options

### Dry Run
See what would be deployed without making changes:

```bash
./scripts/deploy-changed.sh --dry-run
```

### Include Staged Changes
By default, only unstaged changes are detected. To include staged changes:

```bash
./scripts/deploy-changed.sh --include-staged
```

### Help
```bash
./scripts/deploy-changed.sh --help
```

## Service Mappings

| Directory | Service | Skaffold Profile |
|-----------|---------|------------------|
| `auth/` | Auth Service | `auth` |
| `l2p/` | L2P Backend + Frontend | `l2p` |
| `payment/` | Payment Service | `payment` |
| `VideoVault/` | VideoVault | `videovault` |
| `dashboard/` | Dashboard | `dashboard` |

## Examples

### Deploy L2P changes only
If you've modified files in `l2p/frontend/` or `l2p/backend/`:

```bash
./scripts/deploy-changed.sh
```

This will:
- Detect changes in the `l2p/` directory
- Run `skaffold run -p l2p`
- Rebuild and redeploy both l2p-backend and l2p-frontend
- Leave auth, payment, videovault, and dashboard untouched

### Check what would be deployed
```bash
./scripts/deploy-changed.sh --dry-run
```

Output shows:
- Which files have changed
- Which services will be deployed
- No actual deployment happens

## Comparison with Other Scripts

| Script | Use Case |
|--------|----------|
| `deploy-changed.sh` | **Deploy only services with changes** |
| `deploy-all.sh` | Full deployment (infrastructure + all services) |
| `deploy-l2p.sh` | Deploy L2P only (manual) |
| `deploy-auth.sh` | Deploy Auth only (manual) |

## Troubleshooting

### No changes detected
If you expect changes but none are detected:

```bash
# Check git status
git status

# Include staged changes
./scripts/deploy-changed.sh --include-staged
```

### Service fails to deploy
The script will:
- Continue deploying other services
- Report failed services at the end
- Exit with code 1 if any failures

Check logs:
```bash
kubectl logs -n korczewski-services -l app=<service-name> --tail=50
```

### Skaffold not found
Ensure Skaffold is installed:
```bash
skaffold version
```

## Advanced Usage

### Deploy specific service manually
If you want to deploy a specific service regardless of changes:

```bash
cd k8s
skaffold run -p l2p        # L2P only
skaffold run -p auth       # Auth only
skaffold run -p videovault # VideoVault only
```

### Deploy multiple specific services
```bash
cd k8s
skaffold run -p auth -p l2p
```

## Integration with Git Workflow

Typical workflow:
1. Make changes to service code
2. Test locally if needed
3. Run `./scripts/deploy-changed.sh --dry-run` to preview
4. Run `./scripts/deploy-changed.sh` to deploy
5. Verify deployment
6. Commit changes: `git add . && git commit -m "..."`
7. Push: `git push`

## Notes

- The script uses `git status` to detect changes, so it works with both tracked and untracked files
- Infrastructure services (postgres, traefik, smb-csi) are not included in auto-detection
- For infrastructure changes, use `./scripts/deploy/deploy-all.sh --skip-secrets`
