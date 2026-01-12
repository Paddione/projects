# VideoVault

## Purpose
Client-first video management app optimized for local media libraries.

## Stack
React, Vite, File System Access API, optional Postgres.

## Key folders
- `VideoVault/client/` - UI, services, hooks
- `VideoVault/server/` - Express + Vite middleware
- `VideoVault/e2e/` - Playwright tests

## Run locally
```bash
cd VideoVault
npm run dev        # http://localhost:5100
```

## Docker dev
```bash
cd VideoVault
npm run docker:dev # http://localhost:5000
```

## Build
```bash
cd VideoVault
npm run build
```

## Tests
```bash
cd VideoVault
npm test
npm run docker:pw:all
```

## Notes
- Requires Chromium-based browsers for File System Access API.
- File handles are session-based; expect to rescan after reload.

## Ports
- Dev: 5100
- Docker dev: 5000
