import { describe, it, expect } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { internalAuth } from '../middleware/internalAuth.js';

// Minimal mock objects for testing Express middleware without a full app
interface MockContext {
  status: number | undefined;
  body: unknown;
  nextCalled: boolean;
  res: Response;
  req: (headers?: Record<string, string>) => Request;
  next: NextFunction;
}

function makeMocks(headers: Record<string, string> = {}): MockContext {
  const ctx: MockContext = {
    status: undefined,
    body: undefined,
    nextCalled: false,
    res: undefined as unknown as Response,
    req: () => ({ headers } as unknown as Request),
    next: undefined as unknown as NextFunction,
  };

  ctx.res = {
    status(code: number) {
      ctx.status = code;
      return ctx.res;
    },
    json(data: unknown) {
      ctx.body = data;
      return ctx.res;
    },
  } as unknown as Response;

  ctx.next = (() => { ctx.nextCalled = true; }) as NextFunction;

  return ctx;
}

describe('internalAuth middleware', () => {
  it('rejects requests with no API key header (401)', () => {
    const ctx = makeMocks({});
    internalAuth(ctx.req(), ctx.res, ctx.next);

    expect(ctx.status).toBe(401);
    expect((ctx.body as Record<string, string>).error).toBe('Invalid or missing internal API key');
    expect(ctx.nextCalled).toBe(false);
  });

  it('rejects requests with wrong API key (401)', () => {
    const ctx = makeMocks({ 'x-internal-api-key': 'wrong-key' });
    internalAuth(ctx.req(), ctx.res, ctx.next);

    expect(ctx.status).toBe(401);
    expect((ctx.body as Record<string, string>).error).toBe('Invalid or missing internal API key');
    expect(ctx.nextCalled).toBe(false);
  });

  it('calls next() when the correct API key is provided', () => {
    const ctx = makeMocks({ 'x-internal-api-key': 'test-internal-key' });
    internalAuth(ctx.req(), ctx.res, ctx.next);

    expect(ctx.nextCalled).toBe(true);
    expect(ctx.status).toBeUndefined();
  });
});
