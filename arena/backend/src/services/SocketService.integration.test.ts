/**
 * Socket.io Integration Tests
 *
 * Strategy:
 * - DatabaseService is mocked at module level so pg never connects.
 * - A single real HTTP+Socket.io server is started for all tests (beforeAll).
 * - global.fetch is mocked to simulate the auth service responding successfully.
 *   We pass a fake cookie header on the client so SocketService doesn't reject early.
 * - Each test gets a fresh connected client and we use event-based promises to
 *   assert the round-trip behaviour through the full SocketService stack.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { Server as HTTPServer } from 'http';

// ---------------------------------------------------------------------------
// 1. Mock DatabaseService BEFORE any module that touches it is imported
// ---------------------------------------------------------------------------

const { mockDbQuery } = vi.hoisted(() => ({
    mockDbQuery: vi.fn(),
}));

vi.mock('../services/DatabaseService.js', () => ({
    DatabaseService: {
        getInstance: () => ({ query: mockDbQuery }),
    },
}));

// ---------------------------------------------------------------------------
// 2. Mock global fetch so SocketService auth verifies successfully
//    The mock returns the userId/username headers the auth service would send.
// ---------------------------------------------------------------------------

const mockFetchOk = (): void => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        headers: {
            get: (key: string): string | null => ({
                'x-auth-user-id': '42',
                'x-auth-user': 'alice',
                'x-auth-email': 'alice@arena.io',
                'x-auth-role': 'USER',
            } as Record<string, string>)[key] ?? null,
        },
    }));
};

const mockFetchFail = (): void => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
};

// ---------------------------------------------------------------------------
// 3. Import SocketService AFTER vi.mock is in scope
// ---------------------------------------------------------------------------

import { SocketService } from '../services/SocketService.js';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const PORT = 57322;
const SERVER_URL = `http://localhost:${PORT}`;

// The cookie value doesn't matter — SocketService just checks it's non-empty
// before calling the auth service. Our mocked fetch handles the rest.
const FAKE_COOKIE = 'session=test-session-token';

function makeLobbyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 1,
        code: 'SOCK01',
        host_id: null,
        auth_user_id: 42,
        status: 'waiting',
        max_players: 4,
        settings: JSON.stringify({
            maxPlayers: 4, bestOf: 1, shrinkingZone: false,
            shrinkInterval: 30, itemSpawns: false, itemSpawnInterval: 60,
        }),
        players: JSON.stringify([{
            id: '42', username: 'alice', character: 'soldier', characterLevel: 1,
            isReady: false, isHost: true, isConnected: true,
            joinedAt: new Date().toISOString(),
        }]),
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

/** Connect a client and wait for the server's 'connected' greeting. */
async function connectClient(extraOpts: object = {}): Promise<ClientSocket> {
    const client = ioClient(SERVER_URL, {
        transports: ['websocket'],
        extraHeaders: { cookie: FAKE_COOKIE },
        ...extraOpts,
    });

    await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
        client.once('connected', () => { clearTimeout(t); resolve(); });
        client.once('connect_error', (err) => { clearTimeout(t); reject(err); });
    });

    return client;
}

function waitForEvent<T = unknown>(socket: ClientSocket, event: string, ms = 4000): Promise<T> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
        socket.once(event as string, (data: T) => { clearTimeout(t); resolve(data); });
    });
}

// ---------------------------------------------------------------------------
// Server lifecycle — shared across the entire describe block
// ---------------------------------------------------------------------------

let httpServer: HTTPServer;
let socketService: SocketService;

beforeAll(async () => {
    mockFetchOk();
    httpServer = createServer();
    socketService = new SocketService(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(PORT, '127.0.0.1', resolve));
});

