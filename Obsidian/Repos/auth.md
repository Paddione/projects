# Auth

## Purpose
Unified authentication service (JWT + OAuth) for other apps in the monorepo.

## Stack
Node, JWT, OAuth, PostgreSQL.

## Key folders
See `auth/README.md` for service-specific details.

## Run locally (Docker)
```bash
cd auth
docker-compose --env-file .env-dev up -d
```

## Stop
```bash
cd auth
docker-compose down
```

## Ports
- Service: 5500
