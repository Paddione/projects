# GPU Worker Autoscaling (KEDA) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Autoscale the Assetgenerator GPU worker via KEDA — jobs queue regardless of worker presence, KEDA wakes the worker via SSH, worker self-exits on idle timeout.

**Architecture:** The Assetgenerator server exposes `GET /api/queue-depth`. KEDA polls it every 30s, scaling a lightweight waker pod (0→1) that SSHs into the WSL2 machine (10.10.0.3) to start a systemd user service. The worker connects via WebSocket, processes jobs, and self-exits after 10min idle. No GPU containers in k8s — all GPU work stays on bare metal.

**Tech Stack:** Node.js (ESM), WebSocket (ws), KEDA (Helm), Alpine + openssh-client (waker image), systemd user service, k8s manifests (kustomize)

**Spec:** `docs/superpowers/specs/2026-03-16-gpu-worker-autoscaling-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `Assetgenerator/worker-manager.js` | Add `enqueueJob()`, `getQueueDepth()`, decouple from worker presence |
| Modify | `Assetgenerator/server.js` | Add `GET /api/queue-depth` route, update import |
| Modify | `Assetgenerator/adapters/audiocraft.js` | Replace `getWorker().exec()` with `enqueueJob()` |
| Modify | `Assetgenerator/adapters/blender.js` | Replace `getWorker().exec()` with `enqueueJob()` |
| Modify | `Assetgenerator/adapters/triposr.js` | Replace `getWorker().exec()` with `enqueueJob()` |
| Modify | `Assetgenerator/adapters/comfyui.js` | Replace `getWorker().exec()` with `enqueueJob()` |
| Modify | `Assetgenerator/adapters/diffusers.js` | Replace `getWorker().exec()` with `enqueueJob()` |
| Modify | `Assetgenerator/worker/index.js` | Add idle timeout with `IDLE_TIMEOUT_MS` env var |
| Modify | `Assetgenerator/test/worker-manager.test.js` | Add tests for `enqueueJob()`, `getQueueDepth()` |
| Modify | `Assetgenerator/worker/test/worker.test.js` | Add idle timeout tests |
| Create | `Assetgenerator/waker/Dockerfile` | Minimal Alpine image with openssh-client |
| Create | `k8s/services/assetgenerator/gpu-waker-deployment.yaml` | Waker pod (replicas: 0, KEDA-managed) |
| Create | `k8s/services/assetgenerator/gpu-waker-scaledobject.yaml` | KEDA metrics-api trigger |
| Create | `k8s/scripts/deploy/deploy-keda.sh` | Helm install script for KEDA |
| Modify | `k8s/services/assetgenerator/kustomization.yaml` | Add waker resources |
| Modify | `k8s/skaffold.yaml` | Add gpu-waker image to assetgenerator profile |
| Modify | `k8s/scripts/deploy/deploy-assetgenerator.sh` | Build+push waker image alongside server |

---

## Chunk 1: Decouple Job Queuing from Worker Presence

### Task 1: Add `enqueueJob()` and `getQueueDepth()` to worker-manager

**Files:**
- Modify: `Assetgenerator/worker-manager.js`
- Test: `Assetgenerator/test/worker-manager.test.js`

- [ ] **Step 1: Write failing tests for `enqueueJob()` and `getQueueDepth()`**

Add these tests to `Assetgenerator/test/worker-manager.test.js`. They go inside a new `describe('enqueueJob()')` block after the existing `describe('heartbeat')` block.

```javascript
describe('enqueueJob()', () => {
  it('queues a job even when no worker is connected', async () => {
    // No worker connected — job should sit in queue
    const depth = getQueueDepth();
    assert.equal(depth.depth, 0);

    // enqueueJob should not throw — it returns a promise that resolves later
    const jobPromise = enqueueJob({ cmd: 'echo', args: ['test'], cwd: '/tmp', env: {} });
    assert.ok(jobPromise instanceof Promise);

    const depthAfter = getQueueDepth();
    assert.equal(depthAfter.depth, 1);
    assert.equal(depthAfter.pending, 1);
    assert.equal(depthAfter.active, 0);
    assert.equal(depthAfter.workerConnected, false);

    // Now connect a worker that auto-completes jobs
    const ws = await connectWorker(port);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'exec') {
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
        ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: 'output\n' }));
        ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
      }
    });

    // The job should complete now that a worker is connected
    const result = await jobPromise;
    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('output'));

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('dispatches immediately if worker is already connected', async () => {
    const ws = await connectWorker(port);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'exec') {
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
        ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
      }
    });

    const result = await enqueueJob({ cmd: 'test', args: [], cwd: '/tmp', env: {} });
    assert.equal(result.code, 0);

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('supports onStdout callback', async () => {
    const ws = await connectWorker(port);
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'exec') {
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
        ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: 'line1\n' }));
        ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: 'line2\n' }));
        ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
      }
    });

    const chunks = [];
    const result = await enqueueJob(
      { cmd: 'test', args: [], cwd: '/tmp', env: {} },
      { onStdout: (data) => chunks.push(data) }
    );
    assert.equal(result.code, 0);
    assert.equal(chunks.length, 2);
    assert.ok(chunks[0].includes('line1'));

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});

