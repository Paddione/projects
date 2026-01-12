# Shared Infrastructure

This directory hosts the centralized PostgreSQL instance used by all services in the monorepo.

## Overview

A single PostgreSQL container (`shared-postgres`) provides isolated databases and users for each service:

- `auth_db` (user: `auth_user`)
- `l2p_db` (user: `l2p_user`)
- `payment_db` (user: `payment_user`)
- `videovault_db` (user: `videovault_user`)

### Benefits

- One backup/restore workflow
- Lower resource usage (one Postgres instance)
- Centralized monitoring
- Per-service isolation via separate databases and users

## Quick Start (Fresh Install)

```bash
cd shared-infrastructure
cp .env.example .env
# Edit .env with secure, alphanumeric-only passwords

docker-compose up -d
```

Start all services after Postgres is healthy:

```bash
cd ..
./scripts/start-all-services.sh
```

Stop all services:

```bash
./scripts/stop-all-services.sh
```

## Environment Configuration

### Source of Truth

`shared-infrastructure/.env` (or `.env-prod`) defines the database users and passwords for all services.

Example variables:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

AUTH_DB_USER=auth_user
AUTH_DB_PASSWORD=auth_password
L2P_DB_USER=l2p_user
L2P_DB_PASSWORD=l2p_password
PAYMENT_DB_USER=payment_user
PAYMENT_DB_PASSWORD=payment_password
VIDEOVAULT_DB_USER=videovault_user
VIDEOVAULT_DB_PASSWORD=videovault_password
```

### Service Connection Strings

Each service connects to its own database:

- Auth: `postgresql://auth_user:auth_password@shared-postgres:5432/auth_db`
- L2P: `postgresql://l2p_user:l2p_password@shared-postgres:5432/l2p_db`
- Payment: `postgresql://payment_user:payment_password@shared-postgres:5432/payment_db`
- VideoVault: `postgresql://videovault_user:videovault_password@shared-postgres:5432/videovault_db`

### Credentials Reference (Current Values)

These values mirror the current `.env` usage and should be updated if passwords rotate.

Auth (`auth/.env`):
```env
DATABASE_URL=postgresql://auth_user:2e4c28977e4e86afcaa485105ab0b53d@shared-postgres:5432/auth_db
AUTH_DB_USER=auth_user
AUTH_DB_PASSWORD=2e4c28977e4e86afcaa485105ab0b53d
```

L2P (`l2p/.env`, `l2p/.env.production`):
```env
DATABASE_URL=postgresql://l2p_user:23d13a56cfee5d0c5f9060fc62ab4a6d@shared-postgres:5432/l2p_db
L2P_DB_USER=l2p_user
L2P_DB_PASSWORD=23d13a56cfee5d0c5f9060fc62ab4a6d
DB_HOST=shared-postgres
DB_PORT=5432
DB_NAME=l2p_db
DB_USER=l2p_user
DB_PASSWORD=23d13a56cfee5d0c5f9060fc62ab4a6d
POSTGRES_USER=l2p_user
POSTGRES_PASSWORD=23d13a56cfee5d0c5f9060fc62ab4a6d
POSTGRES_DB=l2p_db
```

Payment (`payment/.env`):
```env
DATABASE_URL="postgresql://payment_user:2e67a4d8576773457fcaac19b3de8b1c@shared-postgres:5432/payment_db?schema=public"
PAYMENT_DB_USER=payment_user
PAYMENT_DB_PASSWORD=2e67a4d8576773457fcaac19b3de8b1c
```

VideoVault (`VideoVault/env/.env-postgres`):
```env
DATABASE_URL=postgresql://videovault_user:d5cd9488c0f39eef9d84903e3625b861@shared-postgres:5432/videovault_db
POSTGRES_USER=videovault_user
POSTGRES_PASSWORD=d5cd9488c0f39eef9d84903e3625b861
POSTGRES_DB=videovault_db
```

Postgres admin access:
```bash
docker exec -it shared-postgres psql -U postgres
# Password: value of POSTGRES_PASSWORD used at initial container setup
```

Security notes:
- Passwords are 256-bit (64 hex chars) generated via `openssl rand -hex 32`.
- `.env` files are never committed to git.
- This reference should be updated if credentials rotate.

## Migration Guide (From Legacy Postgres Containers)

