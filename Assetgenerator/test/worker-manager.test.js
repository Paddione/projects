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
