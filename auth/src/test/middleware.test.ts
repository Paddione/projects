/**
 * Middleware Unit Tests
 *
 * Tests for: correlationId, csrf, errorHandler, authenticate
 * No DB connection required — TokenService and DB dependencies are fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and test-utils so the global setupFiles (setup.ts) does not attempt
// a real database connection when this pure-unit test file runs.
vi.mock('../config/database.js', () => ({ db: {} }));
vi.mock('./test-utils.js', () => ({
  deleteAllTestUsers: vi.fn().mockResolvedValue(0),
  getTestDataStats: vi.fn().mockResolvedValue({ testUsers: 0, testAccessRequests: 0, testSessions: 0 }),
}));
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mock TokenService BEFORE importing authenticate (module-level instantiation)
// vi.hoisted ensures these refs are available inside the hoisted vi.mock factory.
// ---------------------------------------------------------------------------
const { mockVerify, mockIsBlacklisted } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockIsBlacklisted: vi.fn(),
}));

vi.mock('../services/TokenService.js', () => {
  class TokenService {
    verifyAccessToken = mockVerify;
    isTokenBlacklisted = mockIsBlacklisted;
  }
  return { TokenService };
});

import {
  correlationId,
  REQUEST_ID_HEADER,
  CORRELATION_ID_HEADER,
} from '../middleware/correlationId.js';
import { csrfProtection } from '../middleware/csrf.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/authenticate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Record<string, unknown> = {}): Request {
  const base: Record<string, unknown> = {
    headers: {} as Record<string, string>,
    method: 'GET',
    cookies: {},
    user: undefined,
    ...overrides,
  };
  base.header = (name: string) =>
    (base.headers as Record<string, string>)[name.toLowerCase()];
  return base as unknown as Request;
}

function mockRes(): Response & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
} {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    _headers: {} as Record<string, string>,
    statusCode: 200,
    status(code: number) {
      this._status = code;
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value;
      return this;
    },
  };
  return res as unknown as Response & {
    _status: number;
    _body: unknown;
    _headers: Record<string, string>;
  };
}

const noop: NextFunction = () => {};

// ---------------------------------------------------------------------------
// correlationId
// ---------------------------------------------------------------------------

describe('correlationId middleware', () => {
  it('generates a UUID when no ID headers are present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect((req as any).correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(res._headers[REQUEST_ID_HEADER]).toBe((req as any).correlationId);
    expect(res._headers[CORRELATION_ID_HEADER]).toBe((req as any).correlationId);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes through an incoming x-request-id', () => {
    const req = mockReq({ headers: { 'x-request-id': 'my-trace-id' } });
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect((req as any).correlationId).toBe('my-trace-id');
    expect(res._headers[REQUEST_ID_HEADER]).toBe('my-trace-id');
    expect(res._headers[CORRELATION_ID_HEADER]).toBe('my-trace-id');
    expect(next).toHaveBeenCalledOnce();
  });

  it('falls back to x-correlation-id when x-request-id is absent', () => {
    const req = mockReq({ headers: { 'x-correlation-id': 'corr-999' } });
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect((req as any).correlationId).toBe('corr-999');
    expect(res._headers[REQUEST_ID_HEADER]).toBe('corr-999');
    expect(next).toHaveBeenCalledOnce();
  });

  it('prefers x-request-id over x-correlation-id when both are present', () => {
    const req = mockReq({
      headers: { 'x-request-id': 'primary', 'x-correlation-id': 'secondary' },
    });
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect((req as any).correlationId).toBe('primary');
    expect(next).toHaveBeenCalledOnce();
  });

  it('trims whitespace from incoming IDs', () => {
    const req = mockReq({ headers: { 'x-request-id': '  padded-id  ' } });
    const res = mockRes();
    const next = vi.fn();

    correlationId(req, res, next);

    expect((req as any).correlationId).toBe('padded-id');
  });
});

// ---------------------------------------------------------------------------
// csrfProtection
// ---------------------------------------------------------------------------

describe('csrfProtection middleware', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'allows %s without X-Requested-With header',
    (method) => {
      const req = mockReq({ method });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res._status).toBe(200);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'blocks %s without X-Requested-With header → 403',
    (method) => {
      const req = mockReq({ method, headers: {} });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
      expect((res._body as any).error).toMatch(/Missing X-Requested-With/i);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows %s when X-Requested-With header is present',
    (method) => {
      const req = mockReq({
        method,
        headers: { 'x-requested-with': 'XMLHttpRequest' },
      });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res._status).toBe(200);
    },
  );
});

// ---------------------------------------------------------------------------
// errorHandler
// ---------------------------------------------------------------------------

describe('errorHandler middleware', () => {
  it('returns 403 for CORS "Not allowed by CORS" error', () => {
    const err = new Error('Not allowed by CORS');
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, noop);

    expect(res._status).toBe(403);
    expect((res._body as any).error).toBe('CORS policy violation');
    expect((res._body as any).message).toBe('Origin not allowed');
  });

  it('preserves non-200 statusCode from res when no CORS error', () => {
    const err = new Error('Not found');
    const req = mockReq();
    const res = mockRes();
    res.statusCode = 404;
    (res as any)._status = 404;

    errorHandler(err, req, res, noop);

    expect(res._status).toBe(404);
    expect((res._body as any).error).toBe('Not found');
  });

  it('defaults to 500 when res.statusCode is 200', () => {
    const err = new Error('Something went wrong');
    const req = mockReq();
    const res = mockRes();
    // statusCode starts at 200 (default)

    errorHandler(err, req, res, noop);

    expect(res._status).toBe(500);
    expect((res._body as any).error).toBe('Something went wrong');
  });

  it('includes stack trace in development environment', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('Dev error');
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, noop);

    expect((res._body as any).stack).toBeDefined();
    process.env.NODE_ENV = original;
  });

  it('does NOT include stack trace in production environment', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Prod error');
    const req = mockReq();
    const res = mockRes();

    errorHandler(err, req, res, noop);

    expect((res._body as any).stack).toBeUndefined();
    process.env.NODE_ENV = original;
  });
});

// ---------------------------------------------------------------------------
// authenticate / optionalAuthenticate / requireAdmin
// ---------------------------------------------------------------------------

describe('authenticate middleware', () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockIsBlacklisted.mockReset();
  });

  it('returns 401 when no token is provided', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).error).toMatch(/No authentication token/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('extracts token from Bearer Authorization header', async () => {
    const payload = { userId: 1, username: 'alice', email: 'alice@test.com', role: 'USER' };
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue(payload);

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(mockIsBlacklisted).toHaveBeenCalledWith('valid-token');
    expect(mockVerify).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledOnce();
  });

  it('extracts token from accessToken cookie', async () => {
    const payload = { userId: 2, username: 'bob', email: 'bob@test.com', role: 'USER' };
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue(payload);

    const req = mockReq({ cookies: { accessToken: 'cookie-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(mockIsBlacklisted).toHaveBeenCalledWith('cookie-token');
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 for a blacklisted token', async () => {
    mockIsBlacklisted.mockResolvedValue(true);

    const req = mockReq({ headers: { authorization: 'Bearer blacklisted-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).error).toMatch(/revoked/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with TOKEN_EXPIRED code when token is expired', async () => {
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockImplementation(() => {
      throw new Error('TOKEN_EXPIRED');
    });

    const req = mockReq({ headers: { authorization: 'Bearer expired-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).code).toBe('TOKEN_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with INVALID_TOKEN code when token is invalid', async () => {
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockImplementation(() => {
      throw new Error('INVALID_TOKEN');
    });

    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).code).toBe('INVALID_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on unexpected verification error', async () => {
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockImplementation(() => {
      throw new Error('UNEXPECTED');
    });

    const req = mockReq({ headers: { authorization: 'Bearer weird-token' } });
    const res = mockRes();
    const next = vi.fn();

    await authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).error).toMatch(/Authentication failed/i);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuthenticate middleware', () => {
  beforeEach(() => {
    mockVerify.mockReset();
    mockIsBlacklisted.mockReset();
  });

  it('calls next without setting user when no token is provided', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('sets user on req when a valid token is provided', async () => {
    const payload = { userId: 3, username: 'carol', email: 'carol@test.com', role: 'USER' };
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockReturnValue(payload);

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuthenticate(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next without user when token is blacklisted', async () => {
    mockIsBlacklisted.mockResolvedValue(true);

    const req = mockReq({ headers: { authorization: 'Bearer blacklisted' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });

  it('silently calls next when token verification throws', async () => {
    mockIsBlacklisted.mockResolvedValue(false);
    mockVerify.mockImplementation(() => {
      throw new Error('TOKEN_EXPIRED');
    });

    const req = mockReq({ headers: { authorization: 'Bearer expired' } });
    const res = mockRes();
    const next = vi.fn();

    await optionalAuthenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeUndefined();
  });
});

describe('requireAdmin middleware', () => {
  it('returns 401 when req.user is not set', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res._status).toBe(401);
    expect((res._body as any).error).toMatch(/Authentication required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not ADMIN', () => {
    const req = mockReq();
    req.user = { userId: 4, username: 'dave', email: 'dave@test.com', role: 'USER' };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res._status).toBe(403);
    expect((res._body as any).error).toMatch(/Admin access required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user has ADMIN role', () => {
    const req = mockReq();
    req.user = { userId: 5, username: 'eve', email: 'eve@test.com', role: 'ADMIN' };
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBe(200);
  });
});