describe('getQueueDepth()', () => {
  it('returns zeros when queue is empty and no worker', () => {
    const depth = getQueueDepth();
    assert.equal(depth.depth, 0);
    assert.equal(depth.pending, 0);
    assert.equal(depth.active, 0);
    assert.equal(depth.workerConnected, false);
  });

  it('shows active=1 when a job is executing', async () => {
    const ws = await connectWorker(port);
    let resolveExec;
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'exec') {
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
        // Don't send exit — job stays active
        resolveExec = () => {
          ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
        };
      }
    });

    const jobPromise = enqueueJob({ cmd: 'slow', args: [], cwd: '/tmp', env: {} });
    await new Promise((r) => setTimeout(r, 100)); // Let dispatch happen

    const depth = getQueueDepth();
    assert.equal(depth.active, 1);
    assert.equal(depth.workerConnected, true);

    resolveExec(); // Complete the job
    await jobPromise;

    // After completion, depth should return to 0
    const depthAfter = getQueueDepth();
    assert.equal(depthAfter.depth, 0);
    assert.equal(depthAfter.pending, 0);
    assert.equal(depthAfter.active, 0);

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
```

Update the import at the top of the test file to include the new exports:

```javascript
import { initWorkerManager, getWorker, getWorkerStatus, shutdownWorkerManager, enqueueJob, getQueueDepth } from '../worker-manager.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/worker-manager.test.js`
Expected: FAIL — `enqueueJob` and `getQueueDepth` are not exported from `worker-manager.js`

- [ ] **Step 3: Implement `enqueueJob()` and `getQueueDepth()` in worker-manager.js**

Add these two functions to `Assetgenerator/worker-manager.js` before the existing `getWorker()` function (above line 168):

```javascript
export function enqueueJob(payload, { onStdout } = {}) {
  return new Promise((resolve, reject) => {
    const job = {
      jobId: randomUUID(),
      payload,
      resolve,
      reject,
      stdout: '',
      stderr: '',
      onStdout,
    };
    jobQueue.push(job);
    dispatchNext();
  });
}

export function getQueueDepth() {
  const active = worker?.currentJob ? 1 : 0;
  const pending = jobQueue.length;
  return {
    depth: pending + active,
    pending,
    active,
    workerConnected: !!worker,
  };
}
```

No changes to `dispatchNext()` needed — it already checks `!worker || worker.currentJob || jobQueue.length === 0` and dispatches when all conditions are met. When `enqueueJob()` is called without a worker, `dispatchNext()` returns immediately (worker is null). When a worker later registers (line 63), `dispatchNext()` is called again and dispatches the queued job.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/worker-manager.test.js`
Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/worker-manager.js Assetgenerator/test/worker-manager.test.js
git commit -m "feat(assetgen): add enqueueJob() and getQueueDepth() to worker-manager

Decouples job queuing from worker presence. Jobs now queue even when
no GPU worker is connected, enabling KEDA autoscaling based on depth."
```

---

### Task 2: Add `GET /api/queue-depth` route to server.js

**Files:**
- Modify: `Assetgenerator/server.js:8` (import line)
- Modify: `Assetgenerator/server.js` (add route near other status routes)

- [ ] **Step 1: Update import in server.js**

At `Assetgenerator/server.js:8`, change:
```javascript
import { initWorkerManager, getWorkerStatus } from './worker-manager.js';
```
to:
```javascript
import { initWorkerManager, getWorkerStatus, getQueueDepth } from './worker-manager.js';
```

- [ ] **Step 2: Add the route**

Find the existing `app.get('/api/worker-status', ...)` route in `server.js` and add the queue-depth route right after it:

```javascript
app.get('/api/queue-depth', (req, res) => {
  res.json(getQueueDepth());
});
```

- [ ] **Step 3: Add automated test for the route in `test/api.test.js`**

Add a test to `Assetgenerator/test/api.test.js` that hits the endpoint. Follow the existing pattern in that file for creating a test server:

```javascript
it('GET /api/queue-depth returns depth object', async () => {
  const res = await fetch(`${baseUrl}/api/queue-depth`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.depth, 'number');
  assert.equal(typeof data.pending, 'number');
  assert.equal(typeof data.active, 'number');
  assert.equal(typeof data.workerConnected, 'boolean');
  assert.equal(data.depth, 0);
});
```

- [ ] **Step 4: Run API tests**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/api.test.js`
Expected: All PASS (including new queue-depth test)

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/server.js Assetgenerator/test/api.test.js
git commit -m "feat(assetgen): add GET /api/queue-depth endpoint for KEDA polling"
```

---

### Task 3: Update adapters to use `enqueueJob()`

**Files:**
- Modify: `Assetgenerator/adapters/audiocraft.js`
- Modify: `Assetgenerator/adapters/blender.js`
- Modify: `Assetgenerator/adapters/triposr.js`
- Modify: `Assetgenerator/adapters/comfyui.js`
- Modify: `Assetgenerator/adapters/diffusers.js`

All 5 adapters follow the same pattern. For each:

1. Change import from `getWorker` to `enqueueJob`
2. Replace the `getWorker()` / `if (worker)` / `worker.exec()` / throw pattern with a single `await enqueueJob()` call

- [ ] **Step 1: Update `audiocraft.js`**

Change line 2:
```javascript
import { getWorker } from '../worker-manager.js';
```
to:
```javascript
import { enqueueJob } from '../worker-manager.js';
```

Replace lines 30-41 (the `getWorker()` block + throw):
```javascript
  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({ cmd: pythonPath, args, cwd: projectDir, env: {} });
    if (result.code !== 0) {
      throw new Error(`generate_audio.py exited ${result.code}: ${result.stderr}`);
    }
    const seedMatch = result.stdout.match(/SEED:(\d+)/);
    const actualSeed = seedMatch ? parseInt(seedMatch[1], 10) : seed;
    return { seed: actualSeed, stdout: result.stdout, stderr: result.stderr };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
```
with:
```javascript
  const result = await enqueueJob({ cmd: pythonPath, args, cwd: projectDir, env: {} });
  if (result.code !== 0) {
    throw new Error(`generate_audio.py exited ${result.code}: ${result.stderr}`);
  }
  const seedMatch = result.stdout.match(/SEED:(\d+)/);
  const actualSeed = seedMatch ? parseInt(seedMatch[1], 10) : seed;
  return { seed: actualSeed, stdout: result.stdout, stderr: result.stderr };
```

- [ ] **Step 2: Update `blender.js`**

Change line 3:
```javascript
import { getWorker } from '../worker-manager.js';
```
to:
```javascript
import { enqueueJob } from '../worker-manager.js';
```

Replace lines 36-51 (the `getWorker()` block + throw):
```javascript
  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({ cmd: blenderPath, args, cwd: PROJECT_ROOT, env: {} });
    if (result.code !== 0) throw new Error(`Blender render exited ${result.code}: ${result.stderr.slice(-500)}`);

    const frameMatch = result.stdout.match(/FRAMES:(\d+)|Rendered (\d+) frames/i);
    const frameCount = frameMatch ? parseInt(frameMatch[1] || frameMatch[2], 10) : 0;

    if (frameCount === 0) {
      throw new Error(`Blender rendered 0 frames for "${id}". Check model exists at ${modelPath}`);
    }

    return { status: 'done', frameCount, backend: 'blender' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
```
with:
```javascript
  const result = await enqueueJob({ cmd: blenderPath, args, cwd: PROJECT_ROOT, env: {} });
  if (result.code !== 0) throw new Error(`Blender render exited ${result.code}: ${result.stderr.slice(-500)}`);

  const frameMatch = result.stdout.match(/FRAMES:(\d+)|Rendered (\d+) frames/i);
  const frameCount = frameMatch ? parseInt(frameMatch[1] || frameMatch[2], 10) : 0;

  if (frameCount === 0) {
    throw new Error(`Blender rendered 0 frames for "${id}". Check model exists at ${modelPath}`);
  }

  return { status: 'done', frameCount, backend: 'blender' };
```

- [ ] **Step 3: Update `triposr.js`**

Change line 4:
```javascript
import { getWorker } from '../worker-manager.js';
```
to:
```javascript
import { enqueueJob } from '../worker-manager.js';
```

Replace lines 26-41:
```javascript
  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
    });
    if (result.code !== 0) throw new Error(`generate_3d.py exited ${result.code}: ${result.stderr}`);

    // Verify the output file was actually created on the shared filesystem
    if (!existsSync(outputPath)) {
      throw new Error(`generate_3d.py exited 0 but ${outputPath} was not created. Check worker has access to ${libraryRoot}`);
    }

    return { status: 'done', path: `models/${asset.category}/${id}.glb`, backend: 'triposr' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
```
with:
```javascript
  const result = await enqueueJob({
    cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
  });
  if (result.code !== 0) throw new Error(`generate_3d.py exited ${result.code}: ${result.stderr}`);

  // Verify the output file was actually created on the shared filesystem
  if (!existsSync(outputPath)) {
    throw new Error(`generate_3d.py exited 0 but ${outputPath} was not created. Check worker has access to ${libraryRoot}`);
  }

  return { status: 'done', path: `models/${asset.category}/${id}.glb`, backend: 'triposr' };
```

- [ ] **Step 4: Update `comfyui.js`**

Change line 3:
```javascript
import { getWorker } from '../worker-manager.js';
```
to:
```javascript
import { enqueueJob } from '../worker-manager.js';
```

Replace lines 24-33:
```javascript
  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
    });
    if (result.code !== 0) throw new Error(`generate_concepts.py exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'comfyui' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
```
with:
```javascript
  const result = await enqueueJob({
    cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
  });
  if (result.code !== 0) throw new Error(`generate_concepts.py exited ${result.code}: ${result.stderr}`);
  return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'comfyui' };
