# Shared Infrastructure

## Purpose
Centralized PostgreSQL instance with isolated databases per service.

## Stack
PostgreSQL, Docker.

## Run locally
```bash
cd shared-infrastructure
docker-compose up -d
```

## Stop
```bash
cd shared-infrastructure
docker-compose down
```

## Notes
- Start this before app services.
- Each service has its own DB/user.

## Ports
- Postgres: 5432
