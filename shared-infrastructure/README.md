# Shared Infrastructure

Centralized PostgreSQL instance and shared assets for all services in the monorepo.

## Overview

A single PostgreSQL container (`shared-postgres`) provides isolated databases and users:

| Database | User |
|----------|------|
| `auth_db` | `auth_user` |
| `l2p_db` | `l2p_user` |
| `payment_db` | `payment_user` |
| `videovault_db` | `videovault_user` |

## Shared Assets

Packages and assets under `shared-infrastructure/shared/`:

- `shared/design-system/` - Global CSS design system and accessibility references
- `shared/postgres-mcp/` - MCP server for shared Postgres access
- `shared/l2p/` - L2P shared tooling (test-config, error-handling, test-utils)
- `shared/videovault/` - VideoVault shared schemas, types, and errors
- `shared/videovault-design-system/` - Legacy VideoVault-specific CSS bundle

See `shared-infrastructure/shared/README.md` for usage details.

## SMB Share (VideoVault Storage)

`shared-infrastructure/SMB-Share` is a symlink to `/home/patrick/SMB-Share`, the host SMB share used by VideoVault storage. Referenced by the SMB-CSI storage class (`k8s/infrastructure/smb-csi/storageclass.yaml`). Ensure the share is mounted before deploying VideoVault.

## Quick Start

```bash
cd shared-infrastructure
cp .env.example .env
# Edit .env with secure, alphanumeric-only passwords
docker-compose up -d
```

For k8s deployments, use `k8s/infrastructure/postgres/` manifests and `k8s/scripts/deploy/deploy-postgres.sh`.

## Environment Configuration

`shared-infrastructure/.env` (or `.env-prod`) is the source of truth for all database credentials.

Required variables:
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure_password>
AUTH_DB_USER=auth_user
AUTH_DB_PASSWORD=<secure_password>
L2P_DB_USER=l2p_user
L2P_DB_PASSWORD=<secure_password>
PAYMENT_DB_USER=payment_user
PAYMENT_DB_PASSWORD=<secure_password>
VIDEOVAULT_DB_USER=videovault_user
VIDEOVAULT_DB_PASSWORD=<secure_password>
```

Service connection string format:
```
postgresql://<user>:<password>@shared-postgres:5432/<database>
```

Passwords are 256-bit (64 hex chars) generated via `openssl rand -hex 32`. Never commit `.env` files.

## Management Commands

```bash
docker-compose up -d                                              # Start
docker-compose down                                               # Stop
docker-compose logs -f postgres                                   # Logs
docker-compose exec postgres pg_dumpall -U postgres > backup.sql  # Backup all
docker-compose exec postgres pg_dump -U postgres auth_db > auth.sql  # Backup one
docker-compose exec -T postgres psql -U postgres < backup.sql     # Restore
docker-compose exec postgres psql -U postgres                     # CLI access
```

## Networks

The database connects to:
- `traefik-public` - External routing
- `l2p-network` - Internal service network

Services must join one of these networks to connect.

## Performance

PostgreSQL is tuned for:
- 300 max connections
- 512 MB shared buffers
- Slow query logging (> 1 second)
- Connection/disconnection logging

Adjust `postgresql.conf` based on host resources.

## Security

- `scram-sha-256` authentication
- Service-specific users with limited privileges
- `no-new-privileges` container security option
- Passwords stored only in env files (never committed)

## Test Databases

Test databases remain separate to avoid interference:
- L2P test: `postgres-test:5432/learn2play_test` (port 5433)

## Troubleshooting

**Services can't connect:**
```bash
docker ps | grep shared-postgres
cd shared-infrastructure && docker-compose logs postgres
docker network inspect traefik-public
```

**Authentication errors:**
- Ensure service `.env` passwords match `shared-infrastructure/.env`
- Check users: `docker exec shared-postgres psql -U postgres -c "\du"`

**Database missing:**
```bash
cd shared-infrastructure
docker-compose down -v
docker-compose up -d
```
