# Scripts

## Purpose
Root utilities for setup, service management, and maintenance.

## Quick Start
```bash
# From repo root
./scripts/setup.sh
```

## Notable scripts
- `scripts/setup.sh` - install dependencies and seed env files
- `scripts/start-all-services.sh` - start shared Postgres + services
- `scripts/stop-all-services.sh` - stop services in order
- `scripts/start-all-production.sh` - start production stack
- `scripts/stop-all.sh` - stop all production services
- `scripts/health-check.sh` - service health checks
- `scripts/restart_all_services.sh` - restart stacks and dashboard
- `scripts/db-viewer.sh` - inspect running DB containers and ports

## Ports
- None (scripts only)
