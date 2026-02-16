import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be declared before importing the module under test) ──

const mockHeadersMap = new Map<string, string>()
const mockHeadersList = {
    get: (key: string) => mockHeadersMap.get(key.toLowerCase()) ?? null,
} as unknown as Headers

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => mockHeadersList),
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn((url: string) => {
        throw new RedirectError(url)
    }),
}))

vi.mock('@/lib/db', () => ({
    db: {
        user: {
            upsert: vi.fn(),
        },
        wallet: {
            upsert: vi.fn(),
        },
    },
}))

// React.cache: pass through, no caching (so tests are isolated)
vi.mock('react', () => ({
    cache: (fn: Function) => fn,
}))

// Helper class to identify redirect throws in tests
class RedirectError extends Error {
    url: string
    constructor(url: string) {
        super(`NEXT_REDIRECT: ${url}`)
        this.url = url
    }
}

// ── Imports (after mocks) ──

import {
    getRequestUrlFromHeaders,
    getAuthLoginUrlFromHeaders,
    getCurrentUser,
    isAdmin,
    requireAuth,
    requireAdmin,
} from '@/lib/actions/auth'
import { db } from '@/lib/db'

// ── Helpers ──

function setHeaders(entries: Record<string, string>) {
    mockHeadersMap.clear()
    for (const [key, value] of Object.entries(entries)) {
        mockHeadersMap.set(key.toLowerCase(), value)
    }
}

// ── Tests ──

