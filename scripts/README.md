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
| `db-viewer.sh` | Inspect or stop local Postgres containers and ports. | Usage: `./scripts/db-viewer.sh status|stop|nuke`. `nuke` prunes anonymous volumes/networks. |
| `generate_silent_audio.py` | Generate silent MP3 placeholders for L2P audio assets. | Writes to `l2p/frontend/public/audio`. Requires Python 3. |
| `health-check.sh` | Production health checks for services and ingress. | Uses `kubectl` + `curl`. Targets public URLs. |
| `ipv64_update.py` | Update IPv64 DynDNS when IP changes. | Reads `IPV64_API_KEY` from `.env`, caches IP in `scripts/.ipv64_ip_cache`. Requires Python 3 + `requests`. |
| `setup.sh` | Install dependencies and seed `.env` files. | Interactive; requires Node.js and npm. |
| `typecheck-all.sh` | Run typechecks across services. | Uses each service's npm scripts. |
| `validate-env.js` | Validate `.env` files for required variables. | Use via `npm run validate:env(:dev|:prod)`. |

## Notes

- Kubernetes scripts expect `kubectl` configured for the target cluster.
- Use `npm run validate:env` after editing env files.