```

- [ ] **Step 5: Update `diffusers.js`**

Change line 3:
```javascript
import { getWorker } from '../worker-manager.js';
```
to:
```javascript
import { enqueueJob } from '../worker-manager.js';
```

Replace lines 24-33:
```javascript
  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
    });
    if (result.code !== 0) throw new Error(`generate_concepts.py (diffusers) exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'diffusers' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
```
with:
```javascript
  const result = await enqueueJob({
    cmd: workerPython, args, cwd: PROJECT_ROOT, env: {},
  });
  if (result.code !== 0) throw new Error(`generate_concepts.py (diffusers) exited ${result.code}: ${result.stderr}`);
  return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'diffusers' };
```

- [ ] **Step 6: Run all tests**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/worker-manager.test.js && node --test test/adapter-routing.test.js`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add Assetgenerator/adapters/audiocraft.js Assetgenerator/adapters/blender.js Assetgenerator/adapters/triposr.js Assetgenerator/adapters/comfyui.js Assetgenerator/adapters/diffusers.js
git commit -m "refactor(assetgen): adapters use enqueueJob() instead of getWorker().exec()

Jobs now queue regardless of worker presence. Removes 'No GPU worker
connected' errors — jobs wait for worker to connect instead of failing."
```

---

**Deferred:** The spec requires SSE endpoints to emit "waiting for GPU worker..." while jobs are queued without a worker. This is a UX enhancement that does not affect autoscaling functionality. The SSE endpoints will block silently (up to ~45s during cold start) until the worker connects. This can be added as a follow-up by checking `getQueueDepth().workerConnected === false` before calling `adapter.generate()` and emitting a status event to the SSE stream.

---

## Chunk 2: Worker Idle Timeout

### Task 4: Add idle timeout to worker/index.js

**Files:**
- Modify: `Assetgenerator/worker/index.js`
- Test: `Assetgenerator/worker/test/worker.test.js`

- [ ] **Step 1: Write failing tests for idle timeout**

Add to `Assetgenerator/worker/test/worker.test.js`, inside the existing `describe('GPU Worker')` block:

```javascript
describe('idle timeout', () => {
  it('exits after IDLE_TIMEOUT_MS with no jobs', async () => {
    const exitPromise = new Promise((resolve) => {
      // Mock process.exit
      const originalExit = process.exit;
      process.exit = (code) => {
        process.exit = originalExit;
        resolve(code);
      };
    });

    wss.once('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'register') { /* registered, no jobs sent */ }
      });
    });

    const worker = createWorker({
      url: `ws://127.0.0.1:${port}`,
      reconnectDelay: 100,
      idleTimeoutMs: 200, // 200ms for fast test
    });

    const exitCode = await exitPromise;
    assert.equal(exitCode, 0);
    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('resets idle timer on job completion', async () => {
    let exitCalled = false;
    const originalExit = process.exit;
    process.exit = () => { exitCalled = true; process.exit = originalExit; };

    wss.once('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'register') {
          // Send a job after 100ms (before 200ms timeout)
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'exec', jobId: 'idle-test', cmd: 'echo', args: ['hi'], cwd: '/tmp', env: {},
            }));
          }, 100);
        }
        if (msg.type === 'exit') {
          // Job done — idle timer should reset. Wait 150ms (less than 200ms timeout)
          setTimeout(() => {
            assert.equal(exitCalled, false, 'Should not have exited — timer was reset');
            process.exit = originalExit;
            ws.close();
          }, 150);
        }
      });
    });

    const worker = createWorker({
      url: `ws://127.0.0.1:${port}`,
      reconnectDelay: 100,
      idleTimeoutMs: 200,
    });

    await new Promise((r) => setTimeout(r, 500));
    worker.close();
  });

  it('keeps ticking across reconnect cycles', async () => {
    const exitPromise = new Promise((resolve) => {
      const originalExit = process.exit;
      process.exit = (code) => {
        process.exit = originalExit;
        resolve(code);
      };
    });

    // First connection — close it after register to force reconnect
    wss.once('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'register') {
          // Close connection after 50ms to force reconnect
          setTimeout(() => ws.close(), 50);
        }
      });
    });

    // Second connection — also no jobs
    wss.once('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
    });

    const worker = createWorker({
      url: `ws://127.0.0.1:${port}`,
      reconnectDelay: 50,
      idleTimeoutMs: 300, // Should fire even across reconnect
    });

    const exitCode = await exitPromise;
    assert.equal(exitCode, 0);
    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/patrick/projects/Assetgenerator/worker && node --test test/worker.test.js`
Expected: FAIL — `createWorker` does not accept `idleTimeoutMs` option and doesn't call `process.exit`

- [ ] **Step 3: Implement idle timeout in worker/index.js**

In `Assetgenerator/worker/index.js`, modify the `createWorker` function:

After line 31 (`let reconnectTimer = null;`), add:
```javascript
  const idleTimeoutMs = opts.idleTimeoutMs ?? parseInt(process.env.IDLE_TIMEOUT_MS || '0', 10);
  let idleTimer = null;

  function resetIdleTimer() {
    if (idleTimeoutMs <= 0) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.log(`Idle timeout (${idleTimeoutMs / 1000}s) reached, shutting down.`);
      process.exit(0);
    }, idleTimeoutMs);
  }

  function clearIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