describe('Auth Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockHeadersMap.clear()
    })

    // ─────────────────────────────────────────────────────
    // getRequestUrlFromHeaders
    // ─────────────────────────────────────────────────────
    describe('getRequestUrlFromHeaders', () => {
        it('returns fallback URL when no host header is present', async () => {
            const h = { get: () => null } as unknown as Headers
            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de')
        })

        it('reconstructs URL from x-forwarded-* headers', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
                ['x-forwarded-uri', '/products/42'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/products/42')
        })

        it('falls back to host header when x-forwarded-host is absent', async () => {
            const map = new Map<string, string>([
                ['host', 'shop.korczewski.de'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/')
        })

        it('uses http protocol for localhost', async () => {
            const map = new Map<string, string>([
                ['host', 'localhost:3004'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('http://localhost:3004/')
        })

        it('uses http protocol for 127.0.0.1', async () => {
            const map = new Map<string, string>([
                ['host', '127.0.0.1:3004'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('http://127.0.0.1:3004/')
        })

        it('falls back to x-original-uri when x-forwarded-uri is absent', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
                ['x-original-uri', '/checkout'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/checkout')
        })

        it('falls back to next-url when other URI headers are absent', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
                ['next-url', '/account'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/account')
        })

        it('uses / as default path when no URI header exists', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/')
        })

        it('prepends / to path when missing', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
                ['x-forwarded-uri', 'no-leading-slash'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/no-leading-slash')
        })

        it('uses x-forwarded-protocol as proto fallback', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-protocol', 'https'],
                ['x-forwarded-uri', '/page'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const url = await getRequestUrlFromHeaders(h)
            expect(url).toBe('https://shop.korczewski.de/page')
        })
    })

    // ─────────────────────────────────────────────────────
    // getAuthLoginUrlFromHeaders
    // ─────────────────────────────────────────────────────
    describe('getAuthLoginUrlFromHeaders', () => {
        it('builds auth login URL with redirect parameter', async () => {
            const map = new Map<string, string>([
                ['x-forwarded-host', 'shop.korczewski.de'],
                ['x-forwarded-proto', 'https'],
                ['x-forwarded-uri', '/checkout'],
            ])
            const h = { get: (k: string) => map.get(k.toLowerCase()) ?? null } as unknown as Headers

            const loginUrl = await getAuthLoginUrlFromHeaders(h)

            expect(loginUrl).toContain('https://auth.korczewski.de/login')
            expect(loginUrl).toContain('redirect=')
            expect(loginUrl).toContain(encodeURIComponent('https://shop.korczewski.de/checkout'))
        })

        it('uses fallback shop URL when no host header is present', async () => {
            const h = { get: () => null } as unknown as Headers

            const loginUrl = await getAuthLoginUrlFromHeaders(h)

            expect(loginUrl).toContain('https://auth.korczewski.de/login')
            expect(loginUrl).toContain(encodeURIComponent('https://shop.korczewski.de'))
        })
    })

    // ─────────────────────────────────────────────────────
    // getCurrentUser
    // ─────────────────────────────────────────────────────
    describe('getCurrentUser', () => {
        it('returns null when x-user-email header is missing', async () => {
            setHeaders({})
            const user = await getCurrentUser()
            expect(user).toBeNull()
        })

        it('syncs user and wallet to database and returns AuthUser', async () => {
            setHeaders({
                'x-user-email': 'test@example.com',
                'x-user-role': 'USER',
                'x-user-id': '42',
                'x-user-name': 'Test User',
            })

            const mockDbUser = {
                id: 'db-uuid-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'USER' as const,
            }

            vi.mocked(db.user.upsert).mockResolvedValue(mockDbUser as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await getCurrentUser()

            expect(db.user.upsert).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
                update: { name: 'Test User', role: 'USER' },
                create: { email: 'test@example.com', name: 'Test User', role: 'USER' },
            })

            expect(db.wallet.upsert).toHaveBeenCalledWith({
                where: { userId: 'db-uuid-1' },
                update: {},
                create: { userId: 'db-uuid-1', balance: 0 },
            })

            expect(user).toEqual({
                id: 'db-uuid-1',
                email: 'test@example.com',
                name: 'Test User',
                role: 'USER',
                authUserId: 42,
            })
        })

        it('maps ADMIN role correctly', async () => {
            setHeaders({
                'x-user-email': 'admin@example.com',
                'x-user-role': 'ADMIN',
                'x-user-id': '1',
                'x-user-name': 'Admin',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'admin-uuid',
                email: 'admin@example.com',
                name: 'Admin',
                role: 'ADMIN',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await getCurrentUser()

            expect(db.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({ role: 'ADMIN' }),
                    create: expect.objectContaining({ role: 'ADMIN' }),
                })
            )
            expect(user?.role).toBe('ADMIN')
        })

        it('defaults non-ADMIN roles to USER', async () => {
            setHeaders({
                'x-user-email': 'user@example.com',
                'x-user-role': 'MODERATOR',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'user-uuid',
                email: 'user@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await getCurrentUser()

            expect(db.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({ role: 'USER' }),
                    create: expect.objectContaining({ role: 'USER' }),
                })
            )
            expect(user?.role).toBe('USER')
        })

        it('sets name to null when x-user-name header is absent', async () => {
            setHeaders({
                'x-user-email': 'noname@example.com',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'nn-uuid',
                email: 'noname@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await getCurrentUser()

            expect(db.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({ name: null }),
                    create: expect.objectContaining({ name: null }),
                })
            )
            expect(user?.name).toBeNull()
        })

        it('returns authUserId as undefined when x-user-id header is absent', async () => {
            setHeaders({
                'x-user-email': 'noid@example.com',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'noid-uuid',
                email: 'noid@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await getCurrentUser()
            expect(user?.authUserId).toBeUndefined()
        })

        it('returns null when db.user.upsert throws', async () => {
            setHeaders({
                'x-user-email': 'fail@example.com',
            })

            vi.mocked(db.user.upsert).mockRejectedValue(new Error('DB connection lost'))

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const user = await getCurrentUser()

            expect(user).toBeNull()
            expect(consoleSpy).toHaveBeenCalledWith('User sync error:', expect.any(Error))
            consoleSpy.mockRestore()
        })

        it('still returns user when wallet upsert fails (race condition)', async () => {
            setHeaders({
                'x-user-email': 'walletfail@example.com',
                'x-user-id': '99',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'wf-uuid',
                email: 'walletfail@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockRejectedValue(new Error('Unique constraint violation'))

            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
            const user = await getCurrentUser()

            expect(user).toEqual({
                id: 'wf-uuid',
                email: 'walletfail@example.com',
                name: null,
                role: 'USER',
                authUserId: 99,
            })
            expect(consoleSpy).toHaveBeenCalledWith(
                'Wallet sync note (likely race condition handled):',
                'Unique constraint violation'
            )
            consoleSpy.mockRestore()
        })
    })

    // ─────────────────────────────────────────────────────
    // isAdmin
    // ─────────────────────────────────────────────────────
    describe('isAdmin', () => {
        it('returns true when user has ADMIN role', async () => {
            setHeaders({
                'x-user-email': 'admin@example.com',
                'x-user-role': 'ADMIN',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'a-uuid',
                email: 'admin@example.com',
                name: null,
                role: 'ADMIN',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            expect(await isAdmin()).toBe(true)
        })

        it('returns false when user has USER role', async () => {
            setHeaders({
                'x-user-email': 'user@example.com',
                'x-user-role': 'USER',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'u-uuid',
                email: 'user@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            expect(await isAdmin()).toBe(false)
        })

        it('returns false when no user is authenticated', async () => {
            setHeaders({})
            expect(await isAdmin()).toBe(false)
        })
    })

    // ─────────────────────────────────────────────────────
    // requireAuth
    // ─────────────────────────────────────────────────────
    describe('requireAuth', () => {
        it('returns user when authenticated', async () => {
            setHeaders({
                'x-user-email': 'auth@example.com',
                'x-user-role': 'USER',
                'x-user-id': '10',
                'x-user-name': 'Auth User',
                'x-forwarded-host': 'shop.korczewski.de',
                'x-forwarded-proto': 'https',
                'x-forwarded-uri': '/account',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'auth-uuid',
                email: 'auth@example.com',
                name: 'Auth User',
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await requireAuth()
            expect(user).toEqual({
                id: 'auth-uuid',
                email: 'auth@example.com',
                name: 'Auth User',
                role: 'USER',
                authUserId: 10,
            })
        })

        it('calls redirect with auth login URL when user is not authenticated', async () => {
            setHeaders({
                'x-forwarded-host': 'shop.korczewski.de',
                'x-forwarded-proto': 'https',
                'x-forwarded-uri': '/checkout',
            })

            await expect(requireAuth()).rejects.toThrow(RedirectError)

            try {
                await requireAuth()
            } catch (e) {
                if (e instanceof RedirectError) {
                    expect(e.url).toContain('https://auth.korczewski.de/login')
                    expect(e.url).toContain(encodeURIComponent('https://shop.korczewski.de/checkout'))
                }
            }
        })
    })

    // ─────────────────────────────────────────────────────
    // requireAdmin
    // ─────────────────────────────────────────────────────
    describe('requireAdmin', () => {
        it('returns user when authenticated as admin', async () => {
            setHeaders({
                'x-user-email': 'admin@example.com',
                'x-user-role': 'ADMIN',
                'x-user-id': '1',
                'x-user-name': 'Admin',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'admin-uuid',
                email: 'admin@example.com',
                name: 'Admin',
                role: 'ADMIN',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            const user = await requireAdmin()
            expect(user).toEqual({
                id: 'admin-uuid',
                email: 'admin@example.com',
                name: 'Admin',
                role: 'ADMIN',
                authUserId: 1,
            })
        })

        it('throws "Admin access required" for non-admin users', async () => {
            setHeaders({
                'x-user-email': 'regular@example.com',
                'x-user-role': 'USER',
                'x-user-id': '5',
            })

            vi.mocked(db.user.upsert).mockResolvedValue({
                id: 'reg-uuid',
                email: 'regular@example.com',
                name: null,
                role: 'USER',
            } as any)
            vi.mocked(db.wallet.upsert).mockResolvedValue({} as any)

            await expect(requireAdmin()).rejects.toThrow('Admin access required')
        })

        it('redirects unauthenticated users (before checking admin)', async () => {
            setHeaders({
                'x-forwarded-host': 'shop.korczewski.de',
                'x-forwarded-proto': 'https',
            })

            await expect(requireAdmin()).rejects.toThrow(RedirectError)
        })
    })
})
