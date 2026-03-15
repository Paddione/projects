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
./scripts/generate_all.sh --phase 2     # 3D models (TripoSR/Meshy)
./scripts/generate_all.sh --phase 3     # Sprite rendering (Blender)
./scripts/generate_all.sh --phase 4     # Sprite packing only
./scripts/generate_all.sh --phase 5     # Audio generation (AudioCraft)
./scripts/generate_all.sh --phase 6     # Audio processing (ffmpeg)
```

**Pipeline phases**: concepts → 3D models → **Blender render** → sprite pack → audio gen → audio process

**Asset manifest**: `assets/manifest.json` — defines all characters, items, tiles, SFX, music with prompts and frame counts.

#### Audio Review Tool

The Assetgenerator (`Assetgenerator/`) provides a web UI for reviewing and regenerating audio assets:

```bash
npm run dev:assetgenerator    # Opens http://localhost:5200
```

- Listen to each sound, edit prompts, flag for regeneration
- Supports AudioCraft (local GPU) and ElevenLabs (API) backends
- State persisted in `Assetgenerator/projects/arena.json`
- `generate_audio.py` supports single-sound override flags: `--prompt`, `--seed`, `--duration`, `--force`

#### Blender Sprite Rendering (Phase 3)

Professional sprite rendering using persistent Blender templates:

**Templates** (`assets/blend/`):
- **character.blend** — 60° isometric, warm key + cool fill + rim lighting, 8-direction
- **weapon.blend** — Close-up, rim-heavy lighting, single angle × N poses
- **item.blend** — Centered, bright, minimal shadow, icon-like
- **tile.blend** — Perfect top-down, seamless, flat overhead lighting
- **cover.blend** — 45° angle, side-lit, shows depth/silhouette
- **ui.blend** — Orthographic flat, bright, zero shadows

**Rendering setup**:
- Engine: EEVEE (fast, good quality)
- Resolution: 256×256px (downscale to 128px in-game for sharp pixels)
- Output: PNG RGBA (transparent background)
- Render time: 0.5-2s per frame depending on complexity

**How it works**:
1. `render_sprites.py` loads appropriate `.blend` template
2. Imports 3D model from `assets/models/{category}/{id}.glb`
3. Links materials from `assets/blend/_shared/materials.blend`
4. Batch renders via Python script (8 directions for character, etc.)
5. Outputs PNG frames to `assets/renders/{category}/{id}/{pose}_{direction}.png`

**Benefits over procedural rendering**:
- ✅ Professional 3-point lighting (key, fill, rim)
- ✅ PBR materials with depth (metallic, roughness, normal maps)
- ✅ Ambient occlusion shadows add dimension
- ✅ Consistent appearance across all renders
- ✅ One-time setup, reusable forever
- ✅ Easy global improvements (tweak template, all renders improve)

**Quick setup** (see BLENDER_WORKFLOW.md for details):
```bash
# Create character.blend template:
1. Open Blender
2. Add 3 lights (Key, Fill, Rim)
3. Add orthographic camera (60° angle)
4. Link materials: File → Link → _shared/materials.blend
5. Import test character.glb: File → Import glTF
6. Configure EEVEE: 256×256, transparent, AO enabled
7. Render test: F12
8. Save: File → Save As character.blend
```

**Batch render Python script** (ready to use):
```python
import bpy, math, os
DIRECTIONS = {"N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315}
character = bpy.data.objects["Character"]
for direction, angle in DIRECTIONS.items():
    character.rotation_euler.z = math.radians(angle)
    bpy.context.scene.render.filepath = f"/path/to/renders/{direction}.png"
    bpy.ops.render.render(write_still=True)
```

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
- `assets/blend/` — Blender project templates
- `assets/renders/` — Individual sprite frame PNGs
- `assets/audio/` — Raw `.wav` audio files

**Final assets** (committed, served to browser):
- `frontend/public/assets/sprites/` — Atlas `.png` + `.json` per category
- `frontend/public/assets/sfx/` — `.ogg` + `.mp3` sound effects
- `frontend/public/assets/music/` — `.ogg` + `.mp3` music tracks

## E2E Testing

### Asset Coverage Tests

Arena includes dedicated E2E tests that verify real assets (not mocks) load correctly:

```bash
# Run asset coverage tests locally
npx playwright test e2e/assets.spec.ts

# With UI
npx playwright test e2e/assets.spec.ts --ui

# Specific test
npx playwright test e2e/assets.spec.ts -g "LoadingScreen"
```

**What they test:**

1. **File existence** — All sprite atlases (6) + audio SFX (17) + music (4) exist in dist/
2. **Sprite validity** — JSON atlases have valid frame data (not corrupted)
3. **CSP headers** — Content-Security-Policy permits worker, image, and audio operations
4. **Loading progress** — LoadingScreen reaches 100% with real assets (not mocks)
5. **Audio decode** — Audio files load and decode without errors in browser

**Why they matter:** Mock-based tests can hide real failures (missing files, CSP violations, audio format issues). These tests catch production-ready issues before deployment.

**Key difference from other E2E tests:**
- Other tests mock the backend API and assets (fast, isolated)
- Asset tests load real assets from public/ (slower, integration-level)
- Asset tests must run AFTER `npm run build:all` to verify dist/ contents

### Other E2E Tests

```bash
# Run all E2E tests (auth, home, lobby, game, results, mobile, performance, assets)
npx playwright test

# Run desktop tests only (skip mobile)
npx playwright test -g "chromium"

# Run specific test file
npx playwright test e2e/home.spec.ts
```

**Test Configuration:**

- See `playwright.config.ts` for test configuration (browser selection, timeouts, reporters)
- Vite dev server is automatically started by Playwright's `webServer` hook
- Tests run sequentially (`workers: 1`) to avoid port conflicts with dev server

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