```

In the `ws.on('message')` handler, add `resetIdleTimer()` after the `register` send (line 56):
```javascript
      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({
          type: 'register',
          hostname: hostname(),
          gpu: gpuName,
        }));
        console.log(`Registered as ${hostname()} (${gpuName})`);
        resetIdleTimer();
        return;
      }
```

Add `clearIdleTimer()` when an `exec` message arrives (at start of `if (msg.type === 'exec')` block, line 65):
```javascript
      if (msg.type === 'exec') {
        clearIdleTimer();
        console.log(`Job ${msg.jobId}: ${msg.cmd} ${msg.args.join(' ')}`);
        // ... rest unchanged
```

Add `resetIdleTimer()` in the `currentProc.on('close')` handler (after line 92 `currentProc = null;`):
```javascript
        currentProc.on('close', (code) => {
          console.log(`Job ${msg.jobId}: exit ${code}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: code ?? 1 }));
          }
          currentProc = null;
          resetIdleTimer();
        });
```

Also add `resetIdleTimer()` in the `currentProc.on('error')` handler (after line 101 `currentProc = null;`):
```javascript
        currentProc.on('error', (err) => {
          console.error(`Job ${msg.jobId}: spawn error: ${err.message}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stderr', jobId: msg.jobId, data: err.message }));
            ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 1 }));
          }
          currentProc = null;
          resetIdleTimer();
        });
