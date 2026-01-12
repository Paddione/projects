# Operations

Common day-to-day commands for running the stack.

## Start/stop all services
```bash
./scripts/start-all-services.sh
./scripts/stop-all-services.sh
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

## Shared infrastructure first
Start `shared-infrastructure` before other services.
