# Assetgenerator Split Architecture: k3s Orchestrator + GPU Worker

**Date:** 2026-03-15
**Status:** Draft
**Author:** Patrick + Claude

## Problem

The Assetgenerator service runs locally on a workstation because it depends on GPU-heavy tools (AudioCraft, ComfyUI, Diffusers, TripoSR, Blender EEVEE). This means it's not accessible when the workstation is off and doesn't benefit from the k3s cluster's always-on infrastructure (Traefik routing, health checks, NAS access).

## Goal

Run the Assetgenerator server in the k3s cluster for always-on availability and web UI access, while offloading GPU-heavy generation work to a local workstation when available. When no GPU worker is connected, fall back to local CPU execution or cloud APIs based on user selection.

## Architecture

```
┌──────────────────────────────┐       ┌────────────────────────────────┐
│  k3s Cluster (amd64)         │       │  Workstation (RTX 5070 Ti)     │
│                              │       │                                │
│  Assetgenerator Server Pod   │◄─WS──►│  GPU Worker (Node.js CLI)      │
│  ├─ Web UI                   │       │  ├─ Receives exec commands     │
│  ├─ Library CRUD (JSON)      │       │  ├─ Spawns child processes     │
│  ├─ SSE progress → browser   │       │  │  ├─ python generate_audio   │
│  ├─ ffmpeg post-processing   │       │  │  ├─ python generate_concepts│
│  ├─ Sprite packing           │       │  │  ├─ python generate_3d      │
│  ├─ Cloud API adapters       │       │  │  └─ blender --background    │
│  └─ WebSocket server         │       │  ├─ Streams stdout/stderr      │
│      (/ws/worker)            │       │  └─ Writes output → NAS        │
│                              │       │                                │
│  NAS PV (/mnt/pve3a/)       │       │  SMB Mount (/mnt/pve3a/)       │
│  ├─ audio-library/           │       │  (same storage, both sides)    │
│  └─ visual-library/          │       │                                │
│                              │       │                                │
│  Traefik IngressRoute        │       └────────────────────────────────┘
│  assetgen.korczewski.de      │
└──────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Communication | WebSocket (worker connects outbound to server) | Already used in l2p/arena, real-time, no inbound firewall rules needed |
| File transfer | Direct NAS write | Both sides mount `/mnt/pve3a/`, avoids streaming large files over WS |
| Concurrency | Single job at a time | Predictable VRAM usage on 16GB RTX 5070 Ti |
| Failure handling | Mark failed, manual retry | Matches existing behavior; asset stays in pre-generation state |
| Worker protocol | Thin executor (server sends shell commands) | Adapters already build spawn commands; worker stays ~80 lines |

### Execution Routing

When a generation request arrives, the server routes based on backend selection and worker availability:

1. **Cloud API backend** (elevenlabs, meshy) → server runs locally via adapter (API call, no GPU needed)
2. **Local backend** (audiocraft, comfyui, diffusers, triposr, blender):
   - GPU worker connected → dispatch command over WebSocket (fast, CUDA)
   - No GPU worker → server spawns locally on CPU (slow fallback)

The user picks the backend from the existing dropdown. The routing is automatic and transparent.

## Components

### 1. Worker Manager (`worker-manager.js`) — NEW

Server-side module managing the WebSocket connection to the GPU worker.

**Responsibilities:**
- Accept WebSocket connections on `/ws/worker`
- Track worker state (connected, hostname, GPU, busy/idle)
- Dispatch commands and return Promises
- Heartbeat monitoring (ping every 30s, timeout after 10s)
- Mark jobs as failed on disconnect

**API surface:**
```js
import { initWorkerManager, getWorker, getWorkerStatus } from './worker-manager.js';

// During server startup — attach to HTTP server
initWorkerManager(httpServer);

// In adapters — check worker availability
const worker = getWorker();
if (worker) {
  const result = await worker.exec({ cmd, args, cwd, env });
  // result: { stdout, stderr, code }
} else {
  // Fall back to local spawn
}

// For UI status endpoint
getWorkerStatus();
// Returns: { connected, hostname, gpu, currentJob }
```

### 2. GPU Worker (`worker/index.js`) — NEW

Standalone Node.js CLI that runs on the workstation.

**Responsibilities:**
- Connect to server WebSocket (`wss://assetgen.korczewski.de/ws/worker`)
- Register with hostname and GPU info
- Receive messages, spawn child processes via `child_process.spawn()`
- Stream stdout/stderr back to server
- Report exit codes
- Auto-reconnect on disconnect (5s backoff)
- Respond to ping/pong heartbeats
- Kill process on `cancel` message

**Note on process spawning:** The worker uses `child_process.spawn()` (not `exec()`) with explicit `cmd` and `args` arrays received from the server. This avoids shell interpretation — the server constructs the exact argument list (matching what adapters already build for local spawn), and the worker passes them directly to `spawn()`. This is safe because both server and worker are on a private network controlled by the same user.