```

**Critical: Do NOT clear the idle timer on WebSocket close** (line 116-123). The timer must keep ticking across reconnect cycles. The only thing that clears it is receiving an `exec` message.

In the `close()` method of the returned object, add `clearIdleTimer()`:
```javascript
  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      clearIdleTimer();
      if (currentProc) currentProc.kill('SIGTERM');
      if (ws) ws.close();
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/patrick/projects/Assetgenerator/worker && node --test test/worker.test.js`
Expected: All tests PASS (existing + new idle timeout tests)

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/worker/index.js Assetgenerator/worker/test/worker.test.js
git commit -m "feat(assetgen): add idle timeout to GPU worker

Worker exits after IDLE_TIMEOUT_MS (default: disabled, env var).
Timer ticks across reconnect cycles — only cleared by active jobs.
Enables scale-to-zero when managed by systemd + KEDA."
```

---

## Chunk 3: Kubernetes Manifests + Infrastructure

### Task 5: Create waker Dockerfile

**Files:**
- Create: `Assetgenerator/waker/Dockerfile`

- [ ] **Step 1: Create the waker directory and Dockerfile**

Run: `mkdir -p /home/patrick/projects/Assetgenerator/waker`

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache openssh-client
```

- [ ] **Step 2: Verify it builds**

Run: `docker build -t gpu-waker-test /home/patrick/projects/Assetgenerator/waker/`
Expected: Successfully builds (~8MB image)

- [ ] **Step 3: Commit**

```bash
git add Assetgenerator/waker/Dockerfile
git commit -m "feat(assetgen): add gpu-waker Dockerfile (alpine + openssh-client)"
```

---

### Task 6: Create KEDA deploy script

**Files:**
- Create: `k8s/scripts/deploy/deploy-keda.sh`

- [ ] **Step 1: Create the script**

```bash
#!/bin/bash
# =============================================================================
# Install KEDA (Kubernetes Event-Driven Autoscaling)
# =============================================================================
# Installs KEDA via Helm into the 'keda' namespace.
# Idempotent — safe to run multiple times (uses helm upgrade --install).
#
# Usage: ./deploy-keda.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

