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

describe('Static file serving', () => {
  it('serves index.html at root with Taschentherapeut content', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Taschentherapeut');
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('SPA fallback', () => {
  it('returns index.html for unknown paths', async () => {
    const res = await fetch(`${baseUrl}/some/random/path`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Taschentherapeut');
  });
});

describe('API 404 handling', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });
});

describe('Content-Type headers', () => {
  it('serves health endpoints as JSON', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('serves root as HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});
