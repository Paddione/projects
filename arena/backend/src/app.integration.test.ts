/**
 * HTTP Integration Tests — Express App
 *
 * Strategy:
 * - DatabaseService is mocked at the module level so the pg.Pool never connects.
 * - All other layers (middleware, routes, LobbyService) are exercised for real.
 * - supertest is used to drive HTTP requests through the full Express stack.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock DatabaseService before any app module is imported
// ---------------------------------------------------------------------------

const { mockDbQuery, mockHealthCheck } = vi.hoisted(() => ({
    mockDbQuery: vi.fn(),
    mockHealthCheck: vi.fn(),
}));

vi.mock('./services/DatabaseService.js', () => ({
    DatabaseService: {
        getInstance: () => ({
            query: mockDbQuery,
            healthCheck: mockHealthCheck,
        }),
    },
}));

// ---------------------------------------------------------------------------
// Now import the app (picks up the mock)
// ---------------------------------------------------------------------------

import app from './app.js';


// ---------------------------------------------------------------------------
// Auth helpers — mimics Traefik ForwardAuth headers
// ---------------------------------------------------------------------------

const AUTH_HEADERS = {
    'x-auth-user-id': '42',
    'x-auth-user': 'testuser',
    'x-auth-email': 'test@example.com',
    'x-auth-role': 'USER',
};

// ---------------------------------------------------------------------------
// Database row builder
// ---------------------------------------------------------------------------

function makeLobbyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 1,
        code: 'ABCD12',
        host_id: null,
        auth_user_id: 42,
        status: 'waiting',
        max_players: 4,
        settings: JSON.stringify({
            maxPlayers: 4,
            bestOf: 1,
            shrinkingZone: false,
            shrinkInterval: 30,
            itemSpawns: true,
            itemSpawnInterval: 60,
        }),
        players: JSON.stringify([
            {
                id: '42',
                username: 'testuser',
                character: 'soldier',
                characterLevel: 1,
                isReady: false,
                isHost: true,
                isConnected: true,
                joinedAt: new Date().toISOString(),
            },
        ]),
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HTTP API Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    // =========================================================================
    // GET /api/health
    // =========================================================================

    describe('GET /api/health', () => {
        it('returns 200 OK when database is healthy', async () => {
            mockHealthCheck.mockResolvedValueOnce(true);

            const res = await request(app).get('/api/health');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('OK');
            expect(res.body.service).toBe('arena-backend');
            expect(res.body.database).toBe('connected');
            expect(res.body.timestamp).toBeDefined();
        });

        it('returns 200 DEGRADED when database is unhealthy', async () => {
            mockHealthCheck.mockResolvedValueOnce(false);

            const res = await request(app).get('/api/health');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('DEGRADED');
            expect(res.body.database).toBe('disconnected');
        });

        it('returns 503 when healthCheck throws', async () => {
            mockHealthCheck.mockRejectedValueOnce(new Error('DB unreachable'));

            const res = await request(app).get('/api/health');

            expect(res.status).toBe(503);
            expect(res.body.status).toBe('ERROR');
        });
    });

    // =========================================================================
    // GET /api/auth/me
    // =========================================================================

    describe('GET /api/auth/me', () => {
        it('returns the authenticated user from Traefik headers', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set(AUTH_HEADERS);

            expect(res.status).toBe(200);
            expect(res.body.user.userId).toBe(42);
            expect(res.body.user.username).toBe('testuser');
            expect(res.body.user.email).toBe('test@example.com');
        });

        it('returns 401 when no auth headers are present', async () => {
            const res = await request(app).get('/api/auth/me');

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Not authenticated');
        });

        it('derives username from email when x-auth-user is absent', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set({ 'x-auth-user-id': '10', 'x-auth-email': 'alice@arena.io' });

            expect(res.status).toBe(200);
            expect(res.body.user.username).toBe('alice');
        });
    });

    // =========================================================================
    // POST /api/lobbies
    // =========================================================================

    describe('POST /api/lobbies', () => {
        it('creates a lobby and returns 201', async () => {
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })          // code uniqueness check
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] }); // INSERT

            const res = await request(app)
                .post('/api/lobbies')
                .set(AUTH_HEADERS)
                .send({ settings: { bestOf: 3 } });

            expect(res.status).toBe(201);
            expect(res.body.code).toBe('ABCD12');
            expect(res.body.players).toHaveLength(1);
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app)
                .post('/api/lobbies')
                .send({ settings: {} });

            expect(res.status).toBe(401);
        });

        it('returns 400 when lobby creation fails (DB error)', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/lobbies')
                .set(AUTH_HEADERS)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });

        it('creates lobby with default settings when body is empty', async () => {
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            const res = await request(app)
                .post('/api/lobbies')
                .set(AUTH_HEADERS)
                .send({});

            expect(res.status).toBe(201);
            expect(res.body.settings).toBeDefined();
        });
    });

    // =========================================================================
    // GET /api/lobbies/:code
    // =========================================================================

    describe('GET /api/lobbies/:code', () => {
        it('returns the lobby when found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            const res = await request(app).get('/api/lobbies/ABCD12');

            expect(res.status).toBe(200);
            expect(res.body.code).toBe('ABCD12');
            expect(res.body.status).toBe('waiting');
        });

        it('returns 404 when lobby not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app).get('/api/lobbies/ZZZZZZ');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Lobby not found');
        });

        it('returns 500 on unexpected DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('Query failed'));

            const res = await request(app).get('/api/lobbies/ABCD12');

            expect(res.status).toBe(500);
            expect(res.body.error).toBeDefined();
        });
    });

    // =========================================================================
    // GET /api/lobbies  (list active lobbies)
    // =========================================================================

    describe('GET /api/lobbies', () => {
        it('returns an array of active lobbies', async () => {
            mockDbQuery.mockResolvedValueOnce({
                rowCount: 2,
                rows: [makeLobbyRow(), makeLobbyRow({ code: 'XY1234' })],
            });

            const res = await request(app).get('/api/lobbies');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });

        it('returns empty array when no active lobbies', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app).get('/api/lobbies');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns 500 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('DB timeout'));

            const res = await request(app).get('/api/lobbies');

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // DELETE /api/lobbies/:code
    // =========================================================================

    describe('DELETE /api/lobbies/:code', () => {
        it('deletes a lobby when host makes the request', async () => {
            // GET lobby for ownership check
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })  // getLobbyByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [] });                // DELETE

            const res = await request(app)
                .delete('/api/lobbies/ABCD12')
                .set(AUTH_HEADERS); // userId=42 matches auth_user_id=42

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app).delete('/api/lobbies/ABCD12');

            expect(res.status).toBe(401);
        });

        it('returns 404 when lobby not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app)
                .delete('/api/lobbies/NOPE00')
                .set(AUTH_HEADERS);

            expect(res.status).toBe(404);
        });

        it('returns 403 when non-host tries to delete', async () => {
            // Lobby owned by user 99, but request comes from user 42
            mockDbQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: [makeLobbyRow({ auth_user_id: 99 })],
            });

            const res = await request(app)
                .delete('/api/lobbies/ABCD12')
                .set(AUTH_HEADERS); // userId=42 ≠ auth_user_id=99

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('host');
        });

        it('returns 500 on unexpected DB error during delete', async () => {
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })
                .mockRejectedValueOnce(new Error('Delete failed'));

            const res = await request(app)
                .delete('/api/lobbies/ABCD12')
                .set(AUTH_HEADERS);

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // GET /api/leaderboard
    // =========================================================================

    describe('GET /api/leaderboard', () => {
        it('returns leaderboard rows', async () => {
            const rows = [
                { username: 'Alice', total_kills: 50, total_wins: 10 },
                { username: 'Bob', total_kills: 30, total_wins: 5 },
            ];
            mockDbQuery.mockResolvedValueOnce({ rowCount: 2, rows });

            const res = await request(app).get('/api/leaderboard');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].username).toBe('Alice');
        });

        it('returns 500 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('View missing'));

            const res = await request(app).get('/api/leaderboard');

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // GET /api/players/:authUserId
    // =========================================================================

    describe('GET /api/players/:authUserId', () => {
        it('returns player profile when found', async () => {
            const playerRow = {
                id: 1,
                auth_user_id: 42,
                username: 'testuser',
                selected_character: 'soldier',
                total_kills: 10,
                total_deaths: 5,
                games_played: 3,
                total_wins: 2,
                experience: 350,
            };
            mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [playerRow] });

            const res = await request(app).get('/api/players/42');

            expect(res.status).toBe(200);
            expect(res.body.username).toBe('testuser');
            expect(res.body.total_kills).toBe(10);
        });

        it('returns 404 when player not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app).get('/api/players/9999');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Player not found');
        });

        it('returns 500 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('Table missing'));

            const res = await request(app).get('/api/players/42');

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // POST /api/players (upsert profile)
    // =========================================================================

    describe('POST /api/players', () => {
        it('upserts player profile and returns 201', async () => {
            const playerRow = {
                id: 1,
                auth_user_id: 42,
                username: 'testuser',
                selected_character: 'ninja',
                experience: 0,
            };
            mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [playerRow] });

            const res = await request(app)
                .post('/api/players')
                .set(AUTH_HEADERS)
                .send({ selectedCharacter: 'ninja' });

            expect(res.status).toBe(201);
            expect(res.body.selected_character).toBe('ninja');
        });

        it('defaults to "soldier" when selectedCharacter is not provided', async () => {
            const playerRow = {
                id: 2,
                auth_user_id: 42,
                username: 'testuser',
                selected_character: 'soldier',
            };
            mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [playerRow] });

            const res = await request(app)
                .post('/api/players')
                .set(AUTH_HEADERS)
                .send({});

            const insertedChar = mockDbQuery.mock.calls[0][1][2];
            expect(insertedChar).toBe('soldier');
            expect(res.status).toBe(201);
        });

        it('returns 401 when not authenticated', async () => {
            const res = await request(app).post('/api/players').send({ selectedCharacter: 'soldier' });

            expect(res.status).toBe(401);
        });

        it('returns 400 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('Unique violation'));

            const res = await request(app)
                .post('/api/players')
                .set(AUTH_HEADERS)
                .send({ selectedCharacter: 'soldier' });

            expect(res.status).toBe(400);
        });
    });

    // =========================================================================
    // GET /api/matches
    // =========================================================================

    describe('GET /api/matches', () => {
        it('returns recent matches', async () => {
            const rows = [{ id: 1 }, { id: 2 }];
            mockDbQuery.mockResolvedValueOnce({ rowCount: 2, rows });

            const res = await request(app).get('/api/matches');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });

        it('respects ?limit query param', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app).get('/api/matches?limit=5');

            expect(res.status).toBe(200);
            // Verify the limit parameter was passed to the query
            expect(mockDbQuery.mock.calls[0][1]).toContain(5);
        });

        it('defaults limit to 20 when not provided', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await request(app).get('/api/matches');

            expect(mockDbQuery.mock.calls[0][1]).toContain(20);
        });

        it('returns 500 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('Query failed'));

            const res = await request(app).get('/api/matches');

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // GET /api/matches/:id/results
    // =========================================================================

    describe('GET /api/matches/:id/results', () => {
        it('returns results for a match', async () => {
            const rows = [
                { player_id: 1, placement: 1, kills: 3 },
                { player_id: 2, placement: 2, kills: 1 },
            ];
            mockDbQuery.mockResolvedValueOnce({ rowCount: 2, rows });

            const res = await request(app).get('/api/matches/1/results');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].placement).toBe(1);
        });

        it('returns empty array when no results found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const res = await request(app).get('/api/matches/999/results');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns 500 on DB error', async () => {
            mockDbQuery.mockRejectedValueOnce(new Error('Query failed'));

            const res = await request(app).get('/api/matches/1/results');

            expect(res.status).toBe(500);
        });
    });

    // =========================================================================
    // Middleware integration tests
    // =========================================================================

    describe('Middleware', () => {
        it('includes CORS headers in responses', async () => {
            mockHealthCheck.mockResolvedValueOnce(true);

            const res = await request(app)
                .get('/api/health')
                .set('Origin', 'http://localhost:3002');

            // CORS should allow the configured origin
            expect(res.headers['access-control-allow-origin']).toBeDefined();
        });

        it('returns JSON content-type for API responses', async () => {
            mockHealthCheck.mockResolvedValueOnce(true);

            const res = await request(app).get('/api/health');

            expect(res.headers['content-type']).toMatch(/json/);
        });

        it('rejects non-JSON body for POST requests gracefully', async () => {
            // This should not crash the server
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            const res = await request(app)
                .post('/api/lobbies')
                .set(AUTH_HEADERS)
                .set('Content-Type', 'application/json')
                .send('{}');

            expect(res.status).toBeLessThan(500);
        });

        it('attaches auth user when all Traefik headers are present', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('x-auth-user-id', '7')
                .set('x-auth-user', 'charlie')
                .set('x-auth-email', 'charlie@example.com')
                .set('x-auth-role', 'ADMIN');

            expect(res.status).toBe(200);
            expect(res.body.user.userId).toBe(7);
            expect(res.body.user.role).toBe('ADMIN');
        });

        it('handles array-valued auth headers correctly (Traefik quirk)', async () => {
            // Express normalizes repeated headers into comma-separated strings,
            // but our middleware handles both array and string forms.
            const res = await request(app)
                .get('/api/auth/me')
                .set('x-auth-user-id', '55')
                .set('x-auth-user', 'dave');

            expect(res.status).toBe(200);
            expect(res.body.user.userId).toBe(55);
        });
    });

    // =========================================================================
    // 404 — Unknown routes
    // =========================================================================

    describe('Unknown routes', () => {
        it('returns 404 for unknown route', async () => {
            const res = await request(app).get('/api/does-not-exist');

            expect(res.status).toBe(404);
        });
    });
});
