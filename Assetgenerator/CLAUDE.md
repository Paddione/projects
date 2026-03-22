# Assetgenerator — CLAUDE.md

## Overview

Multi-phase AI asset generation service for Arena and L2P. Express API + WebSocket server orchestrating audio and visual asset generation across local GPU and cloud backends. No database — JSON state files + NAS storage.

**Documentation references:**
- [README.md](README.md) -- Quick start, commands
- [docs/services/assetgenerator.md](../docs/services/assetgenerator.md) -- Deep dive: GPU worker, pipelines, API
- [docs/guides/deployment.md](../docs/guides/deployment.md) -- Deployment to k3s

## Architecture

- **Server**: Express.js (Node 22 ESM), port 5200, single-file (`server.js`)
- **Worker**: Remote GPU daemon on WSL2 machine (10.10.0.3), connects via WebSocket
- **Storage**: NAS-backed PVs at `/mnt/pve3a/audio-library` and `/mnt/pve3a/visual-library`
- **KEDA**: Auto-scales gpu-waker pod (0→1) based on queue depth to wake GPU worker via SSH

## GPU Worker System

The GPU worker is an **external machine** (10.10.0.3), not a k8s node. The wakeup chain:

1. Job enqueued → `/api/queue-depth` returns depth ≥ 1
2. KEDA scales gpu-waker pod 0→1 (polls every 30s)
3. gpu-waker SSH's to `patrick@10.10.0.3:2222` → `systemctl --user start gpu-worker`
4. Worker connects to `wss://assetgen.korczewski.de/ws/worker`
5. Worker registers with hostname + GPU info
6. Server dispatches queued jobs

### Checking GPU Worker Availability

Before dispatching GPU-dependent generation, ALWAYS check worker status:

```bash
# From inside cluster or via curl
curl -s https://assetgen.korczewski.de/api/worker-status
# Returns: { "connected": true/false, "hostname": "...", "gpu": "NVIDIA RTX 5070 Ti", "currentJob": null }

curl -s https://assetgen.korczewski.de/api/queue-depth
# Returns: { "depth": 0, "pending": 0, "active": 0, "workerConnected": true/false }

curl -s https://assetgen.korczewski.de/api/prerequisites
# Returns: { "python": true/false, "ffmpeg": true/false, "cuda": true/false }
```

### If GPU Worker Is NOT Connected

1. **Try to wake it**: The KEDA auto-scaler wakes the worker when jobs are enqueued. Simply enqueue the job and wait up to 90 seconds for the worker to connect.
2. **Manual wake**: `ssh patrick@10.10.0.3 -p 2222 'systemctl --user start gpu-worker'`
3. **If still unavailable**: Warn the user that GPU worker is offline. The following adapters REQUIRE GPU and will fail without it:
   - `audiocraft` (audio generation)
   - `comfyui` (concept art)
   - `diffusers` (concept art)
   - `triposr` (3D model generation)
   - `blender` (sprite rendering)
4. **Cloud fallback adapters** that work WITHOUT GPU:
   - `elevenlabs` (audio — needs `ELEVENLABS_API_KEY`)
   - `suno` (music — needs `SUNO_API_KEY`)
   - `siliconflow` (concept art — cloud API)
   - `gemini-imagen` (concept art — cloud API)
   - `meshy` (3D models — cloud API)
   - `packer` (atlas packing — CPU only)
5. **Inform the user**: "GPU worker is unavailable. Generation will use cloud API fallbacks where available. GPU-only phases (AudioCraft, ComfyUI, TripoSR, Blender) will fail. Cloud adapters (SiliconFlow, Gemini Imagen, Meshy, ElevenLabs) will be used instead."

## Generating Assets — Required Information

### Audio Assets

When asked to generate audio, collect these details before calling the API:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `id` | Yes | Unique sound ID (snake_case) | `gunshot_rifle`, `music_lobby` |
| `name` | Yes | Display name | `Rifle Gunshot` |
| `category` | Yes | `sfx_*` or `music_*` | `sfx_weapons`, `music_lobby` |
| `prompt` | Yes | Generation prompt for AI | `"Short punchy rifle gunshot, military, close range"` |
| `duration` | No | Duration in seconds (default varies) | `2` for SFX, `30` for music |
| `backend` | No | Backend override | `audiocraft` (GPU), `elevenlabs` (cloud), `suno` (music cloud) |

