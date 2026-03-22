import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import app from '../../src/app.js';

let server: Server;
let baseUrl: string;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('GET /health', () => {
  it('returns status OK with service info', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.service).toBe('sos');
    expect(body.uptime).toBeTypeOf('number');
    expect(body.timestamp).toBeTruthy();
    expect(body.memory).toBeTypeOf('number');
  });

  it('returns no-store cache header', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /health/ready', () => {
  it('returns ready status', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
  });
});

describe('GET /health/live', () => {
  it('returns alive status with uptime and pid', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('alive');
    expect(body.uptime).toBeTypeOf('number');
    expect(body.pid).toBeTypeOf('number');
  });
});

describe('GET /api/version', () => {
  it('returns version info with all fields', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe('sos');
    expect(body.version).toBe('1.0.0');
    expect(body.sha).toBeTypeOf('string');
    expect(body.uptime).toBeTypeOf('number');
    expect(body.node).toMatch(/^v\d+/);
  });

  it('returns no-store cache header', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('defaults sha to dev when GIT_SHA not set', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    const body = await res.json();
    expect(body.sha).toBe('dev');
  });
});

describe('GET /api/health', () => {
  it('returns convenience health endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.service).toBe('sos');
  });
});
