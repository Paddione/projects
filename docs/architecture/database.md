# Database Architecture

## Centralized PostgreSQL

A single PostgreSQL 15-alpine instance serves all services with isolated databases and users. Deployed as a k8s StatefulSet in `korczewski-infra` namespace with SMB-backed persistent storage.

| Database | User | Service | ORM |
|----------|------|---------|-----|
| `auth_db` | `auth_user` | Auth | Drizzle |
| `l2p_db` | `l2p_user` | L2P | Drizzle |
| `arena_db` | `arena_user` | Arena | Drizzle |
| `shop_db` | `shop_user` | Shop | **Prisma** |
| `videovault_db` | `videovault_user` | VideoVault | Drizzle |

Connection string format: `postgresql://<user>:<password>@shared-postgres:5432/<database>`

## Consolidated DB Setup

All database configuration, schemas, and operational scripts live in [`DB/`](../../DB/):

```
DB/
├── postgresql.conf              # PostgreSQL server config (300 connections, 512MB shared buffers)
├── pg_hba.conf                  # Client auth config (scram-sha-256, k8s/Docker networks)
├── init/                        # Complete "final state" schemas for fresh DB init
│   ├── 00-create-databases.sh   # Create 5 databases + 5 service users
│   ├── 01-auth-schema.sql       # auth_db: 17 tables, 5 functions, seed data
│   ├── 02-l2p-schema.sql        # l2p_db: 16 tables, 3 views, 40 perks, functions
│   ├── 03-arena-schema.sql      # arena_db: 5 tables, 1 view, migration tracking
│   ├── 04-shop-schema.sql       # shop_db: 11 tables, 3 enums (Prisma format)
│   ├── 05-videovault-schema.sql # videovault_db: 15 tables
│   └── 06-seed-admin.sh         # Paddione admin user in ALL databases
└── scripts/
    ├── db-watchdog.sh           # Health monitor + auto-reinit after 60min downtime
    ├── reinit-database.sh       # Full reinit (drop + recreate all DBs)
    └── ensure-secret.sh         # Create/verify k8s postgres-credentials secret
```

### Production Database (k3s)

The k3s production database is the **primary and only** database. Services connect via the `shared-postgres` alias service (routed through PgBouncer).

- **Pod**: `postgres-0` in `korczewski-infra`
- **Internal**: `postgres.korczewski-infra.svc:5432` (ClusterIP)
- **External**: `<any-node>:30432` (NodePort)
- **Storage**: 20Gi SMB PVC (`smb-storage` StorageClass)

### Auto-Recovery (Watchdog)

If the database is unavailable for more than **60 minutes**, the watchdog triggers automatic reinitialization:

```bash
# One-shot check (use in cron or monitoring)
DB/scripts/db-watchdog.sh

# Daemon mode (continuous monitoring)
DB/scripts/db-watchdog.sh --daemon

# Check current status
DB/scripts/db-watchdog.sh --status
```

The watchdog:
1. Checks PostgreSQL health and verifies all 5 databases exist
2. Tracks continuous downtime in `/tmp/db-watchdog-state`
3. After 60 minutes downtime: ensures k8s secret exists, then runs full reinit
4. After reinit: creates admin user `Paddione` (patrick@korczewski.de) with admin access to all services

### Manual Reinitialization

```bash
# Interactive (asks for confirmation)
DB/scripts/reinit-database.sh

# Force (no confirmation)
DB/scripts/reinit-database.sh --force

# Preview what would happen
DB/scripts/reinit-database.sh --dry-run
```

## ORM Strategy

**Drizzle ORM** is the default across all services except Shop. Each service manages its own schema and migrations independently.

**Prisma** is used only by Shop (Next.js ecosystem alignment). Key differences:
- Migrations: `npx prisma migrate dev` (not Drizzle CLI)
- Schema: `prisma/schema.prisma` (not TypeScript)
- Studio: `npx prisma studio` for DB GUI

## Migration Patterns

### Drizzle (L2P, Auth, Arena, VideoVault)

```bash
cd <service>
npm run db:migrate       # Apply pending migrations
npm run db:status        # Check migration state
npm run db:rollback      # Rollback last migration
```

L2P migration CLI: `backend/src/cli/database.ts`

### Prisma (Shop)

```bash
cd shop
npx prisma migrate dev      # Create + apply migration
npx prisma migrate deploy   # Apply in production
npx prisma db push          # Push schema without migration
```

## K8s Infrastructure

| Resource | File | Purpose |
|----------|------|---------|
| StatefulSet | `k8s/infrastructure/postgres/statefulset.yaml` | PostgreSQL 15-alpine, 1 replica |
| ConfigMap (config) | `k8s/infrastructure/postgres/configmap.yaml` | postgresql.conf + pg_hba.conf |
| ConfigMap (init) | `k8s/infrastructure/postgres/init-configmap.yaml` | DB/user creation script |
| Service | `k8s/infrastructure/postgres/service.yaml` | ClusterIP + NodePort:30432 |
| Alias Services | `k8s/infrastructure/postgres/alias-services.yaml` | `shared-postgres` ExternalName in service namespaces |
| Secret | `k8s/secrets/postgres-secret.yaml` | Credentials for all 5 DB users |

## Performance Tuning

PostgreSQL is configured in `DB/postgresql.conf` (canonical) / `k8s/infrastructure/postgres/configmap.yaml` (deployed):
- 300 max connections (3 reserved for superuser)
- 512 MB shared buffers, 1.5 GB effective cache
- WAL: 16MB buffers, 1-4GB size range
- Slow query logging (> 1 second)
- Connection/disconnection logging

## Security

- `scram-sha-256` authentication
- Service-specific users with limited privileges
- **Alphanumeric-only passwords** (avoid Docker/Postgres escaping issues)
- `no-new-privileges` container security option
- Init container fixes permissions (chown 999:999)

## Test Databases

Test databases are isolated from production:
- L2P tests: port **5433** (production on 5432)
- Test data must be prefixed with `test_`
- Never test against the production database

## Backup

```bash
# Full backup (k3s)
./k8s/scripts/utils/backup-postgres.sh ./backups

# Single database (k3s)
kubectl exec statefulset/postgres -n korczewski-infra -- pg_dump -U postgres auth_db > auth.sql

# Restore
kubectl exec -i statefulset/postgres -n korczewski-infra -- psql -U postgres < backup.sql
```

## VideoVault: Optional Persistence

VideoVault works without PostgreSQL. When `DATABASE_URL` is unset, it uses in-memory storage. Postgres enables shared library features.