**API calls:**
```bash
# Add to library
curl -X POST https://assetgen.korczewski.de/api/library \
  -H 'Content-Type: application/json' \
  -d '{"id":"gunshot_rifle","name":"Rifle Gunshot","category":"sfx_weapons","prompt":"Short punchy rifle gunshot","duration":2}'

# Generate (returns SSE stream)
curl -X POST https://assetgen.korczewski.de/api/library/gunshot_rifle/generate

# Assign to project
curl -X POST https://assetgen.korczewski.de/api/library/gunshot_rifle/assign \
  -H 'Content-Type: application/json' \
  -d '{"project":"arena","slot":"gunshot_rifle"}'
```

### Visual Assets

When asked to generate visual assets, collect these details:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `id` | Yes | Unique asset ID (snake_case) | `soldier_basic`, `ak47` |
| `name` | Yes | Display name | `Basic Soldier` |
| `category` | Yes | `characters`, `weapons`, `items`, `tiles`, `cover`, `ui` | `characters` |
| `prompt` | Yes | Concept art prompt | `"Low-poly soldier, tactical gear, isometric game sprite"` |
| `tags` | No | Tags array | `["arena", "combat"]` |
| `poses` | No | Override default poses | `["stand", "gun", "reload"]` |
| `directions` | No | Override directions (1 or 8) | `8` for characters |
| `size` | No | Sprite size in px | `64` for characters, `32` for items |
| `conceptBackend` | No | Override concept backend | `comfyui`, `gemini-imagen`, `siliconflow` |

**Visual pipeline phases:** `concept` → `model` → `render` → `pack` (or `full` for all)

**API calls:**
```bash
# Create visual asset
curl -X POST https://assetgen.korczewski.de/api/visual-library \
  -H 'Content-Type: application/json' \
  -d '{"id":"soldier_basic","name":"Basic Soldier","category":"characters","prompt":"Low-poly soldier, tactical gear, isometric"}'

# Generate single phase (returns SSE stream)
curl -X POST https://assetgen.korczewski.de/api/visual-library/soldier_basic/generate/concept
curl -X POST https://assetgen.korczewski.de/api/visual-library/soldier_basic/generate/model
curl -X POST https://assetgen.korczewski.de/api/visual-library/soldier_basic/generate/full

# Batch generate multiple assets
curl -X POST https://assetgen.korczewski.de/api/visual-library/batch/generate \
  -H 'Content-Type: application/json' \
  -d '{"ids":["soldier_basic","ak47"],"fromPhase":"concept"}'

# Assign to project
curl -X POST https://assetgen.korczewski.de/api/visual-library/soldier_basic/assign \
  -H 'Content-Type: application/json' \
  -d '{"project":"arena","atlas":"characters"}'
```

### Category Defaults

| Category | Directions | Default Poses | Size | 3D |
|----------|-----------|---------------|------|----|
| characters | 8 | stand, gun, machine, reload, hold, silencer | 64px | Yes |
| weapons | 1 | idle | 32px | Yes |
| items | 1 | idle | 32px | Yes |
| tiles | 1 | idle | 32px | No (2D only) |
| cover | 1 | idle | 32px | Yes |
| ui | 1 | idle | 16px | No (2D only) |

### Concept Backend Priority

Fallback chain for concept generation: `comfyui` → `gemini-imagen` → `siliconflow` → `diffusers`

### Model Backend Priority

Fallback chain for 3D model generation: `meshy` (cloud) → `triposr` (GPU)

## Commands

```bash
npm run dev           # node --watch server.js --project arena (port 5200)
npm run start         # node server.js --project arena
npm run test          # node --test test/api.test.js (49+ API tests)
```

## Deployment

- **URL**: https://assetgen.korczewski.de
- **Deploy**: `./k8s/scripts/deploy/deploy-assetgenerator.sh` (builds server + gpu-waker images)
- **Resources**: 100m-500m CPU, 256Mi-512Mi memory
- **Storage**: SMB-CSI PVs for audio (10Gi) and visual (50Gi) libraries

## Monitoring

- `GET /health` — Basic health (used by k8s probes)
- `GET /api/worker-status` — GPU worker connection state, hostname, GPU name
- `GET /api/queue-depth` — Job queue depth (used by KEDA for auto-scaling)
- `GET /api/prerequisites` — Python, ffmpeg, CUDA availability
