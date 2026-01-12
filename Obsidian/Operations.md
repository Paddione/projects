# Operations

Common day-to-day commands for running the stack.

## Prerequisites
- Node.js LTS + npm installed
- Docker Engine or Docker Desktop running
- `.env-dev` files created from `.env.example` in each repo you run

## Start/stop all services
```bash
./scripts/start-all-services.sh
./scripts/stop-all-services.sh
```

## Restart all services
```bash
./scripts/restart_all_services.sh
```

## Production helpers
```bash
./scripts/start-all-production.sh
./scripts/stop-all.sh
./scripts/health-check.sh
```

## Install/build/test all
```bash
npm run install:all
npm run build:all
npm run dev:all
npm run test:all
```

## Common local workflow
1. Start shared infrastructure.
2. Start `auth`.
3. Start the service you are working on.
4. Run the repo-specific tests as you change code.

## Logs and status
```bash
# Shared infrastructure logs
cd shared-infrastructure
docker-compose logs -f shared-postgres

# Check container status
docker-compose ps
```

## Shared infrastructure first
Start `shared-infrastructure` before other services.
