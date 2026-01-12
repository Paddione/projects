# Learn2Play (l2p)

## Purpose
Multiplayer quiz platform with real-time gameplay.

## Stack
React frontend, Express backend, Socket.io, PostgreSQL.

## Key folders
- `l2p/frontend/` - UI, hooks, Zustand stores
- `l2p/backend/` - API, services, repositories, Socket.io
- `l2p/shared/` - shared types and utilities

## Run locally
```bash
cd l2p
npm run dev:backend   # http://localhost:3001
npm run dev:frontend  # http://localhost:3000
```

## Build
```bash
cd l2p
npm run build:all
```

## Tests
```bash
cd l2p
npm run test:all
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Environment notes
- Requires `shared-infrastructure` Postgres first.
- Uses separate test DB on port 5433 for integration tests.

## Ports
- Frontend: 3000
- Backend: 3001
