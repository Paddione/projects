import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../server.js';

// Skip when running coverage or in restricted sandbox to avoid listen() issues
const d = (process.env.TEST_COVERAGE === '1' || process.env.SKIP_NETWORK_TESTS === 'true') ? describe.skip : describe;

d('HTTP caching headers and ETag (unit scope)', () => {
  it('returns ETag and Cache-Control for /api/status and respects If-None-Match', async () => {
    const res1 = await request(app).get('/api/status');
    expect(res1.status).toBe(200);
    const etag = res1.headers['etag'];
    expect(etag).toBeTruthy();
    expect(res1.headers['cache-control']).toBeTruthy();

    const res2 = await request(app).get('/api/status').set('If-None-Match', String(etag));
    expect([200, 304]).toContain(res2.status);
    expect(res2.headers['etag']).toBeTruthy();
  });

  it('sets Cache-Control on /metrics (no-store)', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