**Single dependency:** `ws` npm package.

**Prerequisites on workstation:**
- Node.js
- Python 3 + PyTorch + CUDA
- Blender
- Git clone of the repo (for Python scripts)
- SMB mount at `/mnt/pve3a/`

### 3. Adapter Changes — MODIFIED

Each GPU adapter gains routing logic. The change is identical across all 5 GPU adapters (audiocraft, comfyui, diffusers, triposr, blender):

**Before:**
```js
const proc = spawn(pythonPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
```

**After:**
```js
import { getWorker } from '../worker-manager.js';

const worker = getWorker();
if (worker) {
  return worker.exec({ cmd: pythonPath, args, cwd, env: {} });
} else {
  const proc = spawn(pythonPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  // ... existing local spawn logic unchanged
}
```

The `worker.exec()` Promise resolves with `{ stdout, stderr, code }` — same shape the adapters already extract from the local spawn. Seed extraction, frame counting, and all post-spawn logic remains identical.

**Unchanged adapters:**
- `packer.js` — CPU-only (sprite packing), always runs locally
- `elevenlabs.js` — Cloud API, always runs locally
- `meshy.js` — Cloud API, always runs locally

### 4. Server Changes (`server.js`) — MODIFIED

Minimal changes:
- Import and initialize `worker-manager` on the HTTP server
- Add `GET /api/worker-status` endpoint
- Add `GET /health` endpoint (for k8s probes)
- No changes to the 6 adapter invocation sites — routing happens inside each adapter

### 5. UI Changes (`index.html`) — MODIFIED

Single addition: **worker status indicator** in the header.
- Connected: green dot + hostname + GPU name
- Disconnected: grey dot + "No GPU worker"
- Polled via `GET /api/worker-status`
- Generation progress bars show `(remote)` or `(local)` suffix

## WebSocket Protocol

### Message Types

**Server → Worker:**

| Type | Payload | Purpose |
|------|---------|---------|
| `welcome` | `{ serverVersion }` | Connection established |
| `exec` | `{ jobId, cmd, args, cwd, env }` | Run a command (`cmd` + `args` array, passed to `spawn()`) |
| `cancel` | `{ jobId }` | Kill current process (SIGTERM) |
| `ping` | `{}` | Heartbeat |

**Worker → Server:**

| Type | Payload | Purpose |
|------|---------|---------|
| `register` | `{ hostname, gpu, capabilities }` | Worker identification |
| `ack` | `{ jobId }` | Job received, starting |
| `stdout` | `{ jobId, data }` | Process stdout line(s) |
| `stderr` | `{ jobId, data }` | Process stderr line(s) |
| `exit` | `{ jobId, code }` | Process finished |
| `pong` | `{}` | Heartbeat reply |

### Lifecycle

1. **Connection:** Worker connects → server sends `welcome` → worker sends `register` → server marks worker available
2. **Job dispatch:** User triggers generation → server builds command → sends via WebSocket → worker sends `ack`
3. **Execution:** Worker spawns process → streams `stdout`/`stderr` → server relays to SSE → sends `exit` on completion
4. **Post-processing:** Server runs ffmpeg locally (CPU) → updates library state → closes SSE stream
5. **Disconnect:** Worker disconnects mid-job → server marks job failed, asset stays in pre-generation state

### Heartbeat

- Server sends `ping` every 30 seconds
- Worker must reply `pong` within 10 seconds
- Missed pong → server marks worker disconnected + any in-flight job as failed

## Kubernetes Manifests

### New files: `k8s/services/assetgenerator/`

**`deployment.yaml`:**
- Single replica
- Image: `registry.local:5000/korczewski/assetgenerator:latest`
- `nodeSelector: kubernetes.io/arch: amd64`
- Port: 5200
- Mounts: audio-library PVC + visual-library PVC
- Resources: `128Mi/100m` request, `256Mi/500m` limit
- Health probes on `/health`

**`service.yaml`:**
- ClusterIP, port 5200

**`ingressroute.yaml`:**
- Host: `assetgen.korczewski.de`
- Routes to service:5200
- TLS via wildcard cert (existing `korczewski-tls`)
- WebSocket upgrade handled natively by Traefik

**`pv-audio.yaml` + `pv-visual.yaml`:**
- Static PersistentVolumes pointing to `//10.0.0.11/storage-pve3a/audio-library` and `//10.0.0.11/storage-pve3a/visual-library`
- Uses existing `smbcreds` secret
- Mount options matching existing SMB-CSI pattern (uid=1001, noperm, cache=none)

**`pvc.yaml`:**
- Two PVCs binding to the static PVs

**`kustomization.yaml`:**
- References all above resources

