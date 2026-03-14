import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock config before importing auth middleware
vi.mock('../config/index.js', () => ({
    config: {
        auth: { authServiceUrl: 'https://auth.test.local' },
    },
}));

import { attachAuthUser } from './auth.js';

function mockReq(headers: Record<string, string | string[] | undefined> = {}): Request {
    return { headers } as unknown as Request;
}

const mockRes = {} as Response;

describe('auth middleware — attachAuthUser', () => {
    let next: NextFunction;

    beforeEach(() => {
        next = vi.fn();
        vi.restoreAllMocks();
    });

    describe('extractFromHeaders (Traefik ForwardAuth)', () => {
        it('extracts user from x-auth-* headers', async () => {
            const req = mockReq({
                'x-auth-user-id': '42',
                'x-auth-user': 'alice',
                'x-auth-email': 'alice@test.com',
                'x-auth-role': 'ADMIN',
            });

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toEqual({
                userId: 42,
                username: 'alice',
                email: 'alice@test.com',
                role: 'ADMIN',
            });
            expect(next).toHaveBeenCalled();
        });

        it('falls back to email prefix when x-auth-user is absent', async () => {
            const req = mockReq({
                'x-auth-user-id': '7',
                'x-auth-email': 'bob@example.org',
            });

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toEqual({
                userId: 7,
                username: 'bob',
                email: 'bob@example.org',
                role: 'USER',
            });
        });

        it('falls back to "player" when both username and email are absent', async () => {
            const req = mockReq({ 'x-auth-user-id': '99' });

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toEqual({
                userId: 99,
                username: 'player',
                email: '',
                role: 'USER',
            });
        });

        it('handles array header values (first value used)', async () => {
            const req = mockReq({
                'x-auth-user-id': ['42', '99'],
                'x-auth-user': ['alice', 'bob'],
                'x-auth-email': ['alice@test.com'],
                'x-auth-role': ['ADMIN'],
            });

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user?.userId).toBe(42);
            expect((req as any).user?.username).toBe('alice');
        });
    });

    describe('cookie verification fallback', () => {
        it('sets user to null when no headers and no cookie', async () => {
            const req = mockReq({});

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toBeNull();
            expect(next).toHaveBeenCalled();
        });

        it('verifies cookie against auth service on success', async () => {
            const req = mockReq({ cookie: 'session=abc123' });

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                headers: new Map([
                    ['x-auth-user-id', '10'],
                    ['x-auth-user', 'charlie'],
                    ['x-auth-email', 'charlie@test.com'],
                    ['x-auth-role', 'USER'],
                ]) as any,
            }));

            // The fetch mock needs Headers-like .get()
            const mockHeaders = {
                get: (key: string) => {
                    const map: Record<string, string> = {
                        'x-auth-user-id': '10',
                        'x-auth-user': 'charlie',
                        'x-auth-email': 'charlie@test.com',
                        'x-auth-role': 'USER',
                    };
                    return map[key] ?? null;
                },
            };

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                headers: mockHeaders,
            }));

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toEqual({
                userId: 10,
                username: 'charlie',
                email: 'charlie@test.com',
                role: 'USER',
            });
        });

        it('sets user to null when auth service returns non-ok', async () => {
            const req = mockReq({ cookie: 'session=expired' });

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
            }));

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toBeNull();
            expect(next).toHaveBeenCalled();
        });

        it('sets user to null when auth service fetch throws', async () => {
            const req = mockReq({ cookie: 'session=abc123' });

            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toBeNull();
            expect(next).toHaveBeenCalled();
        });

        it('sets user to null when auth service returns invalid userId', async () => {
            const req = mockReq({ cookie: 'session=abc123' });

            const mockHeaders = {
                get: (key: string) => {
                    const map: Record<string, string> = {
                        'x-auth-user-id': 'not-a-number',
                        'x-auth-user': 'charlie',
                    };
                    return map[key] ?? null;
                },
            };

            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                headers: mockHeaders,
            }));

            await attachAuthUser(req, mockRes, next);

            expect((req as any).user).toBeNull();
        });
    });

    it('always calls next() regardless of auth outcome', async () => {
        const req = mockReq({});
        await attachAuthUser(req, mockRes, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
