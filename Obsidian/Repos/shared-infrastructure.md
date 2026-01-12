# Shared Infrastructure

## Purpose
Provides centralized services used across the monorepo, primarily the shared PostgreSQL instance. This avoids container sprawl and simplifies database management.

## Components
- **PostgreSQL 15**: Central database engine.
- **pg_hba.conf**: Custom host-based authentication for security.
- **init-databases.sql**: Auto-creates service-specific databases and users on first start.

## Quick Start
```bash
cd shared-infrastructure
docker-compose up -d
```

## Database Isolation
The shared instance hosts multiple isolated databases:

| Database | Owner | Purpose |
|----------|-------|---------|
| `auth_db` | `auth_user` | User credentials and sessions |
| `l2p_db` | `l2p_user` | Learn2Play game state |
| `payment_db` | `payment_user` | Stripe transactions and subscriptions |
| `videovault_db`| `videovault_user`| Video metadata and library settings |

## Port Mappings
- **Postgres**: `5432:5432`

## Key Files
- `docker-compose.yml` - Defines the `shared-postgres` service.
- `init-databases.sql` - Script to bootstrap the databases.
- `postgresql.conf` - Database performance tuning.

## Management
### View Logs
```bash
docker-compose logs -f
```

### Access Database
```bash
docker-compose exec shared-postgres psql -U postgres
```

### Backup All Databases
```bash
docker-compose exec shared-postgres pg_dumpall -U postgres > full_backup.sql
```

## Links
- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Detailed database design
- [[Deployment Architecture]] - Deployment guide
- [[Repository Index]] - Back to index
