# GPU Worker Autoscaling (KEDA)

## Summary

Autoscale the Assetgenerator GPU worker on the RTX 5070 Ti WSL2 machine (10.10.0.3) using KEDA. When generation jobs are queued, KEDA detects queue depth via an HTTP endpoint, scales a lightweight "waker" pod that SSHs into the WSL2 machine to start the worker as a systemd user service. The worker self-exits after a configurable idle timeout, achieving scale-to-zero GPU usage with no manual intervention.

## Problem

The GPU worker (`Assetgenerator/worker/`) currently runs manually via `start-worker.sh`. It must be started by hand before generation jobs work, and it runs indefinitely — wasting GPU resources when idle. There is no mechanism to automatically start it when work arrives or stop it when idle.

## Constraints

- **WSL2 host**: The RTX 5070 Ti is a WSL2 dev workstation, not a standard Linux server. Joining it to k3s as a GPU worker node is impractical (WSL2 GPU passthrough + NVIDIA device plugin issues).
- **No database queue**: Assetgenerator uses no database. The job queue is in-memory inside `worker-manager.js` (FIFO array). KEDA's PostgreSQL/Redis triggers cannot be used directly.
- **Single worker limit**: `worker-manager.js` enforces one WebSocket worker connection at a time (403 on duplicates). Max concurrency is always 1.
- **Heavy host dependencies**: The worker spawns child processes (Python, Blender, ffmpeg, AudioCraft, TripoSR) that live on the bare metal host — containerizing the full toolchain is not viable.
- **Jobs not queued without worker**: Currently, adapters call `getWorker()` and bail out if null — jobs are never enqueued when no worker is connected. This must be fixed for autoscaling to work (see Section 1).

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│  k3s Cluster (korczewski-services namespace)            │
│                                                         │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │ Assetgenerator   │    │ gpu-waker Deployment      │  │
│  │ Server (pod)     │    │ (replicas: 0, KEDA-mgd)   │  │
│  │                  │    │                           │  │
│  │ GET /api/        │◄───│ KEDA polls every 30s      │  │
│  │   queue-depth    │    │                           │  │
│  │                  │    │ On scale 0→1:             │  │
│  │ WebSocket        │    │   SSH patrick@10.10.0.3   │  │
│  │ /ws/worker  ◄────┼────┼── "systemctl --user       │  │
│  │                  │    │    start gpu-worker"       │  │
│  └──────────────────┘    └───────────────────────────┘  │
│                                                         │
│  ┌──────────────────┐                                   │
│  │ KEDA Operator    │                                   │
│  │ (keda namespace) │                                   │
│  │                  │                                   │
│  │ ScaledObject:    │                                   │
│  │  metrics-api     │                                   │
│  │  trigger on      │                                   │
│  │  /api/queue-depth│                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
          │
          │ WebSocket (wss://assetgen.korczewski.de/ws/worker)
          ▼
┌─────────────────────────────────────────────────────────┐
│  WSL2 Machine (10.10.0.3) — RTX 5070 Ti                │
│                                                         │
│  systemd user service: gpu-worker.service               │
│  ┌──────────────────────────────────────┐               │
│  │ worker/index.js                      │               │
│  │  - Connects via WebSocket            │               │
│  │  - Executes jobs (Python, Blender…)  │               │
│  │  - Idle timeout: IDLE_TIMEOUT_MS     │               │
│  │  - Self-exits on timeout (exit 0)    │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

### Lifecycle Flow

1. User triggers generation in Assetgenerator UI → job enqueued in worker-manager
2. `GET /api/queue-depth` returns `{"depth": 1, "pending": 1, "active": 0, "workerConnected": false}`
3. KEDA polls (every 30s), sees depth ≥ 1 → scales `gpu-waker` Deployment from 0→1
4. Waker pod starts, SSHs to `10.10.0.3`, runs `systemctl --user start gpu-worker`
5. GPU worker boots (~5s), connects via WebSocket to `wss://assetgen.korczewski.de/ws/worker`
6. Worker processes queued jobs
7. All jobs complete → `/api/queue-depth` returns `{"depth": 0, ...}`
8. After KEDA `cooldownPeriod` (300s), KEDA scales waker 0→0 — pod terminates
9. Worker idle timer fires after `IDLE_TIMEOUT_MS` (default 600000ms = 10min) → `process.exit(0)`
10. Systemd records service as inactive (`Restart=no`), GPU is fully idle

### Timing Parameters

| Parameter | Value | Controls |
|-----------|-------|----------|
| KEDA `pollingInterval` | 30s | How often KEDA checks queue depth |
| KEDA `cooldownPeriod` | 300s (5min) | Delay before scaling waker to 0 after queue empties |
| Worker `IDLE_TIMEOUT_MS` | 600000 (10min) | How long worker stays alive with no jobs before self-exit |

The KEDA cooldown and worker idle timeout are intentionally independent. The waker pod costs ~16Mi RAM. The worker costs GPU power. They don't need to be synchronized.

## Detailed Changes

### 1. Decouple Job Queuing from Worker Presence + Queue Depth Endpoint

**Files:** `Assetgenerator/server.js`, `Assetgenerator/worker-manager.js`, adapters (`adapters/*.js`)

**Critical prerequisite:** Currently, adapters (e.g., `blender.js`, `audiocraft.js`, `triposr.js`) call `getWorker()` and bail out if it returns null. The `worker.exec()` method is the only path that pushes jobs onto `jobQueue`. This means when no worker is connected, jobs are never enqueued, queue depth is always 0, and KEDA never triggers. This must be fixed.

**Refactor the queuing path:**
1. Add an `enqueueJob(payload)` method to worker-manager that always pushes to `jobQueue` regardless of worker presence. Returns a Promise that resolves when the job completes.
2. Add a `dispatchNext()` function that checks if a worker is connected AND there are pending jobs, then dispatches the next job. Called both when a job is enqueued and when a worker registers.
3. Update adapters to call `enqueueJob(payload)` instead of `getWorker().exec(payload)`. Adapters no longer need to check worker presence — they enqueue and await the result.
4. SSE stream endpoints (`/api/library/:id/generate`, `/api/visual-library/batch/generate`, etc.) should report "waiting for GPU worker..." while a job is queued but no worker is connected, so the UI shows progress.

**Queue depth endpoint:**

Add `getQueueDepth()` method to worker-manager that returns:
```json
{
  "depth": 3,
  "pending": 2,
  "active": 1,
  "workerConnected": true
}
```

- `pending` = number of jobs in the FIFO queue
- `active` = 1 if a job is currently executing, 0 otherwise
- `depth` = `pending + active` (KEDA trigger value)
- `workerConnected` = boolean (informational, not used by KEDA)

Add `GET /api/queue-depth` route in `server.js` that calls `getQueueDepth()` and returns the JSON response.

**KEDA error handling:** If the Assetgenerator server is down or restarting, KEDA will receive HTTP errors from the endpoint. KEDA treats errors as "no data" and skips the polling interval — it does not scale up or down. This is benign but should be expected during rolling updates.

### 2. Worker Idle Timeout + Reconnect Limit

**File:** `Assetgenerator/worker/index.js`

Add idle timeout logic:
- Read `IDLE_TIMEOUT_MS` from environment (default: 600000)
- Start/reset a `setTimeout` timer:
  - Start on `welcome` message (connection established)
  - Reset on each `exit` message sent (job completed)
  - Clear on each `exec` message received (job started)
- When timer fires: log message, call `process.exit(0)`

**Critical: Idle timeout must also apply during reconnect cycles.** The current worker reconnects endlessly on WebSocket close (5s delay loop). If the connection drops while idle (e.g., server pod restart), the worker would reconnect forever instead of exiting. Fix:
- The idle timer must keep ticking across disconnects — do NOT clear it on WebSocket close
- Only clear the idle timer when a new `exec` message is received (i.e., actual work)
- If the idle timer fires during a reconnect cycle, exit cleanly (`process.exit(0)`)
- This means: worker connects → no jobs arrive → 10min passes → exits, even if connection dropped and reconnected in between

### 3. Systemd User Service

**File:** `10.10.0.3:~/.config/systemd/user/gpu-worker.service`

```ini
[Unit]
Description=Assetgenerator GPU Worker
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/patrick/projects/Assetgenerator/worker
ExecStart=/usr/bin/node index.js
Environment=WORKER_SERVER_URL=wss://assetgen.korczewski.de/ws/worker
Environment=IDLE_TIMEOUT_MS=600000
Restart=no

[Install]
WantedBy=default.target
```

Prerequisites on `10.10.0.3`:
- `loginctl enable-linger patrick` (allows user services without active session)
- `/etc/wsl.conf` must have `[boot] systemd=true`
- `systemctl --user daemon-reload` after creating the service file

### 4. KEDA Installation

**File:** `k8s/scripts/deploy/deploy-keda.sh`

```bash
#!/bin/bash
set -euo pipefail
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm upgrade --install keda kedacore/keda \
  --namespace keda --create-namespace \
  --wait --timeout 120s
echo "KEDA installed successfully"
```

Installs: keda-operator, keda-metrics-apiserver, keda-admission-webhooks, 3 CRDs.

### 5. Waker Deployment

**File:** `k8s/services/assetgenerator/gpu-waker-deployment.yaml`

Full manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-waker
  namespace: korczewski-services
spec:
  replicas: 0  # KEDA manages this
  selector:
    matchLabels:
      app: gpu-waker
  template:
    metadata:
      labels:
        app: gpu-waker
    spec:
      nodeSelector:
        kubernetes.io/arch: amd64
      containers:
        - name: waker
          image: registry.local:5000/korczewski/gpu-waker:latest
          command: ["/bin/sh", "-c"]
          args:
            - |
              ssh -o StrictHostKeyChecking=no -i /ssh/id_ed25519 \
                patrick@10.10.0.3 \
                "systemctl --user start gpu-worker" &&
              echo "Worker start signal sent, sleeping until scale-down..." &&
              sleep infinity
          resources:
            requests:
              memory: 16Mi
              cpu: 10m
            limits:
              memory: 32Mi
              cpu: 50m
          volumeMounts:
            - name: ssh-key
              mountPath: /ssh
              readOnly: true
      volumes:
        - name: ssh-key
          secret:
            secretName: gpu-waker-ssh-key
            defaultMode: 0400
```

**Image:** A custom minimal image (`Assetgenerator/waker/Dockerfile`) based on `alpine:3.20` with `openssh-client` pre-installed. This avoids running `apk add` on every pod startup, which would be slow and fragile (depends on Alpine mirror availability). The image is tiny (~8MB) and built once.

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache openssh-client
```

**`sleep infinity`** keeps the pod alive so KEDA can manage its lifecycle via replica count. When KEDA scales to 0, the pod is deleted cleanly.

**SSH host key:** Uses `-o StrictHostKeyChecking=no` since this is internal LAN traffic to a known host. Alternatively, a `known_hosts` file can be added to the secret for stricter verification.

### 6. ScaledObject

**File:** `k8s/services/assetgenerator/gpu-waker-scaledobject.yaml`

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: gpu-waker-scaler
  namespace: korczewski-services
spec:
  scaleTargetRef:
    name: gpu-waker
  minReplicaCount: 0
  maxReplicaCount: 1
  cooldownPeriod: 300
  pollingInterval: 30
  triggers:
    - type: metrics-api
      metadata:
        targetValue: "1"
        url: "http://assetgenerator.korczewski-services.svc.cluster.local:5200/api/queue-depth"
        valueLocation: "depth"
        method: "GET"
```

### 7. SSH Key Secret

One-time manual setup:
```bash
ssh-keygen -t ed25519 -f gpu-waker-key -N "" -C "gpu-waker@k8s"
# Add gpu-waker-key.pub to ~/.ssh/authorized_keys on 10.10.0.3
kubectl create secret generic gpu-waker-ssh-key \
  --from-file=id_ed25519=gpu-waker-key \
  -n korczewski-services
```

### 8. Waker Dockerfile

**File:** `Assetgenerator/waker/Dockerfile`

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache openssh-client
```

Add to Skaffold (`k8s/skaffold.yaml`) under the `assetgenerator` profile:
```yaml
- image: registry.korczewski.de/korczewski/gpu-waker
  context: ../Assetgenerator/waker
```

### 9. Kustomization Update

**File:** `k8s/services/assetgenerator/kustomization.yaml`

Add to resources list:
- `gpu-waker-deployment.yaml`
- `gpu-waker-scaledobject.yaml`

## Deploy Order

1. Install KEDA: `./k8s/scripts/deploy/deploy-keda.sh`
2. Create SSH keypair and k8s secret
3. Add public key to `~/.ssh/authorized_keys` on `10.10.0.3`
4. Set up systemd service on `10.10.0.3` (service file + linger + daemon-reload)
5. Verify SSH connectivity from a test pod: `kubectl run test-ssh --rm -it --image=alpine -- sh -c 'apk add openssh-client && ssh -o StrictHostKeyChecking=no -i /ssh/id_ed25519 patrick@10.10.0.3 echo ok'` (or simpler: verify pod-to-LAN routing works with `ping 10.10.0.3`)
6. Build and push updated Assetgenerator server image (with queue-depth endpoint + refactored job queuing): `docker build -t registry.korczewski.de/korczewski/assetgenerator:latest . && docker push ...`
7. Build and push gpu-waker image: `docker build -t registry.korczewski.de/korczewski/gpu-waker:latest Assetgenerator/waker/ && docker push ...`
8. Apply kustomize manifests (deploys new server image + waker deployment + ScaledObject): `kustomize build k8s/services/assetgenerator | kubectl apply -f -`
9. Wait for Assetgenerator pod to pass readiness probe (confirms `/api/queue-depth` is live before KEDA starts polling)
10. Verify: trigger a generation job, watch KEDA scale waker, confirm worker starts and connects

## Testing Strategy

### Unit Tests
- `worker-manager.js`: Test `getQueueDepth()` returns correct counts for empty queue, pending jobs, active job, and mixed states
- `worker-manager.js`: Test `enqueueJob()` pushes to queue even when no worker is connected
- `worker-manager.js`: Test `dispatchNext()` dispatches when worker connects with pending jobs
- `worker/index.js`: Test idle timer starts on welcome, resets on job exit, clears on job exec, fires exit after timeout
- `worker/index.js`: Test idle timer keeps ticking across WebSocket reconnect cycles

### Integration Tests
- Start Assetgenerator server → `GET /api/queue-depth` returns `{"depth": 0, ...}`
- Enqueue a job (no worker connected) → queue depth increments to 1
- Connect a worker → job dispatches, depth shows active=1
- Verify KEDA ScaledObject is valid: `kubectl get scaledobject gpu-waker-scaler -n korczewski-services`

### End-to-End Verification
1. Ensure gpu-waker has 0 replicas: `kubectl get deploy gpu-waker -n korczewski-services`
2. Trigger a generation in the Assetgenerator UI
3. Within 30s, KEDA should scale waker to 1: `kubectl get pods -l app=gpu-waker -n korczewski-services`
4. Worker should connect: `curl assetgen.korczewski.de/api/worker-status` → `connected: true`
5. After job completes and idle timeout passes, worker exits
6. After cooldown, waker pod scales to 0

## Security Considerations

- SSH key is scoped to a dedicated ed25519 keypair (not reusing existing keys)
- The `authorized_keys` entry on `10.10.0.3` can be restricted with `command="systemctl --user start gpu-worker"` to limit what the key can do
- The waker pod has minimal resources and no privilege escalation
- Queue depth endpoint is read-only, no authentication needed (internal cluster traffic only)

## Known Limitations

- **WSL2 sleep/shutdown**: If the Windows host sleeps or WSL2 shuts down, SSH from the waker pod will fail. The waker pod enters CrashLoopBackOff while the queue remains non-empty. No progress is made until the machine wakes up and the waker pod retries successfully. Consider monitoring waker pod CrashLoopBackOff events.
- **Startup latency**: Worst case from job enqueue to worker processing: ~30s KEDA poll + ~5s pod start + ~5s SSH + ~5s worker boot = ~45s. Acceptable for GPU generation jobs (which take 10s-2min each) but not for interactive sub-second use cases.
- **Existing `/api/worker-status` endpoint**: Already exists in `server.js` — no changes needed. Used in E2E verification steps.

## Future Improvements

- **Restricted SSH command**: Lock down the authorized_keys entry with `command="systemctl --user start gpu-worker"` to limit what the key can do (prevents arbitrary command execution if the key leaks)
- **Metrics/observability**: Expose KEDA scaling events and worker lifecycle to Grafana
- **Multiple GPU nodes**: If a second GPU machine is added, extend max replicas and modify worker-manager to accept multiple workers
