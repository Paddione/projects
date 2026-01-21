# Root Scripts

Scripts in `scripts/` handle repo-level workflows. Some are interactive and require Docker, Node.js, or Python 3.

## Quick Usage

```bash
./scripts/start-all-production.sh
./scripts/health-check.sh
./scripts/stop-all.sh
```

## Script Reference

| Script | Purpose | Notes |
| --- | --- | --- |
| `db-viewer.sh` | Inspect or stop local Postgres containers and ports. | Usage: `./scripts/db-viewer.sh status|stop|nuke`. `nuke` prunes anonymous volumes/networks. |
| `generate_silent_audio.py` | Generate silent MP3 placeholders for L2P audio assets. | Writes to `l2p/frontend/public/audio`. Requires Python 3. |
| `health-check.sh` | Production health checks for services and containers. | Uses `curl` + `docker`. Targets public URLs. |
| `ipv64_update.py` | Update IPv64 DynDNS when IP changes. | Reads `IPV64_API_KEY` from `.env`, caches IP in `scripts/.ipv64_ip_cache`. Requires Python 3 + `requests`. |
| `restart-outdated.sh` | Rebuild and restart services with changed Docker images. | Uses `docker compose up -d --build`. |
| `restart_all_services.sh` | Restart running containers and local Node processes. | Restarts auth/L2P/VideoVault/dashboard if running. Skips services not up. |
| `setup.sh` | Install dependencies and seed `.env` files. | Interactive; requires Node.js and npm. |
| `start-all-production.sh` | Start all production Docker services in order. | Starts Traefik, shared Postgres, auth, dashboard, L2P, payment, VideoVault. |
| `start-all-services.sh` | Start services with centralized Postgres (interactive L2P profile). | Requires root `.env` and Docker. |
| `stop-all-services.sh` | Stop all services (prompts before stopping Postgres). | Uses `docker-compose` per service. |
| `stop-all.sh` | Stop production + dev services; optionally stop infra. | Also stops Traefik + shared Postgres if confirmed. |
| `typecheck-all.sh` | Run typechecks across services. | Uses each service's npm scripts. |
| `validate-env.js` | Validate `.env` files for required variables. | Use via `npm run validate:env(:dev|:prod)`. |

## Notes

- Docker scripts expect `docker compose` / `docker-compose` available on PATH.
- Use `npm run validate:env` after editing env files.
