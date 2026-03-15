# Assetgenerator Split Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Assetgenerator server in k3s with a remote GPU worker on the local workstation, connected via WebSocket.

**Architecture:** The Express server deploys to k3s (orchestration, UI, post-processing). A thin Node.js worker CLI runs on the workstation, connecting via WebSocket to receive shell commands for GPU-heavy generation. Both sides share NAS storage at `/mnt/pve3a/`. Cloud API backends (elevenlabs, meshy) run directly on the server.

**Tech Stack:** Node.js 22, Express, `ws` (WebSocket), Docker, k8s (k3s), SMB-CSI, Traefik

**Spec:** `docs/superpowers/specs/2026-03-15-assetgenerator-split-architecture-design.md`

---

## File Structure

```
Assetgenerator/
├── worker-manager.js              # NEW — Server-side WS manager (~120 lines)
├── worker/                        # NEW — GPU worker package
│   ├── index.js                   # WS client, spawns processes (~80 lines)
│   ├── package.json               # deps: ws
│   └── test/
│       └── worker.test.js         # Worker client unit tests
├── adapters/
│   ├── audiocraft.js              # MODIFIED — add worker routing
│   ├── comfyui.js                 # MODIFIED — add worker routing
│   ├── diffusers.js               # MODIFIED — add worker routing
│   ├── triposr.js                 # MODIFIED — add worker routing
│   ├── blender.js                 # MODIFIED — add worker routing
│   ├── packer.js                  # UNCHANGED — CPU-only
│   ├── elevenlabs.js              # UNCHANGED — cloud API
│   └── meshy.js                   # UNCHANGED — cloud API
├── server.js                      # MODIFIED — http.createServer, WS mount, health, worker-status
├── index.html                     # MODIFIED — worker status indicator
├── test/
│   ├── api.test.js                # UNCHANGED
│   ├── worker-manager.test.js     # NEW
│   └── adapter-routing.test.js    # NEW
├── Dockerfile                     # NEW
├── .dockerignore                  # NEW
└── package.json                   # MODIFIED — add ws dependency

k8s/
├── services/assetgenerator/       # NEW — all manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingressroute.yaml
│   ├── pv-audio.yaml
│   ├── pv-visual.yaml
│   ├── pvc.yaml
│   └── kustomization.yaml
├── scripts/deploy/
│   └── deploy-assetgenerator.sh   # NEW
└── skaffold.yaml                  # MODIFIED — add assetgenerator profile

arena/scripts/
└── generate_audio.py              # MODIFIED — add --output flag
```

---

## Chunk 1: Worker Manager (Server-Side)

### Task 1: Write worker-manager tests

**Files:**
- Create: `Assetgenerator/test/worker-manager.test.js`

- [ ] **Step 1: Create test file with all test cases**

```js
/**
 * Worker Manager Tests
 *
 * Tests the server-side WebSocket manager that handles GPU worker connections.
 * Uses mock WebSocket servers — no real worker or GPU needed.
 *
 * Run: cd Assetgenerator && node --test test/worker-manager.test.js
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { initWorkerManager, getWorker, getWorkerStatus, shutdownWorkerManager } from '../worker-manager.js';

// Helper: create a minimal HTTP server for testing
function createTestServer() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

// Helper: create a WS client that connects as a worker
function connectWorker(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/worker`);
    ws.on('open', () => {
      // Wait for welcome, then register
      ws.once('message', (raw) => {
        const msg = JSON.parse(raw);
        assert.equal(msg.type, 'welcome');
        ws.send(JSON.stringify({ type: 'register', hostname: 'test-pc', gpu: 'RTX Test' }));
        // Give server time to process register
        setTimeout(() => resolve(ws), 50);
      });
    });
    ws.on('error', reject);
  });
}