log_step "Installing KEDA"

log_info "Adding KEDA Helm repo..."
helm repo add kedacore https://kedacore.github.io/charts 2>/dev/null || true
helm repo update

log_info "Installing KEDA..."
helm upgrade --install keda kedacore/keda \
  --namespace keda --create-namespace \
  --wait --timeout 120s

log_info "KEDA installed successfully!"
kubectl get pods -n keda
```

- [ ] **Step 2: Make executable**

Run: `chmod +x /home/patrick/projects/k8s/scripts/deploy/deploy-keda.sh`

- [ ] **Step 3: Commit**

```bash
git add k8s/scripts/deploy/deploy-keda.sh
git commit -m "feat(k8s): add KEDA Helm install script"
```

---

### Task 7: Create waker Deployment manifest

**Files:**
- Create: `k8s/services/assetgenerator/gpu-waker-deployment.yaml`

- [ ] **Step 1: Create the manifest**

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
          imagePullPolicy: Always
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

- [ ] **Step 2: Validate YAML syntax**

Run: `kubectl apply --dry-run=client -f /home/patrick/projects/k8s/services/assetgenerator/gpu-waker-deployment.yaml`
Expected: `deployment.apps/gpu-waker created (dry run)`

- [ ] **Step 3: Commit**

```bash
git add k8s/services/assetgenerator/gpu-waker-deployment.yaml
git commit -m "feat(k8s): add gpu-waker Deployment manifest (KEDA-managed, replicas: 0)"
```

---

### Task 8: Create KEDA ScaledObject manifest

**Files:**
- Create: `k8s/services/assetgenerator/gpu-waker-scaledobject.yaml`

- [ ] **Step 1: Create the manifest**

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

- [ ] **Step 2: Commit**

```bash
git add k8s/services/assetgenerator/gpu-waker-scaledobject.yaml
git commit -m "feat(k8s): add KEDA ScaledObject for gpu-waker (metrics-api trigger)"
```

---

### Task 9: Update kustomization.yaml and skaffold.yaml

**Files:**
- Modify: `k8s/services/assetgenerator/kustomization.yaml`
- Modify: `k8s/skaffold.yaml`
- Modify: `k8s/scripts/deploy/deploy-assetgenerator.sh`

- [ ] **Step 1: Add waker resources to kustomization.yaml**

In `k8s/services/assetgenerator/kustomization.yaml`, add to the `resources` list:
```yaml
  - gpu-waker-deployment.yaml
  - gpu-waker-scaledobject.yaml
