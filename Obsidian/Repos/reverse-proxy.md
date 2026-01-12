# Reverse Proxy

## Purpose
Traefik routing, TLS termination, and service exposure.

## Stack
Traefik, Docker.

## Quick Start
```bash
cd reverse-proxy
./scripts/setup.sh
./scripts/start-all.sh
```

## Notes
- Handles HTTP/HTTPS (80/443).
- Runs alongside shared infrastructure and app stacks.

## Key Scripts
- `./scripts/setup.sh` - one-time setup (networks, directories)
- `./scripts/start-all.sh` - start Traefik + services
- `./scripts/stop-all.sh` - stop Traefik + services

## Ports
- HTTP: 80
- HTTPS: 443
