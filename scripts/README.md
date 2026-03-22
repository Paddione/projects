# Root Scripts

Scripts in `scripts/` handle repo-level workflows. Some are interactive and require Docker, Node.js, or Python 3.

## Quick Usage

```bash
./k8s/scripts/cluster/k3d-create.sh
./k8s/scripts/utils/generate-secrets.sh
./k8s/scripts/deploy/deploy-all.sh
```

## Script Reference

| Script | Purpose | Notes |
| --- | --- | --- |
| `cleanup-all-test-data.sh` | Clean up test data across all services. | Use via `npm run test:cleanup`. |
| `db-viewer.sh` | Inspect or stop local Postgres containers and ports. | Usage: `./scripts/db-viewer.sh status|stop|nuke`. `nuke` prunes anonymous volumes/networks. |
| `deploy-changed.sh` | Deploy only changed services (wrapper). | See also `k8s/scripts/deploy/deploy-changed.sh`. |
| `generate-env.sh` | Generate `.env` files from templates. | Interactive setup helper. |
| `health-check.sh` | Production health checks for services and ingress. | Uses `kubectl` + `curl`. Targets public URLs. |
| `ipv64_update.py` | Update IPv64 DynDNS when IP changes. | Reads `IPV64_API_KEY` from `.env`, caches IP in `scripts/.ipv64_ip_cache`. Requires Python 3 + `requests`. |
| `openclaw-tunnel.sh` | SSH tunnel to OpenClaw gateway + browser relay. | Tunnels to 10.10.0.4:18789/18792. |
| `setup.sh` | Install dependencies and seed `.env` files. | Interactive; requires Node.js and npm. |
| `test-e2e-all.sh` | Run E2E test suites across all services. | Requires running services or Docker test stack. |
| `typecheck-all.sh` | Run typechecks across services. | Uses each service's npm scripts. |
| `validate-env.js` | Validate `.env` files for required variables. | Use via `npm run validate:env(:dev|:prod)`. |
| `wsl-cleanup.sh` | Clean up WSL-specific caches and temp files. | Frees disk space in WSL environments. |

## Notes

- Kubernetes scripts expect `kubectl` configured for the target cluster.
- Use `npm run validate:env` after editing env files.
