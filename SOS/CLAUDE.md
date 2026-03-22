# SOS (Taschentherapeut) — CLAUDE.md

## Overview

German-language mental health companion app. A single-page HTML prototype wrapped in a lightweight Express server for static serving. No database, no authentication — the simplest service in the monorepo.

## Architecture

- **Frontend**: Vanilla HTML/CSS/JS (single file: `public/index.html`)
- **Backend**: Express static file server with health endpoints
- **Pattern**: `app.ts` (factory) + `server.ts` (entry point) for testability

### Screens (15 total)

SOS/Notfall, Kinder, Kursprogramm, Meditation, Kalender, Strategien, Gehirntraining, Bewegung, Fragebögen, Wissen, Vorlagen, Sperren, Zertifikate, Kontoeinstellungen, Quellen

## Commands

```bash
npm run dev           # Port 3005 (tsx watch)
npm run build         # TypeScript → dist/
npm run start         # Production (node dist/server.js)
npm run test          # Unit + integration tests
npm run test:unit     # Health endpoint tests
npm run test:integration  # Server integration tests
npm run test:e2e      # Playwright E2E
npm run typecheck     # tsc --noEmit
```

## Health Endpoints

- `GET /health` — Full status (uptime, memory, timestamp)
- `GET /health/ready` — Readiness probe
- `GET /health/live` — Liveness probe
- `GET /api/health` — Convenience endpoint

## Version Endpoint

- `GET /api/version` — Returns `{ service, version, sha, uptime, node }`
  - `sha` comes from `GIT_SHA` env var (set at Docker build time via `--build-arg`)
  - Falls back to `'dev'` in local development

## Deployment

- **Port**: 3005
- **URL**: https://sos.korczewski.de
- **Deploy**: `./k8s/scripts/deploy/deploy-sos.sh`
- **Resources**: 64Mi/128Mi (lowest in monorepo)
- **No secrets**: No envFrom, no database connection