```

- [ ] **Step 2: Add gpu-waker image to skaffold.yaml**

In `k8s/skaffold.yaml`, find the `assetgenerator` profile (around line 260) and add the gpu-waker artifact:

```yaml
  - name: assetgenerator
    build:
      artifacts:
        - image: registry.korczewski.de/korczewski/assetgenerator
          context: ..
          docker:
            dockerfile: Assetgenerator/Dockerfile
        - image: registry.korczewski.de/korczewski/gpu-waker
          context: ../Assetgenerator/waker
    manifests:
      kustomize:
        paths:
          - services/assetgenerator
```

- [ ] **Step 3: Update deploy-assetgenerator.sh to build+push waker image**

In `k8s/scripts/deploy/deploy-assetgenerator.sh`, after the existing assetgenerator build+push block (lines 46-51), add:

```bash
    log_info "Building gpu-waker..."
    docker build -t "$REGISTRY/gpu-waker:latest" -f "$PROJECT_ROOT/Assetgenerator/waker/Dockerfile" "$PROJECT_ROOT/Assetgenerator/waker"

    log_info "Pushing gpu-waker..."
    docker push "$REGISTRY/gpu-waker:latest"
```

- [ ] **Step 4: Validate kustomize build**

Run: `kustomize build /home/patrick/projects/k8s/services/assetgenerator/`
Expected: Output includes gpu-waker Deployment and ScaledObject (ScaledObject may warn about unknown CRD — that's fine, KEDA CRDs aren't installed locally)

- [ ] **Step 5: Commit**

```bash
git add k8s/services/assetgenerator/kustomization.yaml k8s/skaffold.yaml k8s/scripts/deploy/deploy-assetgenerator.sh
git commit -m "feat(k8s): integrate gpu-waker into kustomize, skaffold, and deploy script"
```

---

## Chunk 4: Systemd Service + Deployment

### Task 10: Create systemd service file (committed to repo for reference)

**Files:**
- Create: `Assetgenerator/worker/gpu-worker.service`

This file is committed to the repo as a reference/template. The actual installation onto `10.10.0.3` is a manual step documented below.

- [ ] **Step 1: Create the service file**

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

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/worker/gpu-worker.service
git commit -m "feat(assetgen): add systemd user service file for GPU worker"
```

---

### Task 11: Run all tests and verify

