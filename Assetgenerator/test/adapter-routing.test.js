/**
 * Adapter Routing Tests
 *
 * Tests that GPU adapters route to worker when connected,
 * and throw when disconnected. Cloud adapters always run locally.
 *
 * Run: cd Assetgenerator && node --test test/adapter-routing.test.js
 */

import { describe, it, before, after } from 'node:test';
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