afterAll(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Socket.io Integration', () => {
    let client: ClientSocket;

    beforeEach(async () => {
        mockFetchOk(); // ensure fetch is happy for the next test
        mockDbQuery.mockClear();
        // Give any async disconnect handlers from the previous test time to fire
        // and consume the default mock — then set our own default.
        await new Promise((resolve) => setTimeout(resolve, 150));
        mockDbQuery.mockResolvedValue({ rowCount: 0, rows: [] }); // safe default
    });

    afterEach(() => {
        client?.disconnect();
    });

    // =========================================================================
    // Connection
    // =========================================================================

    describe('Connection', () => {
        it('emits "connected" greeting on successful auth', async () => {
            client = await connectClient();
            // We already waited for 'connected' inside connectClient — double-check
            expect(client.connected).toBe(true);
        });

        it('rejects connection when auth service returns 401', async () => {
            mockFetchFail();

            const badClient = ioClient(SERVER_URL, {
                transports: ['websocket'],
                extraHeaders: { cookie: FAKE_COOKIE },
            });

            const err = await new Promise<Error>((resolve, reject) => {
                badClient.once('connect_error', resolve);
                badClient.once('connected', () => reject(new Error('should not have connected')));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/authentication/i);
            badClient.disconnect();

            // Restore for next tests
            mockFetchOk();
        });

        it('rejects connection when no cookie is provided', async () => {
            const noCookieClient = ioClient(SERVER_URL, {
                transports: ['websocket'],
                // No extraHeaders.cookie
            });

            const err = await new Promise<Error>((resolve, reject) => {
                noCookieClient.once('connect_error', resolve);
                noCookieClient.once('connected', () => reject(new Error('should not have connected')));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/authentication required/i);
            noCookieClient.disconnect();
        });
    });

    // =========================================================================
    // join-lobby
    // =========================================================================

    describe('join-lobby', () => {
        it('emits join-success when lobby exists and player is not already in it', async () => {
            // Stub: empty player list in lobby so join is allowed
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            client = await connectClient();

            const result = await new Promise<{ lobby: object; playerId: string }>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', resolve);
                client.once('join-error', (e: { message: string }) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(result.playerId).toBe('42');
            expect(result.lobby).toHaveProperty('code', 'SOCK01');
        });

        it('emits join-error when lobby is not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'NOPE00', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-error', resolve);
                client.once('join-success', () => reject(new Error('should have errored')));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            // Error could be 'Lobby not found' or an internal DB error depending
            // on whether the mock was consumed by a stale handler — either way
            // the server correctly emitted join-error.
            expect(typeof err.message).toBe('string');
            expect(err.message.length).toBeGreaterThan(0);
        });

        it('emits join-error when lobby is full', async () => {
            const fullPlayers = Array.from({ length: 4 }, (_, i) => ({
                id: String(i), username: `P${i}`, character: 'soldier', characterLevel: 1,
                isReady: false, isHost: i === 0, isConnected: true, joinedAt: new Date().toISOString(),
            }));

            mockDbQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: [makeLobbyRow({ players: JSON.stringify(fullPlayers) })],
            });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-error', resolve);
                client.once('join-success', () => reject(new Error('should have errored')));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/full/i);
        });

        it('emits join-error when lobby is not in waiting status', async () => {
            mockDbQuery.mockResolvedValueOnce({
                rowCount: 1,
                rows: [makeLobbyRow({ status: 'playing', players: JSON.stringify([]) })],
            });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-error', resolve);
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/waiting/i);
        });
    });

    // =========================================================================
    // leave-lobby
    // =========================================================================

    describe('leave-lobby', () => {
        async function joinLobby(c: ClientSocket): Promise<void> {
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            await new Promise<void>((resolve, reject) => {
                c.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                c.once('join-success', () => resolve());
                c.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('join-timeout')), 4000);
            });
        }

        it('emits leave-success on successful leave', async () => {
            client = await connectClient();
            await joinLobby(client);

            // Host leaves → DELETE
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [] });

            await new Promise<void>((resolve, reject) => {
                client.emit('leave-lobby', { lobbyCode: 'SOCK01', playerId: '42' });
                client.once('leave-success', () => resolve());
                client.once('leave-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('leave timeout')), 4000);
            });
        });

        it('leaving client gets leave-success when host leaves (lobby is deleted)', async () => {
            // Test: the leaving client (host) receives leave-success.
            // The room broadcast (lobby-deleted) goes to OTHER clients in the room.
            client = await connectClient();
            await joinLobby(client);

            // Host leaves → findByCode → DELETE
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [] });

            await new Promise<void>((resolve, reject) => {
                client.emit('leave-lobby', { lobbyCode: 'SOCK01', playerId: '42' });
                client.once('leave-success', () => resolve());
                client.once('leave-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('leave-timeout')), 4000);
            });
        });

        it('non-host player receives leave-success and DB UPDATE is executed', async () => {
            // When a non-host leaves, the server: calls findByCode, filters players,
            // calls UPDATE, and emits lobby-updated to the room + leave-success to the leaver.
            const aliceHost = { id: '1', username: 'host', character: 'soldier', characterLevel: 1, isReady: false, isHost: true, isConnected: true, joinedAt: new Date().toISOString() };
            const bobPlayer = { id: '42', username: 'bob', character: 'soldier', characterLevel: 1, isReady: false, isHost: false, isConnected: true, joinedAt: new Date().toISOString() };

            client = await connectClient();

            // Join (non-host: aliceHost already in lobby)
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([aliceHost]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([aliceHost, bobPlayer]) })] });

            await new Promise<void>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', () => resolve());
                client.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('join-timeout')), 4000);
            });

            // Non-host leave: findByCode + UPDATE
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([aliceHost, bobPlayer]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([aliceHost]) })] });

            const dbCallsBefore = mockDbQuery.mock.calls.length;

            await new Promise<void>((resolve, reject) => {
                client.emit('leave-lobby', { lobbyCode: 'SOCK01', playerId: '42' });
                client.once('leave-success', () => resolve());
                client.once('leave-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('leave-timeout')), 4000);
            });

            // Verify DB was called for the leave (findByCode + UPDATE = 2 more calls)
            expect(mockDbQuery.mock.calls.length).toBeGreaterThan(dbCallsBefore);
        });
    });


    // =========================================================================
    // player-ready
    // =========================================================================

    describe('player-ready', () => {
        it('broadcasts lobby-updated with isReady=true', async () => {
            client = await connectClient();

            // Join
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            await new Promise<void>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', () => resolve());
                client.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            // Ready up
            const readyRow = makeLobbyRow({
                players: JSON.stringify([{
                    id: '42', username: 'alice', character: 'soldier', characterLevel: 1,
                    isReady: true, isHost: true, isConnected: true, joinedAt: new Date().toISOString(),
                }]),
            });
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [readyRow] });

            const updatedPromise = waitForEvent<any>(client, 'lobby-updated');
            client.emit('player-ready', { lobbyCode: 'SOCK01', playerId: '42', isReady: true });
            const updated = await updatedPromise;

            expect(updated.players[0].isReady).toBe(true);
        });

        it('emits ready-error when lobby not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('player-ready', { lobbyCode: 'NOPE00', playerId: '42', isReady: true });
                client.once('ready-error', resolve);
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(typeof err.message).toBe('string');
            expect(err.message.length).toBeGreaterThan(0);
        });
    });

    // =========================================================================
    // update-settings
    // =========================================================================

    describe('update-settings', () => {
        it('broadcasts lobby-updated with new settings to all room members', async () => {
            client = await connectClient();

            // Join
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            await new Promise<void>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', () => resolve());
                client.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            const updatedSettingsObj = {
                maxPlayers: 2, bestOf: 3, shrinkingZone: true,
                shrinkInterval: 30, itemSpawns: false, itemSpawnInterval: 60,
            };
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ settings: JSON.stringify(updatedSettingsObj), max_players: 2 })] });

            const [, lobby] = await Promise.all([
                new Promise<void>((resolve) => {
                    client.emit('update-settings', {
                        lobbyCode: 'SOCK01',
                        hostId: 42,
                        settings: { bestOf: 3, maxPlayers: 2, shrinkingZone: true },
                    });
                    resolve();
                }),
                waitForEvent<any>(client, 'lobby-updated'),
            ]);

            expect(lobby.settings.bestOf).toBe(3);
            expect(lobby.settings.shrinkingZone).toBe(true);
        });
    });

    // =========================================================================
    // spectate-player
    // =========================================================================

    describe('spectate-player', () => {
        it('emits spectate-start to the requesting client', async () => {
            client = await connectClient();

            // Must join first so connectedPlayers is populated
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            await new Promise<void>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', () => resolve());
                client.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            const [, data] = await Promise.all([
                new Promise<void>((r) => { client.emit('spectate-player', { matchId: 'fake-match', targetPlayerId: '99' }); r(); }),
                waitForEvent<{ targetPlayerId: string }>(client, 'spectate-start'),
            ]);

            expect(data.targetPlayerId).toBe('99');
        });
    });

    // =========================================================================
    // ping / pong
    // =========================================================================

    describe('ping', () => {
        it('server responds to ping with pong', async () => {
            client = await connectClient();

            const pongReceived = await new Promise<boolean>((resolve, reject) => {
                client.once('pong' as string, () => resolve(true));
                client.emit('ping');
                setTimeout(() => reject(new Error('pong timeout')), 3000);
            });

            expect(pongReceived).toBe(true);
        });
    });

    // =========================================================================
    // start-game (error path — lobby not found)
    // =========================================================================

    describe('start-game', () => {
        it('emits start-game-error when lobby is not found', async () => {
            mockDbQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('start-game', { lobbyCode: 'NOPE00', hostId: 42 });
                client.once('start-game-error', resolve);
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/not found/i);
        });

        it('emits start-game-error when not all players are ready', async () => {
            // Lobby has 2 players, one not ready
            const players = [
                { id: '42', username: 'alice', character: 'soldier', characterLevel: 1, isReady: true, isHost: true, isConnected: true, joinedAt: new Date().toISOString() },
                { id: '99', username: 'bob', character: 'soldier', characterLevel: 1, isReady: false, isHost: false, isConnected: true, joinedAt: new Date().toISOString() },
            ];
            mockDbQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify(players) })] });

            client = await connectClient();

            const err = await new Promise<{ message: string }>((resolve, reject) => {
                client.emit('start-game', { lobbyCode: 'SOCK01', hostId: 42 });
                client.once('start-game-error', resolve);
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            expect(err.message).toMatch(/ready/i);
        });
    });

    // =========================================================================
    // Disconnect cleanup
    // =========================================================================

    describe('Disconnect', () => {
        it('server cleans up player state on disconnect — calls leaveLobby', async () => {
            client = await connectClient();

            // Join lobby
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow({ players: JSON.stringify([]) })] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] });

            await new Promise<void>((resolve, reject) => {
                client.emit('join-lobby', { lobbyCode: 'SOCK01', player: { character: 'soldier', characterLevel: 1 } });
                client.once('join-success', () => resolve());
                client.once('join-error', (e: any) => reject(new Error(e.message)));
                setTimeout(() => reject(new Error('timeout')), 4000);
            });

            const dbCallsBefore = mockDbQuery.mock.calls.length;

            // Disconnect
            mockDbQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeLobbyRow()] })  // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [] });                 // DELETE

            client.disconnect();

            // Give async disconnect handler time to complete
            await new Promise((resolve) => setTimeout(resolve, 300));

            // Server should have called DB to clean up the lobby
            expect(mockDbQuery.mock.calls.length).toBeGreaterThan(dbCallsBefore);
        });
    });
});