- [ ] **Step 1: Run worker-manager tests**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/worker-manager.test.js`
Expected: All PASS

- [ ] **Step 2: Run worker tests**

Run: `cd /home/patrick/projects/Assetgenerator/worker && node --test test/worker.test.js`
Expected: All PASS

- [ ] **Step 3: Run adapter routing tests**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/adapter-routing.test.js`
Expected: All PASS

- [ ] **Step 4: Run full API tests**

Run: `cd /home/patrick/projects/Assetgenerator && node --test test/api.test.js`
Expected: All PASS

---

### Task 12: Deploy to production

This task covers the full deployment sequence. Each step must be done in order.

- [ ] **Step 1: Install KEDA on the cluster**

Run: `./k8s/scripts/deploy/deploy-keda.sh`
Expected: KEDA pods running in `keda` namespace

- [ ] **Step 2: Generate SSH keypair for waker**

```bash
ssh-keygen -t ed25519 -f /tmp/gpu-waker-key -N "" -C "gpu-waker@k8s"
```

- [ ] **Step 3: Add public key to authorized_keys on 10.10.0.3**

```bash
# Restrict to only allow starting the gpu-worker service
echo "command=\"systemctl --user start gpu-worker\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding $(cat /tmp/gpu-waker-key.pub)" >> ~/.ssh/authorized_keys
```

- [ ] **Step 4: Create k8s secret from private key**

```bash
kubectl create secret generic gpu-waker-ssh-key \
  --from-file=id_ed25519=/tmp/gpu-waker-key \
  -n korczewski-services
rm /tmp/gpu-waker-key /tmp/gpu-waker-key.pub
```

- [ ] **Step 5: Install systemd service on WSL2 machine**

```bash
mkdir -p ~/.config/systemd/user
cp /home/patrick/projects/Assetgenerator/worker/gpu-worker.service ~/.config/systemd/user/
loginctl enable-linger patrick
systemctl --user daemon-reload
```

Verify systemd works in WSL2:
```bash
grep -q 'systemd=true' /etc/wsl.conf || echo '[boot]\nsystemd=true' | sudo tee -a /etc/wsl.conf
```

- [ ] **Step 6: Test systemd service locally**

```bash
systemctl --user start gpu-worker
systemctl --user status gpu-worker
# Should show active (running) briefly, then exit after idle timeout
systemctl --user stop gpu-worker  # If still running
```

- [ ] **Step 7: Verify pod-to-LAN SSH connectivity**

```bash
kubectl run test-ssh --rm -it --restart=Never --image=alpine:3.20 -- \
  sh -c 'apk add --no-cache openssh-client && ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 patrick@10.10.0.3 echo ok 2>&1 || echo "SSH FAILED"'
```
Expected: Either "ok" or a connection confirmation. If "SSH FAILED", check firewall rules on 10.10.0.3.

- [ ] **Step 8: Build and deploy**

Run: `./k8s/scripts/deploy/deploy-assetgenerator.sh`
This builds both images (assetgenerator + gpu-waker), pushes to registry, applies all manifests including new waker + ScaledObject, and restarts.

- [ ] **Step 9: Verify deployment**

```bash
# Waker should be at 0 replicas
kubectl get deploy gpu-waker -n korczewski-services

# ScaledObject should exist
kubectl get scaledobject gpu-waker-scaler -n korczewski-services

# Queue depth should return 0
curl -s https://assetgen.korczewski.de/api/queue-depth
```

- [ ] **Step 10: End-to-end test**

1. Trigger a generation via the Assetgenerator UI (or `curl -X POST`)
2. Check queue depth: `curl -s https://assetgen.korczewski.de/api/queue-depth` → depth should be ≥ 1
3. Wait ~30s for KEDA poll cycle
4. Check waker pod: `kubectl get pods -l app=gpu-waker -n korczewski-services` → 1 running
5. Check worker connection: `curl -s https://assetgen.korczewski.de/api/worker-status` → `connected: true`
6. Wait for job to complete + idle timeout (10min)
7. Verify worker exited: `systemctl --user status gpu-worker` → inactive
8. Wait for cooldown (5min) → waker pod scales to 0