### Dockerfile

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 5200
CMD ["node", "server.js"]
```

No Python, Blender, or CUDA in the image — those only run on the worker. Image stays small (~200MB).

### Deploy Script

New `k8s/scripts/deploy/deploy-assetgenerator.sh` following existing pattern:
- Build Docker image
- Push to `registry.korczewski.de/korczewski/assetgenerator:latest`
- Apply kustomize manifests
- Rollout restart
- Record SHA in deploy tracker

## File Changes Summary

### New Files

| File | Description |
|------|-------------|
| `Assetgenerator/worker-manager.js` | Server-side WebSocket manager (~120 lines) |
| `Assetgenerator/worker/index.js` | GPU worker CLI (~80 lines) |
| `Assetgenerator/worker/package.json` | Worker deps (ws) |
| `Assetgenerator/Dockerfile` | Container image for k3s |
| `Assetgenerator/.dockerignore` | Exclude worker/, test/, .git |
| `k8s/services/assetgenerator/deployment.yaml` | Pod spec |
| `k8s/services/assetgenerator/service.yaml` | ClusterIP service |
| `k8s/services/assetgenerator/ingressroute.yaml` | Traefik route |
| `k8s/services/assetgenerator/pv-audio.yaml` | NAS PV for audio |
| `k8s/services/assetgenerator/pv-visual.yaml` | NAS PV for visual |
| `k8s/services/assetgenerator/pvc.yaml` | PVCs |
| `k8s/services/assetgenerator/kustomization.yaml` | Kustomize config |
| `k8s/scripts/deploy/deploy-assetgenerator.sh` | Deploy script |
| `Assetgenerator/test/worker-manager.test.js` | Worker manager unit tests |
| `Assetgenerator/test/adapter-routing.test.js` | Adapter dispatch tests |
| `Assetgenerator/worker/test/worker.test.js` | Worker client tests |

### Modified Files

| File | Change |
|------|--------|
| `Assetgenerator/server.js` | Mount WS endpoint, add `/api/worker-status`, add `/health` |
| `Assetgenerator/adapters/audiocraft.js` | Add worker routing (if worker → remote, else spawn local) |
| `Assetgenerator/adapters/comfyui.js` | Same routing pattern |
| `Assetgenerator/adapters/diffusers.js` | Same routing pattern |
| `Assetgenerator/adapters/triposr.js` | Same routing pattern |
| `Assetgenerator/adapters/blender.js` | Same routing pattern |
| `Assetgenerator/index.html` | Worker status indicator in header |
| `k8s/skaffold.yaml` | Add assetgenerator profile |

### Unchanged Files

| File | Reason |
|------|--------|
| `Assetgenerator/adapters/packer.js` | CPU-only, always local |
| `Assetgenerator/adapters/elevenlabs.js` | Cloud API, always local |
| `Assetgenerator/adapters/meshy.js` | Cloud API, always local |
| All Python scripts (`scripts/`) | Run by worker, not modified |
| All Blender scripts | Run by worker, not modified |
| `Assetgenerator/test/api.test.js` | Tests CRUD/library, unaffected |
| `Assetgenerator/config/*.json` | Config paths unchanged |
| `Assetgenerator/library.json` | State format unchanged |

## Testing

### New Unit Tests

**`test/worker-manager.test.js`:**
- Worker connects → `getWorker()` returns truthy
- Worker disconnects → `getWorker()` returns null
- `exec()` sends message and resolves on `exit` response
- `exec()` rejects when worker disconnects mid-job
- Heartbeat timeout marks worker disconnected
- Second worker connection rejected (single worker)

**`test/adapter-routing.test.js`:**
- Worker connected + local adapter (audiocraft) → calls `worker.exec()`
- Worker disconnected + local adapter → falls back to `spawn()`
- Cloud adapter → always calls `spawn()` regardless of worker
- Verify message shape matches protocol

**`worker/test/worker.test.js`:**
- Receives command → spawns process via `spawn()`, streams stdout/stderr
- Receives `cancel` → kills process with SIGTERM
- Receives `ping` → responds with `pong`
- Connection lost → auto-reconnect after delay

All tests use mocked WebSockets — no real GPU or Python needed.

### Manual Smoke Test

1. Deploy server to k3s
2. Start worker: `cd Assetgenerator/worker && npm start`
3. Open `assetgen.korczewski.de` — verify worker connected indicator
4. Generate sound via AudioCraft — verify remote execution, WAV on NAS, post-processing
5. Stop worker — verify disconnected indicator
6. Generate again — verify local CPU fallback
7. Start worker mid-generation — verify no interference with in-flight local job
8. Disconnect worker mid-generation — verify job marked failed, asset unchanged

### Existing Tests

`test/api.test.js` — unchanged, continues to test CRUD and library operations.