describe('WorkerManager', () => {
  let httpServer, port;

  before(async () => {
    ({ server: httpServer, port } = await createTestServer());
    initWorkerManager(httpServer, { pingInterval: 500, pongTimeout: 200 });
  });

  after(async () => {
    shutdownWorkerManager();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  describe('connection lifecycle', () => {
    it('getWorker() returns null when no worker connected', () => {
      const worker = getWorker();
      assert.equal(worker, null);
    });

    it('getWorkerStatus() shows disconnected when no worker', () => {
      const status = getWorkerStatus();
      assert.equal(status.connected, false);
      assert.equal(status.hostname, null);
      assert.equal(status.gpu, null);
    });

    it('getWorker() returns truthy after worker connects and registers', async () => {
      const ws = await connectWorker(port);
      const worker = getWorker();
      assert.ok(worker);
      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });

    it('getWorkerStatus() shows connected with hostname and gpu', async () => {
      const ws = await connectWorker(port);
      const status = getWorkerStatus();
      assert.equal(status.connected, true);
      assert.equal(status.hostname, 'test-pc');
      assert.equal(status.gpu, 'RTX Test');
      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });

    it('getWorker() returns null after worker disconnects', async () => {
      const ws = await connectWorker(port);
      assert.ok(getWorker());
      ws.close();
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(getWorker(), null);
    });

    it('rejects second worker connection', async () => {
      const ws1 = await connectWorker(port);
      const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws/worker`);
      // Server rejects at HTTP upgrade level (403), so WS never opens.
      // ws client fires 'error' then 'close' with code 1006 (abnormal).
      const result = await new Promise((resolve) => {
        ws2.on('error', () => {}); // suppress unhandled error
        ws2.on('close', (code) => resolve(code));
      });
      assert.ok([1006, 1005].includes(result), `Expected 1006 or 1005, got ${result}`);
      ws1.close();
      await new Promise((r) => setTimeout(r, 100));
    });
  });

  describe('exec()', () => {
    it('sends exec message and resolves on exit', async () => {
      const ws = await connectWorker(port);

      // Listen for exec message on worker side
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'exec') {
          ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
          ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: 'SEED:12345\n' }));
          ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
        }
      });

      const worker = getWorker();
      const result = await worker.exec({ cmd: 'echo', args: ['hello'], cwd: '/tmp', env: {} });
      assert.equal(result.code, 0);
      assert.ok(result.stdout.includes('SEED:12345'));

      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });

    it('collects stderr in result', async () => {
      const ws = await connectWorker(port);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'exec') {
          ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
          ws.send(JSON.stringify({ type: 'stderr', jobId: msg.jobId, data: 'warning: something\n' }));
          ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
        }
      });

      const worker = getWorker();
      const result = await worker.exec({ cmd: 'test', args: [], cwd: '/tmp', env: {} });
      assert.ok(result.stderr.includes('warning: something'));

      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });

    it('rejects when worker disconnects mid-job', async () => {
      const ws = await connectWorker(port);

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'exec') {
          ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
          // Disconnect without sending exit
          ws.close();
        }
      });

      const worker = getWorker();
      await assert.rejects(
        () => worker.exec({ cmd: 'test', args: [], cwd: '/tmp', env: {} }),
        /disconnect/i
      );

      await new Promise((r) => setTimeout(r, 100));
    });

    it('queues second job while first is running', async () => {
      const ws = await connectWorker(port);
      const jobOrder = [];

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'exec') {
          jobOrder.push(msg.jobId);
          ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
          // Complete after short delay
          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
          }, 50);
        }
      });

      const worker = getWorker();
      const [r1, r2] = await Promise.all([
        worker.exec({ cmd: 'job1', args: [], cwd: '/tmp', env: {} }),
        worker.exec({ cmd: 'job2', args: [], cwd: '/tmp', env: {} }),
      ]);

      assert.equal(r1.code, 0);
      assert.equal(r2.code, 0);
      assert.equal(jobOrder.length, 2);

      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });
  });

  describe('heartbeat', () => {
    it('marks worker disconnected on missed pong', async () => {
      const ws = await connectWorker(port);
      assert.ok(getWorker());

      // Don't respond to pings — wait for timeout
      // pingInterval=500ms, pongTimeout=200ms → disconnect at ~700ms
      // Use 1500ms for CI safety margin
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(getWorker(), null);

      ws.close();
      await new Promise((r) => setTimeout(r, 100));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd Assetgenerator && node --test test/worker-manager.test.js`
Expected: FAIL — `worker-manager.js` doesn't exist yet

- [ ] **Step 3: Commit test file**

```bash
git add Assetgenerator/test/worker-manager.test.js
git commit -m "test: add worker-manager unit tests (red)"
```

---

### Task 2: Implement worker-manager.js

**Files:**
- Create: `Assetgenerator/worker-manager.js`
- Modify: `Assetgenerator/package.json` (add `ws` dependency)

- [ ] **Step 1: Install ws dependency**

```bash
cd Assetgenerator && npm install ws
```

- [ ] **Step 2: Write worker-manager.js**

```js
/**
 * Worker Manager — server-side WebSocket manager for GPU worker connections.
 *
 * Accepts a single worker connection on /ws/worker. Dispatches exec commands
 * and returns Promises that resolve with { stdout, stderr, code }.
 *
 * Usage:
 *   import { initWorkerManager, getWorker, getWorkerStatus } from './worker-manager.js';
 *   initWorkerManager(httpServer);
 */

import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

let wss = null;
let worker = null; // { ws, hostname, gpu, currentJob }
let pingTimer = null;
let pongTimer = null;
let jobQueue = []; // { jobId, payload, resolve, reject, stdout, stderr }

// Configurable for testing
let PING_INTERVAL = 30_000;
let PONG_TIMEOUT = 10_000;

export function initWorkerManager(httpServer, opts = {}) {
  PING_INTERVAL = opts.pingInterval ?? 30_000;
  PONG_TIMEOUT = opts.pongTimeout ?? 10_000;

  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws/worker') {
      if (worker) {
        // Reject second connection
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    // Send welcome
    ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'register') {
        worker = { ws, hostname: msg.hostname, gpu: msg.gpu, currentJob: null };
        startHeartbeat();
        // If there's a queued job, dispatch it
        dispatchNext();
        return;
      }

      if (msg.type === 'pong') {
        clearTimeout(pongTimer);
        return;
      }

      // Job-related messages
      if (!worker?.currentJob) return;
      const job = worker.currentJob;

      if (msg.type === 'ack') {
        // Job acknowledged — nothing extra to do
        return;
      }

      if (msg.type === 'stdout') {
        job.stdout += msg.data;
        if (job.onStdout) job.onStdout(msg.data);
        return;
      }

      if (msg.type === 'stderr') {
        job.stderr += msg.data;
        return;
      }

      if (msg.type === 'exit') {
        const { resolve } = job;
        const result = { stdout: job.stdout, stderr: job.stderr, code: msg.code };
        worker.currentJob = null;
        resolve(result);
        dispatchNext();
        return;
      }
    });

    ws.on('close', () => {
      const currentJob = worker?.currentJob;
      stopHeartbeat();
      worker = null;

      // Reject current in-flight job
      if (currentJob) {
        currentJob.reject(new Error('Worker disconnected during job'));
      }
      // Reject all queued jobs
      for (const job of jobQueue) {
        job.reject(new Error('Worker disconnected'));
      }
      jobQueue = [];
    });

    ws.on('error', () => {
      ws.close();
    });
  });
}

function startHeartbeat() {
  stopHeartbeat();
  pingTimer = setInterval(() => {
    if (!worker) return;
    worker.ws.send(JSON.stringify({ type: 'ping' }));
    pongTimer = setTimeout(() => {
      // No pong received — disconnect
      if (worker) {
        worker.ws.close();
      }
    }, PONG_TIMEOUT);
  }, PING_INTERVAL);
}

function stopHeartbeat() {
  clearInterval(pingTimer);
  clearTimeout(pongTimer);
  pingTimer = null;
  pongTimer = null;
}

function dispatchNext() {
  if (!worker || worker.currentJob || jobQueue.length === 0) return;
  const job = jobQueue.shift();
  worker.currentJob = job;
  worker.ws.send(JSON.stringify({
    type: 'exec',
    jobId: job.jobId,
    cmd: job.payload.cmd,
    args: job.payload.args,
    cwd: job.payload.cwd,
    env: job.payload.env || {},
  }));
}

/**
 * Returns a worker proxy with exec(), or null if no worker connected.
 */
export function getWorker() {
  if (!worker) return null;
  return {
    exec(payload, { onStdout } = {}) {
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
    },
  };
}

/**
 * Returns worker connection status for the UI.
 */
export function getWorkerStatus() {
  return {
    connected: !!worker,
    hostname: worker?.hostname ?? null,
    gpu: worker?.gpu ?? null,
    currentJob: worker?.currentJob?.jobId ?? null,
  };
}

/**
 * Shuts down the WebSocket server (for tests).
 */
export function shutdownWorkerManager() {
  stopHeartbeat();
  if (worker) {
    worker.ws.close();
    worker = null;
  }
  jobQueue = [];
  if (wss) {
    wss.close();
    wss = null;
  }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd Assetgenerator && node --test test/worker-manager.test.js`
Expected: All tests PASS

- [ ] **Step 4: Run existing tests to verify no regression**

Run: `cd Assetgenerator && node --test test/api.test.js`
Expected: All tests PASS (unchanged)

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/worker-manager.js Assetgenerator/package.json Assetgenerator/package-lock.json
git commit -m "feat(assetgenerator): add worker-manager WebSocket module"
```

---

### Task 3: Wire worker-manager into server.js

**Files:**
- Modify: `Assetgenerator/server.js:1-13` (add http import, refactor createServer)
- Modify: `Assetgenerator/server.js:1209-1234` (use httpServer.listen)

- [ ] **Step 1: Add imports at top of server.js**

At the top of `Assetgenerator/server.js`, after the existing imports (line 6), add:

```js
import { createServer } from 'node:http';
import { initWorkerManager, getWorkerStatus } from './worker-manager.js';
```

- [ ] **Step 2: Refactor app.listen to http.createServer**

Replace `Assetgenerator/server.js` line 1209:
```js
app.listen(PORT, async () => {
```
With:
```js
const httpServer = createServer(app);
initWorkerManager(httpServer);

httpServer.listen(PORT, async () => {
```

- [ ] **Step 3: Move library state files to NAS (persistent storage)**

The `library.json` and `visual-library.json` are written to `__dirname` (which is `/app/` in Docker — ephemeral). Move them to the NAS mounts so state survives pod restarts.

In `Assetgenerator/server.js`, replace lines 98-99:
```js
const LIBRARY_PATH = join(__dirname, 'library.json');
const VISUAL_LIBRARY_PATH = join(__dirname, 'visual-library.json');
```
With:
```js
const config = JSON.parse(readFileSync(join(__dirname, 'config', 'library-config.json'), 'utf-8'));
const vConfigBoot = JSON.parse(readFileSync(join(__dirname, 'config', 'visual-config.json'), 'utf-8'));
const LIBRARY_PATH = join(config.libraryRoot, 'library.json');
const VISUAL_LIBRARY_PATH = join(vConfigBoot.libraryRoot, 'visual-library.json');
```

This writes `library.json` to `/mnt/pve3a/audio-library/library.json` and `visual-library.json` to `/mnt/pve3a/visual-library/visual-library.json` — both on persistent NAS volumes. The server and the workstation can both access these files.

**Note:** For local dev (where NAS might not be mounted), the `loadLibrary()` / `loadVisualLibrary()` functions already return empty defaults if the file doesn't exist — so this gracefully degrades.

- [ ] **Step 4: Add health and worker-status endpoints**

Before the static serving section (~line 1203), add:

```js
// Health endpoint (k8s probes)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Worker status endpoint (UI polling)
app.get('/api/worker-status', (req, res) => {
  res.json(getWorkerStatus());
});
```

- [ ] **Step 5: Run existing tests**

Run: `cd Assetgenerator && node --test test/api.test.js`
Expected: All tests PASS

- [ ] **Step 6: Smoke test locally**

Run: `cd Assetgenerator && node server.js --project arena`
Expected: Server starts on port 5200. `curl http://localhost:5200/health` returns `{"status":"ok",...}`. `curl http://localhost:5200/api/worker-status` returns `{"connected":false,...}`.

- [ ] **Step 7: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): wire worker-manager into server, add health + status endpoints, persist state to NAS"
```

---

## Chunk 2: GPU Worker + Adapter Routing

### Task 4: Write GPU worker tests

**Files:**
- Create: `Assetgenerator/worker/test/worker.test.js`
- Create: `Assetgenerator/worker/package.json`

- [ ] **Step 1: Create worker package.json**

```json
{
  "name": "assetgenerator-worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "test": "node --test test/worker.test.js"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd Assetgenerator/worker && npm install
```

- [ ] **Step 3: Create worker test file**

```js
/**
 * GPU Worker Client Tests
 *
 * Tests the worker CLI that connects to the server and executes commands.
 * Uses a mock WebSocket server — no real server or GPU needed.
 *
 * Run: cd Assetgenerator/worker && node --test test/worker.test.js
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createWorker } from '../index.js';

function createMockServer() {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const wss = new WebSocketServer({ server: httpServer });
    httpServer.listen(0, '127.0.0.1', () => {
      const port = httpServer.address().port;
      resolve({ httpServer, wss, port });
    });
  });
}

describe('GPU Worker', () => {
  let mockServer, wss, port;

  before(async () => {
    ({ httpServer: mockServer, wss, port } = await createMockServer());
  });

  after(async () => {
    wss.close();
    await new Promise((r) => mockServer.close(r));
  });

  it('connects, receives welcome, sends register', async () => {
    const registered = new Promise((resolve) => {
      wss.once('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw);
          if (msg.type === 'register') resolve(msg);
        });
      });
    });

    const worker = createWorker({ url: `ws://127.0.0.1:${port}`, reconnectDelay: 100 });
    const msg = await registered;

    assert.equal(msg.type, 'register');
    assert.ok(msg.hostname);
    assert.ok(msg.gpu);

    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('spawns process on exec and streams stdout back', async () => {
    const exitReceived = new Promise((resolve) => {
      wss.once('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
        const messages = [];
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw);
          messages.push(msg);
          if (msg.type === 'register') {
            ws.send(JSON.stringify({
              type: 'exec',
              jobId: 'test-1',
              cmd: 'echo',
              args: ['hello world'],
              cwd: '/tmp',
              env: {},
            }));
          }
          if (msg.type === 'exit') resolve(messages);
        });
      });
    });

    const worker = createWorker({ url: `ws://127.0.0.1:${port}`, reconnectDelay: 100 });
    const messages = await exitReceived;

    const ack = messages.find((m) => m.type === 'ack');
    assert.ok(ack);
    assert.equal(ack.jobId, 'test-1');

    const stdout = messages.filter((m) => m.type === 'stdout');
    const combined = stdout.map((m) => m.data).join('');
    assert.ok(combined.includes('hello world'));

    const exit = messages.find((m) => m.type === 'exit');
    assert.equal(exit.code, 0);

    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('responds to ping with pong', async () => {
    const pongReceived = new Promise((resolve) => {
      wss.once('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw);
          if (msg.type === 'register') {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
          if (msg.type === 'pong') resolve(msg);
        });
      });
    });

    const worker = createWorker({ url: `ws://127.0.0.1:${port}`, reconnectDelay: 100 });
    const msg = await pongReceived;
    assert.equal(msg.type, 'pong');

    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('kills process on cancel', async () => {
    const exitReceived = new Promise((resolve) => {
      wss.once('connection', (ws) => {
        ws.send(JSON.stringify({ type: 'welcome', serverVersion: '1.0' }));
        ws.on('message', (raw) => {
          const msg = JSON.parse(raw);
          if (msg.type === 'register') {
            // Start a long-running process
            ws.send(JSON.stringify({
              type: 'exec',
              jobId: 'cancel-test',
              cmd: 'sleep',
              args: ['30'],
              cwd: '/tmp',
              env: {},
            }));
          }
          if (msg.type === 'ack') {
            // Cancel immediately
            setTimeout(() => {
              ws.send(JSON.stringify({ type: 'cancel', jobId: 'cancel-test' }));
            }, 100);
          }
          if (msg.type === 'exit') resolve(msg);
        });
      });
    });

    const worker = createWorker({ url: `ws://127.0.0.1:${port}`, reconnectDelay: 100 });
    const exit = await exitReceived;

    // SIGTERM causes non-zero exit
    assert.notEqual(exit.code, 0);
    assert.equal(exit.jobId, 'cancel-test');

    worker.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd Assetgenerator/worker && node --test test/worker.test.js`
Expected: FAIL — `createWorker` not exported from `index.js` (doesn't exist yet)

- [ ] **Step 5: Commit test files**

```bash
git add Assetgenerator/worker/package.json Assetgenerator/worker/package-lock.json Assetgenerator/worker/test/worker.test.js
git commit -m "test: add GPU worker client unit tests (red)"
```

---

### Task 5: Implement GPU worker

**Files:**
- Create: `Assetgenerator/worker/index.js`

- [ ] **Step 1: Write worker/index.js**

```js
/**
 * GPU Worker — thin WebSocket client that connects to the Assetgenerator server
 * and executes shell commands on the local machine (with GPU access).
 *
 * Usage:
 *   cd Assetgenerator/worker && npm start
 *   # Or: WORKER_SERVER_URL=wss://assetgen.korczewski.de/ws/worker npm start
 *
 * The worker:
 * 1. Connects to the server via WebSocket
 * 2. Registers with hostname and GPU info
 * 3. Receives exec commands, spawns processes via child_process.spawn()
 * 4. Streams stdout/stderr back to server
 * 5. Reports exit codes
 * 6. Auto-reconnects on disconnect
 */

import WebSocket from 'ws';
import { spawn, execSync } from 'node:child_process';
import { hostname } from 'node:os';

const DEFAULT_URL = 'wss://assetgen.korczewski.de/ws/worker';
const DEFAULT_RECONNECT_DELAY = 5000;

function detectGpu() {
  try {
    const output = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', { encoding: 'utf-8', timeout: 5000 });
    return output.trim().split('\n')[0] || 'Unknown GPU';
  } catch {
    return 'No GPU detected';
  }
}

export function createWorker(opts = {}) {
  const url = opts.url || process.env.WORKER_SERVER_URL || DEFAULT_URL;
  const reconnectDelay = opts.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
  const gpuName = opts.gpu || detectGpu();

  let ws = null;
  let currentProc = null;
  let closed = false;
  let reconnectTimer = null;

  function connect() {
    if (closed) return;
    ws = new WebSocket(url);

    ws.on('open', () => {
      console.log(`Connected to ${url}`);
    });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'welcome') {
        ws.send(JSON.stringify({
          type: 'register',
          hostname: hostname(),
          gpu: gpuName,
        }));
        console.log(`Registered as ${hostname()} (${gpuName})`);
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'exec') {
        console.log(`Job ${msg.jobId}: ${msg.cmd} ${msg.args.join(' ')}`);
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));

        currentProc = spawn(msg.cmd, msg.args, {
          cwd: msg.cwd,
          env: { ...process.env, ...(msg.env || {}) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        currentProc.stdout.on('data', (d) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: d.toString() }));
          }
        });

        currentProc.stderr.on('data', (d) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stderr', jobId: msg.jobId, data: d.toString() }));
          }
        });

        currentProc.on('close', (code) => {
          console.log(`Job ${msg.jobId}: exit ${code}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: code ?? 1 }));
          }
          currentProc = null;
        });

        currentProc.on('error', (err) => {
          console.error(`Job ${msg.jobId}: spawn error: ${err.message}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stderr', jobId: msg.jobId, data: err.message }));
            ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 1 }));
          }
          currentProc = null;
        });

        return;
      }

      if (msg.type === 'cancel') {
        if (currentProc) {
          console.log(`Job ${msg.jobId}: cancelling`);
          currentProc.kill('SIGTERM');
        }
        return;
      }
    });

    ws.on('close', () => {
      console.log('Disconnected.');
      ws = null;
      if (!closed) {
        console.log(`Reconnecting in ${reconnectDelay / 1000}s...`);
        reconnectTimer = setTimeout(connect, reconnectDelay);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error: ${err.message}`);
    });
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      if (currentProc) currentProc.kill('SIGTERM');
      if (ws) ws.close();
    },
  };
}

// If run directly (not imported as module), start the worker
import { fileURLToPath as workerFileURLToPath } from 'node:url';
import { resolve as workerResolve } from 'node:path';
const isMainModule = process.argv[1] && workerFileURLToPath(import.meta.url) === workerResolve(process.argv[1]);
if (isMainModule) {
  console.log('Starting GPU worker...');
  createWorker();
}
```

- [ ] **Step 2: Run worker tests**

Run: `cd Assetgenerator/worker && node --test test/worker.test.js`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add Assetgenerator/worker/index.js
git commit -m "feat(assetgenerator): add GPU worker client"
```

---

### Task 6: Write adapter routing tests

**Files:**
- Create: `Assetgenerator/test/adapter-routing.test.js`

- [ ] **Step 1: Create adapter routing test file**

```js
/**
 * Adapter Routing Tests
 *
 * Tests that GPU adapters route to worker when connected,
 * and throw when disconnected. Cloud adapters always run locally.
 *
 * Run: cd Assetgenerator && node --test test/adapter-routing.test.js
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { initWorkerManager, getWorker, shutdownWorkerManager } from '../worker-manager.js';

function createTestServer() {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function connectWorker(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/worker`);
    ws.on('open', () => {
      ws.once('message', (raw) => {
        const msg = JSON.parse(raw);
        assert.equal(msg.type, 'welcome');
        ws.send(JSON.stringify({ type: 'register', hostname: 'test', gpu: 'Test GPU' }));
        setTimeout(() => resolve(ws), 50);
      });
    });
    ws.on('error', reject);
  });
}

describe('Adapter Routing', () => {
  let httpServer, port;

  before(async () => {
    ({ server: httpServer, port } = await createTestServer());
    initWorkerManager(httpServer);
  });

  after(async () => {
    shutdownWorkerManager();
    await new Promise((r) => httpServer.close(r));
  });

  it('getWorker() returns exec-capable proxy when worker connected', async () => {
    const ws = await connectWorker(port);

    // Mock: worker auto-completes any exec
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'exec') {
        ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
        ws.send(JSON.stringify({ type: 'stdout', jobId: msg.jobId, data: 'SEED:99999\n' }));
        ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
      }
    });

    const worker = getWorker();
    assert.ok(worker);
    const result = await worker.exec({ cmd: 'python3', args: ['test.py'], cwd: '/tmp', env: {} });
    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('SEED:99999'));

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });

  it('getWorker() returns null when no worker — adapter should throw', async () => {
    const worker = getWorker();
    assert.equal(worker, null);
    // Adapter pattern: if (!worker) throw new Error('No GPU worker connected')
  });

  it('exec message has correct shape', async () => {
    const ws = await connectWorker(port);
    const execReceived = new Promise((resolve) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'exec') {
          ws.send(JSON.stringify({ type: 'ack', jobId: msg.jobId }));
          ws.send(JSON.stringify({ type: 'exit', jobId: msg.jobId, code: 0 }));
          resolve(msg);
        }
      });
    });

    const worker = getWorker();
    worker.exec({ cmd: 'python3', args: ['--version'], cwd: '/home/test', env: { CUDA: '0' } });
    const msg = await execReceived;

    assert.equal(msg.type, 'exec');
    assert.ok(msg.jobId);
    assert.equal(msg.cmd, 'python3');
    assert.deepEqual(msg.args, ['--version']);
    assert.equal(msg.cwd, '/home/test');
    assert.deepEqual(msg.env, { CUDA: '0' });

    ws.close();
    await new Promise((r) => setTimeout(r, 100));
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd Assetgenerator && node --test test/adapter-routing.test.js`
Expected: All tests PASS (uses already-implemented worker-manager)

- [ ] **Step 3: Commit**

```bash
git add Assetgenerator/test/adapter-routing.test.js
git commit -m "test: add adapter routing tests"
```

---

### Task 7: Add worker routing to GPU adapters

**Files:**
- Modify: `Assetgenerator/adapters/audiocraft.js`
- Modify: `Assetgenerator/adapters/comfyui.js`
- Modify: `Assetgenerator/adapters/diffusers.js`
- Modify: `Assetgenerator/adapters/triposr.js`
- Modify: `Assetgenerator/adapters/blender.js`

- [ ] **Step 1: Modify audiocraft.js**

Add import at top:
```js
import { getWorker } from '../worker-manager.js';
```

Replace the body of the `generate` function. The remote path parses SEED from stdout and skips `copyFileSync` (worker writes to NAS). The local path is replaced with a "no worker" error.

**Important**: `projectConfig._basePath` is set to `__dirname` in server.js (which is `/app` in Docker). Script paths derived from it won't exist on the worker. Use `ASSETGENERATOR_ROOT` env var to resolve paths that the worker will execute:

```js
export async function generate({ id, type, prompt, seed, duration, outputPath, projectConfig }) {
  const basePath = process.env.ASSETGENERATOR_ROOT || projectConfig._basePath;
  const scriptPath = resolve(basePath, projectConfig.generateScript);
  const pythonPath = projectConfig.pythonPath
    ? resolve(basePath, projectConfig.pythonPath)
    : 'python3';
  const projectDir = resolve(basePath, projectConfig.audioRoot, '..', '..');

  const args = [
    scriptPath,
    '--id', id,
    '--type', type,
    '--backend', 'audiocraft',
    '--force',
  ];

  if (prompt) args.push('--prompt', prompt);
  if (seed != null) args.push('--seed', String(seed));
  if (duration != null) args.push('--duration', String(duration));
  if (outputPath) args.push('--output', outputPath);

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
}
```

- [ ] **Step 2: Modify comfyui.js**

Add import at top and update `SCRIPTS_DIR` to use `ASSETGENERATOR_ROOT` (the old `__dirname`-based path resolves to `/app` in Docker, but scripts run on the worker where the repo is at a different path):
```js
import { getWorker } from '../worker-manager.js';
```

Replace the `SCRIPTS_DIR` line:
```js
const SCRIPTS_DIR = resolve(process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), 'scripts');
```

Replace the `generate` function body:

```js
export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_concepts.py');
  const outputDir = join(libraryRoot, 'concepts', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--category', asset.category,
    '--backend', 'auto',
  ];

  if (asset.prompt) args.push('--prompt', asset.prompt);
  args.push('--output', outputDir);

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: 'python3', args, cwd: process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), env: {},
    });
    if (result.code !== 0) throw new Error(`generate_concepts.py exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'comfyui' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
```

- [ ] **Step 3: Modify diffusers.js**

Same pattern as comfyui.js. Add import, update `SCRIPTS_DIR`, replace function body:

```js
import { getWorker } from '../worker-manager.js';
```

Replace `SCRIPTS_DIR`:
```js
const SCRIPTS_DIR = resolve(process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), 'scripts');
```

```js
export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_concepts.py');
  const outputDir = join(libraryRoot, 'concepts', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--category', asset.category,
    '--backend', 'diffusers',
  ];

  if (asset.prompt) args.push('--prompt', asset.prompt);
  args.push('--output', outputDir);

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: 'python3', args, cwd: process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), env: {},
    });
    if (result.code !== 0) throw new Error(`generate_concepts.py (diffusers) exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `concepts/${asset.category}/${id}.png`, backend: 'diffusers' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
```

- [ ] **Step 4: Modify triposr.js**

Add import, update `SCRIPTS_DIR`, replace function body:

```js
import { getWorker } from '../worker-manager.js';
```

Replace `SCRIPTS_DIR`:
```js
const SCRIPTS_DIR = resolve(process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), 'scripts');
```

```js
export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_3d.py');
  const conceptPath = join(libraryRoot, 'concepts', asset.category, `${id}.png`);
  const outputDir = join(libraryRoot, 'models', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--backend', 'triposr',
    '--input', conceptPath,
    '--output', outputDir,
  ];

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: 'python3', args, cwd: process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), env: {},
    });
    if (result.code !== 0) throw new Error(`generate_3d.py exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `models/${asset.category}/${id}.glb`, backend: 'triposr' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
```

- [ ] **Step 5: Modify blender.js**

Add import, update `SCRIPTS_DIR`, replace function body. Blender adapter parses frame count from stdout instead of `readdirSync`:

```js
import { getWorker } from '../worker-manager.js';
```

Replace `SCRIPTS_DIR`:
```js
const SCRIPTS_DIR = resolve(process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), 'scripts');
```

```js
export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'render_sprites.py');
  const modelPath = join(libraryRoot, 'models', asset.category, `${id}.glb`);
  const templatePath = join(libraryRoot, 'blend', TEMPLATE_MAP[asset.category] || 'character.blend');
  const outputDir = join(libraryRoot, 'renders', asset.category);
  const blenderPath = config.blenderPath || 'blender';

  const args = [
    '--background',
    '--python', scriptPath,
    '--',
    '--id', id,
    '--category', asset.category,
    '--model', modelPath,
    '--template', templatePath,
    '--output', outputDir,
  ];

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({ cmd: blenderPath, args, cwd: process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), env: {} });
    if (result.code !== 0) throw new Error(`Blender render exited ${result.code}: ${result.stderr.slice(-500)}`);

    // Parse frame count from Blender stdout (e.g., "Rendered 48 frames")
    const frameMatch = result.stdout.match(/FRAMES:(\d+)|Rendered (\d+) frames/i);
    const frameCount = frameMatch ? parseInt(frameMatch[1] || frameMatch[2], 10) : 0;

    return { status: 'done', frameCount, backend: 'blender' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
```

- [ ] **Step 6: Run all tests**

Run: `cd Assetgenerator && node --test test/api.test.js && node --test test/worker-manager.test.js && node --test test/adapter-routing.test.js`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add Assetgenerator/adapters/audiocraft.js Assetgenerator/adapters/comfyui.js Assetgenerator/adapters/diffusers.js Assetgenerator/adapters/triposr.js Assetgenerator/adapters/blender.js
git commit -m "feat(assetgenerator): add worker routing to GPU adapters"
```

---

### Task 8: Add --output flag to generate_audio.py

**Files:**
- Modify: `arena/scripts/generate_audio.py`

- [ ] **Step 1: Find the argparse section in generate_audio.py**

Run: `grep -n 'add_argument\|argparse\|ArgumentParser' arena/scripts/generate_audio.py`
Expected: Shows the argument parsing section with existing flags like `--id`, `--type`, `--backend`

- [ ] **Step 2: Add --output argument**

In the argparse section, add after the existing arguments:

```python
parser.add_argument('--output', type=str, default=None, help='Write WAV directly to this path instead of the default location')
```

- [ ] **Step 3: Use --output in the generation code**

Find where the script writes the output WAV file. Add a check: if `args.output` is provided, copy/write the WAV to that path after generation:

```python
if args.output:
    import shutil
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    shutil.copy2(output_wav_path, args.output)
```

The exact insertion point depends on the script's structure — look for where it saves the WAV file after calling the AudioCraft model.

- [ ] **Step 4: Test the flag locally**

Run: `cd arena && python scripts/generate_audio.py --id test --type sfx --backend audiocraft --output /tmp/test-output.wav --prompt "test beep" --duration 0.5`
Expected: WAV file written to `/tmp/test-output.wav`

- [ ] **Step 5: Commit**

```bash
git add arena/scripts/generate_audio.py
git commit -m "feat(arena): add --output flag to generate_audio.py for remote worker NAS writes"
```

---

## Chunk 3: Kubernetes Deployment + UI

### Task 9: Create Dockerfile and .dockerignore

**Files:**
- Create: `Assetgenerator/Dockerfile`
- Create: `Assetgenerator/.dockerignore`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js worker-manager.js ./
COPY adapters/ ./adapters/
COPY config/ ./config/
COPY projects/ ./projects/
COPY scripts/ ./scripts/
COPY index.html ./

EXPOSE 5200

CMD ["node", "server.js"]
```

- [ ] **Step 2: Create .dockerignore**

```
node_modules
worker/
test/
.git
.gitignore
*.md
.env*
coverage/
test-results/
.superpowers/
```

- [ ] **Step 3: Test Docker build**

Run: `cd Assetgenerator && docker build -t assetgenerator-test .`
Expected: Build succeeds. Image ~200MB.

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/Dockerfile Assetgenerator/.dockerignore
git commit -m "feat(assetgenerator): add Dockerfile for k3s deployment"
```

---

### Task 10: Create k8s manifests

**Files:**
- Create: `k8s/services/assetgenerator/deployment.yaml`
- Create: `k8s/services/assetgenerator/service.yaml`
- Create: `k8s/services/assetgenerator/ingressroute.yaml`
- Create: `k8s/services/assetgenerator/pv-audio.yaml`
- Create: `k8s/services/assetgenerator/pv-visual.yaml`
- Create: `k8s/services/assetgenerator/pvc.yaml`
- Create: `k8s/services/assetgenerator/kustomization.yaml`

- [ ] **Step 1: Create deployment.yaml**

```yaml
---
# =============================================================================
# Assetgenerator Deployment
# =============================================================================
# Express server for asset generation orchestration. GPU work dispatched to
# remote worker via WebSocket; server handles UI, library management, and
# CPU-only post-processing (ffmpeg).
# =============================================================================

apiVersion: apps/v1
kind: Deployment
metadata:
  name: assetgenerator
  namespace: korczewski-services
  labels:
    app: assetgenerator
    app.kubernetes.io/component: assetgenerator
    app.kubernetes.io/name: assetgenerator
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  replicas: 1
  selector:
    matchLabels:
      app: assetgenerator
      app.kubernetes.io/component: assetgenerator
      app.kubernetes.io/part-of: korczewski
      tier: services
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: assetgenerator
        app.kubernetes.io/component: assetgenerator
        app.kubernetes.io/name: assetgenerator
        app.kubernetes.io/part-of: korczewski
        tier: services
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      nodeSelector:
        kubernetes.io/arch: amd64
      containers:
        - name: assetgenerator
          image: registry.local:5000/korczewski/assetgenerator:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 5200
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "5200"
            # Worker-side project root — used to build script paths dispatched
            # over WebSocket. The server container never resolves these locally.
            - name: ASSETGENERATOR_ROOT
              value: "/home/patrick/projects/Assetgenerator"
          volumeMounts:
            - name: audio-library
              mountPath: /mnt/pve3a/audio-library
            - name: visual-library
              mountPath: /mnt/pve3a/visual-library
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 5200
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 5200
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: 5200
            initialDelaySeconds: 5
            periodSeconds: 3
            timeoutSeconds: 5
            failureThreshold: 10
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      volumes:
        - name: audio-library
          persistentVolumeClaim:
            claimName: assetgenerator-audio
        - name: visual-library
          persistentVolumeClaim:
            claimName: assetgenerator-visual
```

- [ ] **Step 2: Create service.yaml**

```yaml
---
# =============================================================================
# Assetgenerator Service
# =============================================================================

apiVersion: v1
kind: Service
metadata:
  name: assetgenerator
  namespace: korczewski-services
  labels:
    app: assetgenerator
    app.kubernetes.io/name: assetgenerator
    app.kubernetes.io/component: assetgenerator
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  type: ClusterIP
  ports:
    - port: 5200
      targetPort: 5200
      protocol: TCP
      name: http
  selector:
    app: assetgenerator
```

- [ ] **Step 3: Create ingressroute.yaml**

```yaml
---
# =============================================================================
# Assetgenerator IngressRoute
# =============================================================================
# WebSocket upgrade handled natively by Traefik.
# =============================================================================

apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: assetgenerator
  namespace: korczewski-services
  labels:
    app: assetgenerator
    app.kubernetes.io/name: assetgenerator
    app.kubernetes.io/component: assetgenerator
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  routes:
    - match: Host(`assetgen.korczewski.de`)
      kind: Rule
      services:
        - name: assetgenerator
          port: 5200
  tls: {}
```

- [ ] **Step 4: Create pv-audio.yaml**

```yaml
---
# =============================================================================
# PersistentVolume for Audio Library on pve3a
# =============================================================================

apiVersion: v1
kind: PersistentVolume
metadata:
  name: assetgenerator-audio-pv
  labels:
    app: assetgenerator
    type: audio-library
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  csi:
    driver: smb.csi.k8s.io
    volumeHandle: assetgenerator-audio
    volumeAttributes:
      source: "//10.0.0.11/storage-pve3a/audio-library"
    nodeStageSecretRef:
      name: smbcreds
      namespace: korczewski-infra
  mountOptions:
    - dir_mode=0755
    - file_mode=0644
    - uid=1001
    - gid=1001
    - noperm
    - mfsymlinks
    - cache=none
    - noserverino
```

- [ ] **Step 5: Create pv-visual.yaml**

```yaml
---
# =============================================================================
# PersistentVolume for Visual Library on pve3a
# =============================================================================

apiVersion: v1
kind: PersistentVolume
metadata:
  name: assetgenerator-visual-pv
  labels:
    app: assetgenerator
    type: visual-library
spec:
  capacity:
    storage: 50Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  csi:
    driver: smb.csi.k8s.io
    volumeHandle: assetgenerator-visual
    volumeAttributes:
      source: "//10.0.0.11/storage-pve3a/visual-library"
    nodeStageSecretRef:
      name: smbcreds
      namespace: korczewski-infra
  mountOptions:
    - dir_mode=0755
    - file_mode=0644
    - uid=1001
    - gid=1001
    - noperm
    - mfsymlinks
    - cache=none
    - noserverino
```

- [ ] **Step 6: Create pvc.yaml**

```yaml
---
# =============================================================================
# PersistentVolumeClaims for Assetgenerator NAS Storage
# =============================================================================

apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: assetgenerator-audio
  namespace: korczewski-services
  labels:
    app: assetgenerator
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  volumeName: assetgenerator-audio-pv
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: assetgenerator-visual
  namespace: korczewski-services
  labels:
    app: assetgenerator
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: ""
  volumeName: assetgenerator-visual-pv
  resources:
    requests:
      storage: 50Gi
```

- [ ] **Step 7: Create kustomization.yaml**

```yaml
# =============================================================================
# Assetgenerator Service Kustomization
# =============================================================================

apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: assetgenerator

namespace: korczewski-services

labels:
  - pairs:
      app.kubernetes.io/part-of: korczewski
      app.kubernetes.io/component: assetgenerator
      tier: services

resources:
  - pv-audio.yaml
  - pv-visual.yaml
  - pvc.yaml
  - deployment.yaml
  - service.yaml
  - ingressroute.yaml
```

- [ ] **Step 8: Validate manifests**

Run: `kubectl kustomize k8s/services/assetgenerator/`
Expected: Valid YAML output with all resources merged

- [ ] **Step 9: Commit**

```bash
git add k8s/services/assetgenerator/
git commit -m "feat(k8s): add assetgenerator service manifests"
```

---

### Task 11: Create deploy script

**Files:**
- Create: `k8s/scripts/deploy/deploy-assetgenerator.sh`

- [ ] **Step 1: Write deploy script**

```bash
#!/bin/bash
# =============================================================================
# Deploy Assetgenerator Service
# =============================================================================
# Builds Docker image, pushes to registry, applies manifests, and restarts.
#
# Usage: ./deploy-assetgenerator.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

NAMESPACE="korczewski-services"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

MANIFESTS_ONLY=false
HEALTH_CHECK=true

for arg in "$@"; do
    case $arg in
        --manifests-only) MANIFESTS_ONLY=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
    esac
done

log_step "Deploying Assetgenerator Service"

# Auto-detect registry (k3d local vs production)
source "$SCRIPT_DIR/../utils/detect-registry.sh"
detect_registry

# Build and push image
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Building assetgenerator..."
    docker build -t "$REGISTRY/assetgenerator:latest" -f "$PROJECT_ROOT/Assetgenerator/Dockerfile" "$PROJECT_ROOT/Assetgenerator"

    log_info "Pushing assetgenerator..."
    docker push "$REGISTRY/assetgenerator:latest"
fi

# Apply manifests
log_info "Applying Assetgenerator manifests..."
kubectl apply -k "$K8S_DIR/services/assetgenerator/"

# Restart deployment to pull new image
if [ "$MANIFESTS_ONLY" = false ]; then
    kubectl rollout restart deployment/assetgenerator -n "$NAMESPACE"
fi

# Wait for rollout
log_info "Waiting for Assetgenerator rollout..."
kubectl rollout status deployment/assetgenerator -n "$NAMESPACE" --timeout=180s

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    AG_POD=$(kubectl get pods -n "$NAMESPACE" -l app=assetgenerator \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$AG_POD" ]; then
        HEALTH=$(kubectl exec "$AG_POD" -n "$NAMESPACE" -- \
            node -e "fetch('http://localhost:5200/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))" 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "Assetgenerator health: OK"
        else
            log_warn "Assetgenerator health endpoint not responding (may still be starting)"
        fi
    fi
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set assetgenerator
fi

log_info "Assetgenerator service deployed successfully!"
kubectl get pods -l app=assetgenerator -n "$NAMESPACE"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x k8s/scripts/deploy/deploy-assetgenerator.sh
```

- [ ] **Step 3: Commit**

```bash
git add k8s/scripts/deploy/deploy-assetgenerator.sh
git commit -m "feat(k8s): add assetgenerator deploy script"
```

---

### Task 12: Add worker status indicator to UI

**Files:**
- Modify: `Assetgenerator/index.html`

- [ ] **Step 1: Add worker status indicator to header**

In `Assetgenerator/index.html`, find the header-left div (around line 741):
```html
    <div class="header-left">
      <div class="logo">Asset<span>generator</span></div>
```

Insert the status indicator after the logo div:

```html
<span id="worker-status" style="display:inline-flex;align-items:center;gap:6px;margin-left:16px;font-size:13px;color:#6272a4;">
  <span id="worker-dot" style="width:8px;height:8px;border-radius:50%;background:#6272a4;"></span>
  <span id="worker-label">No GPU worker</span>
</span>
```

- [ ] **Step 2: Add polling script**

At the end of the `<script>` section in index.html, add:

```js
// Worker status polling
async function pollWorkerStatus() {
  try {
    const res = await fetch('/api/worker-status');
    const data = await res.json();
    const dot = document.getElementById('worker-dot');
    const label = document.getElementById('worker-label');
    if (data.connected) {
      dot.style.background = '#50fa7b';
      label.textContent = `${data.hostname} · ${data.gpu}`;
      label.style.color = '#50fa7b';
    } else {
      dot.style.background = '#6272a4';
      label.textContent = 'No GPU worker';
      label.style.color = '#6272a4';
    }
  } catch { /* silent */ }
}
pollWorkerStatus();
setInterval(pollWorkerStatus, 5000);
```

- [ ] **Step 3: Test locally**

Run: `cd Assetgenerator && node server.js --project arena`
Open browser to `http://localhost:5200`. Verify grey dot + "No GPU worker" shows in header.

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/index.html
git commit -m "feat(assetgenerator): add worker status indicator to UI"
```

---

### Task 13: Add skaffold profile and run full test suite

**Files:**
- Modify: `k8s/skaffold.yaml`

- [ ] **Step 1: Add assetgenerator profile to skaffold.yaml**

Find the `profiles:` section and add:

```yaml
  - name: assetgenerator
    build:
      artifacts:
        - image: registry.local:5000/korczewski/assetgenerator
          context: ../Assetgenerator
          docker:
            dockerfile: Dockerfile
    deploy:
      kustomize:
        paths:
          - services/assetgenerator
```

- [ ] **Step 2: Run full test suite**

```bash
cd Assetgenerator && node --test test/api.test.js && node --test test/worker-manager.test.js && node --test test/adapter-routing.test.js
cd Assetgenerator/worker && node --test test/worker.test.js
```

Expected: All tests PASS across all test files.

- [ ] **Step 3: Validate k8s manifests**

Run: `kubectl kustomize k8s/services/assetgenerator/`
Expected: Valid combined YAML

- [ ] **Step 4: Commit**

```bash
git add k8s/skaffold.yaml
git commit -m "feat(k8s): add assetgenerator profile to skaffold"
```

---

### Task 14: Deploy and smoke test

- [ ] **Step 1: Deploy to k3s**

```bash
./k8s/scripts/deploy/deploy-assetgenerator.sh
```

Expected: Image builds, pushes, manifests apply, pod starts, health check passes.

- [ ] **Step 2: Verify pod is running**

```bash
kubectl get pods -n korczewski-services -l app=assetgenerator
kubectl logs -n korczewski-services -l app=assetgenerator --tail=20
```

Expected: Pod in Running state, logs show "Assetgenerator running at http://localhost:5200"

- [ ] **Step 3: Verify IngressRoute**

```bash
curl -s https://assetgen.korczewski.de/health
curl -s https://assetgen.korczewski.de/api/worker-status
```

Expected: Health returns `{"status":"ok",...}`. Worker status returns `{"connected":false,...}`.

- [ ] **Step 4: Start GPU worker on workstation**

```bash
cd Assetgenerator/worker && WORKER_SERVER_URL=wss://assetgen.korczewski.de/ws/worker npm start
```

Expected: "Connected to wss://assetgen.korczewski.de/ws/worker" + "Registered as ..."

- [ ] **Step 5: Verify worker connected in UI**

Open `https://assetgen.korczewski.de` in browser.
Expected: Green dot + workstation hostname + GPU name in header.

- [ ] **Step 6: Record deploy**

```bash
./k8s/scripts/utils/deploy-tracker.sh status
```

Expected: assetgenerator shows as deployed at current SHA.