### Step 1: Backup existing databases

```bash
# Auth
docker exec auth-postgres pg_dump -U postgres unified_auth_db > backup_auth.sql

# L2P
docker exec l2p-postgres pg_dump -U l2p_user learn2play > backup_l2p.sql

# Payment
docker exec payment_db_1 pg_dump -U patrick payment_db > backup_payment.sql

# VideoVault (if exists)
docker exec videovault-postgres pg_dump -U videovault videovault > backup_videovault.sql
```

### Step 2: Stop services

```bash
cd auth && docker-compose down
cd ../l2p && docker-compose --profile production down && docker-compose --profile development down
cd ../payment && docker-compose down
cd ../VideoVault && docker-compose down
```

### Step 3: Start centralized Postgres

```bash
cd ../shared-infrastructure
cp .env.example .env
nano .env  # set secure passwords

docker-compose up -d
```

### Step 4: Restore data

```bash
# Restore auth
 docker exec -i shared-postgres psql -U postgres auth_db < backup_auth.sql

# Restore l2p
 docker exec -i shared-postgres psql -U postgres l2p_db < backup_l2p.sql

# Restore payment
 docker exec -i shared-postgres psql -U postgres payment_db < backup_payment.sql

# Restore videovault
 docker exec -i shared-postgres psql -U postgres videovault_db < backup_videovault.sql
```

### Step 5: Update service env files

Ensure each service `.env` uses `shared-postgres:5432` with matching passwords from `shared-infrastructure/.env`.

### Step 6: Start services

```bash
cd auth && docker-compose up -d
cd ../l2p && docker-compose --profile production up -d  # or --profile development
cd ../payment && docker-compose up -d
cd ../VideoVault && docker-compose up -d
```

### Step 7: Verify

```bash
# Auth
 docker logs auth-service
# L2P
 docker logs l2p-api
# Payment
 docker logs payment_web_1
# VideoVault
 docker logs videovault-dev
```

### Optional cleanup

```bash
# WARNING: deletes old volumes
 docker volume rm auth_postgres_data
 docker volume rm l2p_postgres_data
 docker volume rm payment_db_data
 docker volume rm videovault_postgres_data
```

### Rollback plan

1. Stop all services and centralized Postgres
2. Restore original docker-compose files from git
3. Start legacy stacks and restore from backups if needed

## Management Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Logs
docker-compose logs -f postgres

# Backup all databases
docker-compose exec postgres pg_dumpall -U postgres > backup.sql

# Backup a single database
docker-compose exec postgres pg_dump -U postgres auth_db > auth_backup.sql

# Restore
docker-compose exec -T postgres psql -U postgres < backup.sql

# Access CLI
docker-compose exec postgres psql -U postgres

# Active connections
docker-compose exec postgres psql -U postgres -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"
```

## Networks

The database connects to:
- `traefik-public`
- `l2p-network`

Services must join one of these networks to connect.

## Performance

PostgreSQL is tuned for:
- 300 max connections
- 512MB shared buffers
- Slow query logging (> 1 second)
- Connection/disconnection logging

Adjust `postgresql.conf` based on your host resources.

## Security

- `scram-sha-256` authentication
- Service-specific users with limited privileges
- `no-new-privileges` container security option
- Passwords stored only in env files (not git)

## Test Databases

Test databases remain separate to avoid interference:
- L2P test: `postgres-test:5432/learn2play_test` (port 5433)

## Troubleshooting

### Services can't connect

```bash
# Check Postgres container
 docker ps | grep shared-postgres

# Logs
 cd shared-infrastructure
 docker-compose logs postgres

# Verify networks
 docker network ls
 docker network inspect traefik-public
 docker network inspect l2p-network
```

### Authentication errors

- Ensure service `.env` passwords match `shared-infrastructure/.env`
- Check users: `docker exec shared-postgres psql -U postgres -c "\\du"`

### Database missing

```bash
cd shared-infrastructure
docker-compose down -v
docker-compose up -d
```

## Backup and Recovery

```bash
# Backup all databases
 docker exec shared-postgres pg_dumpall -U postgres > full_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup single database
 docker exec shared-postgres pg_dump -U postgres auth_db > auth_backup_$(date +%Y%m%d_%H%M%S).sql
```
