# CLAUDE.md

Guidance for Claude Code when working in the Arena project.

## Overview

Arena is a top-down battle royale multiplayer game: React 18 + PixiJS + Vite frontend, Express + Socket.io backend, PostgreSQL via Drizzle ORM. Workspace monorepo with `frontend/` and `backend/` packages.

## Commands

```bash
npm run dev:frontend             # Frontend on port 3002
npm run dev:backend              # Backend on port 3003
npm run build:all                # Build frontend + backend
npm run db:migrate               # Run database migrations
npm run typecheck                # Typecheck both packages
```

## Architecture

### Three-Layer Backend

1. **Routes** (`routes/`): HTTP/WebSocket endpoints only
2. **Services** (`services/`): All business logic
3. **Repositories** (planned): Database access

### Key Services

| Service | Responsibility |
|---------|----------------|
| LobbyService | Lobby CRUD, join/leave/ready/start flow |
| GameService | Game loop, match orchestration, round management |
| PlayerService | HP/armor model, damage, item collection |
| SocketService | WebSocket events, real-time game state sync |
| DatabaseService | PostgreSQL connection pool singleton |

### Socket.io Events

**Client → Server:** `join-lobby`, `leave-lobby`, `player-ready`, `start-game`, `player-input`, `pickup-item`, `spectate-player`, `update-settings`

**Server → Client:** `game-state`, `lobby-updated`, `player-hit`, `player-killed`, `item-spawned`, `round-start`, `round-end`, `match-end`, `zone-shrink`

### Game Mechanics

- **HP**: 2 base, armor adds +1 shield
- **Gun**: 1 damage per hit (2 shots = kill)
- **Melee**: Instant kill (even through armor)
- **Items**: Health + Armor spawn every 60s (configurable)
- **Rounds**: Best of 1, 3, or 5
- **Zone**: Optional shrinking zone

### Database

- Production: `shared-postgres:5432/arena_db`
- Tables: `players`, `lobbies`, `matches`, `match_results`
- Views: `arena_leaderboard`

## Ports

| Service | Port |
|---------|------|
| Frontend | 3002 |
| Backend | 3003 |

### Asset Pipeline

Procedural `Graphics` rendering is replaced by sprite-based `Sprite`/`AnimatedSprite` with automatic fallback when assets aren't loaded.

**Pipeline scripts** (in `scripts/`):
```bash
./scripts/generate_all.sh               # Run full pipeline (all phases)
./scripts/generate_all.sh --phase 1     # Concept art only (ComfyUI/SDXL)
./scripts/generate_all.sh --phase 4     # Sprite packing only
./scripts/generate_all.sh --phase audio # Audio only (AudioCraft/ElevenLabs)
```

**Pipeline phases**: concepts → 3D models → Blender render → sprite pack → audio gen → audio process

**Asset manifest**: `assets/manifest.json` — defines all characters, items, tiles, SFX, music with prompts and frame counts.

**Frontend services**:
| Service | Responsibility |
|---------|----------------|
| AssetService | PixiJS spritesheet preloader, typed sprite/animation accessors |
| SoundService | Howler.js audio management, SFX + music with volume/mute controls |
| LoadingScreen | Asset preload progress bar, graceful degradation on failure |

**Game.tsx rendering**: Uses layered containers (map → items → projectiles → zone → players → labels) with sprite-based rendering when `AssetService.isLoaded`, falling back to procedural `Graphics` otherwise.

**Generated asset locations** (gitignored, regenerate with pipeline):
- `assets/concepts/` — Concept art PNGs
- `assets/models/` — 3D `.glb` models
- `assets/renders/` — Individual sprite frame PNGs
- `assets/audio/` — Raw `.wav` audio files

**Final assets** (committed, served to browser):
- `frontend/public/assets/sprites/` — Atlas `.png` + `.json` per category
- `frontend/public/assets/sfx/` — `.ogg` + `.mp3` sound effects
- `frontend/public/assets/music/` — `.ogg` + `.mp3` music tracks

## Deployment

### Production (k3s)

Arena runs on the shared k3s cluster as two separate deployments:
- **arena-backend**: Express + Socket.io on port 3003
- **arena-frontend**: nginx serving Vite-built static files on port 80

Both are exposed on `arena.korczewski.de` via Traefik IngressRoute with priority-based routing.

```bash
# Full deploy (build + push + apply + restart)
../../k8s/scripts/deploy/deploy-arena.sh

# Manifests only (no image rebuild)
../../k8s/scripts/deploy/deploy-arena.sh --manifests-only

# Skip health check
../../k8s/scripts/deploy/deploy-arena.sh --no-health-check

# Check deployment status
../../k8s/scripts/utils/deploy-tracker.sh status
```

### Docker Build (manual)

```bash
# From project root
docker build -t registry.korczewski.de/korczewski/arena-backend:latest -f arena/backend/Dockerfile .
docker build -t registry.korczewski.de/korczewski/arena-frontend:latest -f arena/frontend/Dockerfile .
docker push registry.korczewski.de/korczewski/arena-backend:latest
docker push registry.korczewski.de/korczewski/arena-frontend:latest
```

### Skaffold

```bash
cd ../../k8s && skaffold run -p arena    # Build + deploy arena only
```

### Frontend Runtime Config

Same pattern as L2P: `docker-entrypoint.sh` writes `env-config.js` from K8s env vars at container startup. The same Docker image works for production and dev environments.

- `VITE_API_URL`: Left empty (same-origin, Traefik routes `/api` to backend)
- `VITE_SOCKET_URL`: `wss://arena.korczewski.de` (WebSocket via Traefik)

### Auth Integration

Arena is registered in the auth service (`auth.apps` table, key: `arena`). All registered users have access — no per-app access gate. Traefik uses `user-auth-chain` middleware for authentication.

### URLs

| Environment | URL |
|-------------|-----|
| Production | https://arena.korczewski.de |
| Dev cluster | https://dev-arena.korczewski.de |
| Local dev | http://localhost:3002 (frontend), http://localhost:3003 (backend) |

### K8s Manifests

- `k8s/services/arena-backend/` — deployment, service, ingressroute, kustomization
- `k8s/services/arena-frontend/` — deployment, service, ingressroute, kustomization

## Naming Conventions

- React components: `PascalCase`
- Stores: `thingStore.ts`
- Services: `ThingService.ts`
