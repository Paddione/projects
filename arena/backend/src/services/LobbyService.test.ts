import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Mock DatabaseService BEFORE importing LobbyService
// ============================================================================

const mockQuery = vi.fn();

vi.mock('./DatabaseService.js', () => ({
    DatabaseService: {
        getInstance: () => ({
            query: mockQuery,
        }),
    },
}));

// ============================================================================
// Now import LobbyService (it will pick up the mock)
// ============================================================================

import { LobbyService } from './LobbyService.js';
import type { ArenaPlayer } from '../types/game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
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
                username: 'Alice',
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

function makeLobbyRow(extraPlayers: ArenaPlayer[] = []): Record<string, unknown> {
    const players: ArenaPlayer[] = [
        {
            id: '42',
            username: 'Alice',
            character: 'soldier',
            characterLevel: 1,
            isReady: true,
            isHost: true,
            isConnected: true,
            joinedAt: new Date(),
        },
        ...extraPlayers,
    ];
    return makeDbRow({ players: JSON.stringify(players) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LobbyService', () => {
    let service: LobbyService;

    beforeEach(() => {
        service = new LobbyService();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    // -----------------------------------------------------------------------
    // isValidLobbyCode (static)
    // -----------------------------------------------------------------------

    describe('isValidLobbyCode', () => {
        it('accepts a valid 6-char uppercase alphanumeric code', () => {
            expect(LobbyService.isValidLobbyCode('ABC123')).toBe(true);
            expect(LobbyService.isValidLobbyCode('ZZZZZZ')).toBe(true);
            expect(LobbyService.isValidLobbyCode('000000')).toBe(true);
        });

        it('rejects codes that are too short', () => {
            expect(LobbyService.isValidLobbyCode('AB12')).toBe(false);
            expect(LobbyService.isValidLobbyCode('')).toBe(false);
        });

        it('rejects codes that are too long', () => {
            expect(LobbyService.isValidLobbyCode('ABC1234')).toBe(false);
        });

        it('rejects lowercase letters', () => {
            expect(LobbyService.isValidLobbyCode('abc123')).toBe(false);
        });

        it('rejects special characters', () => {
            expect(LobbyService.isValidLobbyCode('AB-123')).toBe(false);
            expect(LobbyService.isValidLobbyCode('AB_123')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // createLobby
    // -----------------------------------------------------------------------

    describe('createLobby', () => {
        it('creates a lobby and returns it', async () => {
            const row = makeDbRow();

            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })   // code uniqueness check
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] }); // INSERT

            const lobby = await service.createLobby({
                hostId: 42,
                username: 'Alice',
                selectedCharacter: 'soldier',
                characterLevel: 1,
            });

            expect(lobby.code).toBe('ABCD12');
            expect(lobby.authUserId).toBe(42);
            expect(lobby.status).toBe('waiting');
            expect(lobby.players).toHaveLength(1);
            expect(lobby.players[0].username).toBe('Alice');
        });

        it('merges custom settings over defaults', async () => {
            const row = makeDbRow({
                settings: JSON.stringify({
                    maxPlayers: 2,
                    bestOf: 3,
                    shrinkingZone: true,
                    shrinkInterval: 30,
                    itemSpawns: false,
                    itemSpawnInterval: 60,
                }),
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] });

            const lobby = await service.createLobby({
                hostId: 99,
                username: 'Bob',
                settings: { maxPlayers: 2, bestOf: 3, shrinkingZone: true, itemSpawns: false },
            });

            expect(lobby.settings.maxPlayers).toBe(2);
            expect(lobby.settings.bestOf).toBe(3);
            expect(lobby.settings.shrinkingZone).toBe(true);
        });

        it('throws if unique code generation exceeds 10 attempts', async () => {
            // Every uniqueness check finds existing code
            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{}] });

            await expect(
                service.createLobby({ hostId: 1, username: 'X' })
            ).rejects.toThrow('Failed to generate unique lobby code after maximum attempts');
        });

        it('defaults character to "soldier" when not specified', async () => {
            const insertSpy = vi.fn().mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });
            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockImplementationOnce(insertSpy);

            await service.createLobby({ hostId: 1, username: 'Anon' });

            const insertCall = mockQuery.mock.calls[1];
            // The 5th param is the JSON-stringified players array
            const playersJson = JSON.parse(insertCall[1][4]);
            expect(playersJson[0].character).toBe('soldier');
        });
    });

    // -----------------------------------------------------------------------
    // joinLobby
    // -----------------------------------------------------------------------

    describe('joinLobby', () => {
        it('adds a new player to the lobby', async () => {
            const row = makeDbRow();
            const updatedRow = makeDbRow({
                players: JSON.stringify([
                    {
                        id: '42',
                        username: 'Alice',
                        character: 'soldier',
                        characterLevel: 1,
                        isReady: false,
                        isHost: true,
                        isConnected: true,
                        joinedAt: new Date().toISOString(),
                    },
                    {
                        id: '99',
                        username: 'Bob',
                        character: 'ninja',
                        characterLevel: 2,
                        isReady: false,
                        isHost: false,
                        isConnected: true,
                        joinedAt: new Date().toISOString(),
                    },
                ]),
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] })     // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] }); // UPDATE

            const lobby = await service.joinLobby({
                lobbyCode: 'ABCD12',
                player: { id: '99', username: 'Bob', character: 'ninja', characterLevel: 2, isReady: false, isConnected: true },
            });

            expect(lobby.players).toHaveLength(2);
        });

        it('throws if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await expect(
                service.joinLobby({ lobbyCode: 'NOPE00', player: { id: '1', username: 'X', character: 'a', characterLevel: 1, isReady: false, isConnected: true } })
            ).rejects.toThrow('Lobby not found');
        });

        it('throws if lobby is not in waiting status', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow({ status: 'playing' })] });

            await expect(
                service.joinLobby({ lobbyCode: 'ABCD12', player: { id: '5', username: 'X', character: 'a', characterLevel: 1, isReady: false, isConnected: true } })
            ).rejects.toThrow('Cannot join lobby that is not in waiting status');
        });

        it('throws if lobby is full', async () => {
            const players = Array.from({ length: 4 }, (_, i) => ({
                id: String(i),
                username: `P${i}`,
                character: 'soldier',
                characterLevel: 1,
                isReady: false,
                isHost: i === 0,
                isConnected: true,
                joinedAt: new Date().toISOString(),
            }));

            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow({ players: JSON.stringify(players) })] });

            await expect(
                service.joinLobby({ lobbyCode: 'ABCD12', player: { id: '99', username: 'Late', character: 'a', characterLevel: 1, isReady: false, isConnected: true } })
            ).rejects.toThrow('Lobby is full');
        });

        it('reconnects player with same id (updates isConnected)', async () => {
            const reconnectedRow = makeDbRow({
                players: JSON.stringify([
                    {
                        id: '42',
                        username: 'Alice',
                        character: 'soldier',
                        characterLevel: 1,
                        isReady: false,
                        isHost: true,
                        isConnected: true,
                        joinedAt: new Date().toISOString(),
                    },
                ]),
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] })      // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [reconnectedRow] });   // UPDATE (reconnect)

            const lobby = await service.joinLobby({
                lobbyCode: 'ABCD12',
                player: { id: '42', username: 'Duplicate', character: 'a', characterLevel: 1, isReady: false, isConnected: true },
            });

            expect(lobby.players).toHaveLength(1);
            expect(lobby.players[0].isConnected).toBe(true);
        });

        it('reconnects player with same username (updates isConnected)', async () => {
            const reconnectedRow = makeDbRow({
                players: JSON.stringify([
                    {
                        id: '42',
                        username: 'Alice',
                        character: 'soldier',
                        characterLevel: 1,
                        isReady: false,
                        isHost: true,
                        isConnected: true,
                        joinedAt: new Date().toISOString(),
                    },
                ]),
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] })      // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [reconnectedRow] });   // UPDATE (reconnect)

            const lobby = await service.joinLobby({
                lobbyCode: 'ABCD12',
                player: { id: '99', username: 'alice', character: 'a', characterLevel: 1, isReady: false, isConnected: true },
            });

            expect(lobby.players).toHaveLength(1);
            expect(lobby.players[0].isConnected).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // leaveLobby
    // -----------------------------------------------------------------------

    describe('leaveLobby', () => {
        it('returns null if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const result = await service.leaveLobby('NOPE00', '1');
            expect(result).toBeNull();
        });

        it('returns null if player not in lobby', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });

            const result = await service.leaveLobby('ABCD12', '999');
            expect(result).toBeNull();
        });

        it('deletes lobby and returns null when host leaves', async () => {
            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] })  // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [] });             // DELETE

            const result = await service.leaveLobby('ABCD12', '42'); // '42' is host
            expect(result).toBeNull();

            // Verify DELETE was called
            const deleteCall = mockQuery.mock.calls[1];
            expect(deleteCall[0]).toContain('DELETE');
        });

        it('removes regular player and returns updated lobby', async () => {
            const bob: ArenaPlayer = {
                id: '99',
                username: 'Bob',
                character: 'ninja',
                characterLevel: 2,
                isReady: false,
                isHost: false,
                isConnected: true,
                joinedAt: new Date(),
            };
            const row = makeLobbyRow([bob]);
            const updatedRow = makeDbRow(); // only Alice remains

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] })          // findByCode
                .mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });   // UPDATE

            const result = await service.leaveLobby('ABCD12', '99');
            expect(result).not.toBeNull();
            // Alice is still there
            expect(result?.players[0].username).toBe('Alice');
        });
    });

    // -----------------------------------------------------------------------
    // updatePlayerReady
    // -----------------------------------------------------------------------

    describe('updatePlayerReady', () => {
        it('marks a player as ready', async () => {
            const row = makeDbRow();
            const updatedRow = makeDbRow({
                players: JSON.stringify([
                    {
                        id: '42',
                        username: 'Alice',
                        character: 'soldier',
                        characterLevel: 1,
                        isReady: true,
                        isHost: true,
                        isConnected: true,
                        joinedAt: new Date().toISOString(),
                    },
                ]),
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });

            const lobby = await service.updatePlayerReady('ABCD12', '42', true);
            expect(lobby.players[0].isReady).toBe(true);
        });

        it('throws if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await expect(
                service.updatePlayerReady('NOPE00', '42', true)
            ).rejects.toThrow('Lobby not found');
        });

        it('throws if player not in lobby', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });

            await expect(
                service.updatePlayerReady('ABCD12', '999', true)
            ).rejects.toThrow('Player not found in lobby');
        });
    });

    // -----------------------------------------------------------------------
    // updateSettings
    // -----------------------------------------------------------------------

    describe('updateSettings', () => {
        it('updates settings when host requests it', async () => {
            const updatedRow = makeDbRow({
                settings: JSON.stringify({
                    maxPlayers: 2,
                    bestOf: 3,
                    shrinkingZone: false,
                    shrinkInterval: 30,
                    itemSpawns: true,
                    itemSpawnInterval: 60,
                }),
                max_players: 2,
            });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });

            const lobby = await service.updateSettings('ABCD12', 42, { maxPlayers: 2, bestOf: 3 });
            expect(lobby.settings.bestOf).toBe(3);
        });

        it('throws if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await expect(
                service.updateSettings('NOPE00', 42, { bestOf: 3 })
            ).rejects.toThrow('Lobby not found');
        });

        it('throws if caller is not the host', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] }); // auth_user_id = 42

            await expect(
                service.updateSettings('ABCD12', 99, { bestOf: 5 }) // wrong hostId
            ).rejects.toThrow('Only the host can update lobby settings');
        });

        it('throws if lobby is not in waiting status', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow({ status: 'playing' })] });

            await expect(
                service.updateSettings('ABCD12', 42, { bestOf: 5 })
            ).rejects.toThrow('Cannot update settings after game has started');
        });
    });

    // -----------------------------------------------------------------------
    // startGame
    // -----------------------------------------------------------------------

    describe('startGame', () => {
        it('starts game when all players are ready', async () => {
            const row = makeLobbyRow([
                {
                    id: '99',
                    username: 'Bob',
                    character: 'ninja',
                    characterLevel: 2,
                    isReady: true,
                    isHost: false,
                    isConnected: true,
                    joinedAt: new Date(),
                },
            ]);
            const updatedRow = makeDbRow({ status: 'starting' });

            mockQuery
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });

            const lobby = await service.startGame('ABCD12', 42);
            expect(lobby.status).toBe('starting');
        });

        it('throws if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await expect(service.startGame('NOPE00', 42)).rejects.toThrow('Lobby not found');
        });

        it('throws if caller is not the host', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });

            await expect(service.startGame('ABCD12', 999)).rejects.toThrow('Only the host can start the game');
        });

        it('throws if lobby is not in waiting status', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow({ status: 'starting' })] });

            await expect(service.startGame('ABCD12', 42)).rejects.toThrow(
                'Cannot start game for lobby that is not in waiting status'
            );
        });

        it('throws if fewer than 2 players', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] }); // only Alice

            await expect(service.startGame('ABCD12', 42)).rejects.toThrow(
                'At least 2 players are required to start'
            );
        });

        it('throws if not all players are ready', async () => {
            const row = makeLobbyRow([
                {
                    id: '99',
                    username: 'Bob',
                    character: 'ninja',
                    characterLevel: 2,
                    isReady: false, // NOT ready
                    isHost: false,
                    isConnected: true,
                    joinedAt: new Date(),
                },
            ]);

            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [row] });

            await expect(service.startGame('ABCD12', 42)).rejects.toThrow(
                'All players must be ready to start the game'
            );
        });
    });

    // -----------------------------------------------------------------------
    // getLobbyByCode
    // -----------------------------------------------------------------------

    describe('getLobbyByCode', () => {
        it('returns lobby when found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });

            const lobby = await service.getLobbyByCode('ABCD12');
            expect(lobby).not.toBeNull();
            expect(lobby?.code).toBe('ABCD12');
        });

        it('returns null when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const lobby = await service.getLobbyByCode('NOPE00');
            expect(lobby).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // updateLobbyStatus
    // -----------------------------------------------------------------------

    describe('updateLobbyStatus', () => {
        it('updates the status successfully', async () => {
            const updatedRow = makeDbRow({ status: 'playing' });
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [updatedRow] });

            const lobby = await service.updateLobbyStatus('ABCD12', 'playing');
            expect(lobby.status).toBe('playing');
        });

        it('throws if lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            await expect(service.updateLobbyStatus('NOPE00', 'playing')).rejects.toThrow('Lobby not found');
        });
    });

    // -----------------------------------------------------------------------
    // getActiveLobbies
    // -----------------------------------------------------------------------

    describe('getActiveLobbies', () => {
        it('returns an array of lobbies', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 2, rows: [makeDbRow(), makeDbRow({ code: 'XY1234' })] });

            const lobbies = await service.getActiveLobbies();
            expect(lobbies).toHaveLength(2);
        });

        it('returns empty array when there are no active lobbies', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            const lobbies = await service.getActiveLobbies();
            expect(lobbies).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // deleteLobbyByCode
    // -----------------------------------------------------------------------

    describe('deleteLobbyByCode', () => {
        it('returns true on successful delete', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

            expect(await service.deleteLobbyByCode('ABCD12')).toBe(true);
        });

        it('returns false when lobby not found', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            expect(await service.deleteLobbyByCode('NOPE00')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // cleanupOldLobbies
    // -----------------------------------------------------------------------

    describe('cleanupOldLobbies', () => {
        it('returns count of deleted lobbies', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 3, rows: [] });

            expect(await service.cleanupOldLobbies(24)).toBe(3);
        });

        it('returns 0 when nothing was deleted', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            expect(await service.cleanupOldLobbies()).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // reconcileStaleLobbies
    // -----------------------------------------------------------------------

    describe('reconcileStaleLobbies', () => {
        it('returns count of reconciled lobbies', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 2, rows: [] });

            expect(await service.reconcileStaleLobbies()).toBe(2);
        });

        it('returns 0 when no stale lobbies', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

            expect(await service.reconcileStaleLobbies()).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // formatLobby (tested implicitly via returned data shape)
    // -----------------------------------------------------------------------

    describe('formatLobby (via createLobby)', () => {
        it('parses settings correctly when stored as string', async () => {
            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [makeDbRow()] });

            const lobby = await service.createLobby({ hostId: 42, username: 'Alice' });

            expect(typeof lobby.settings.maxPlayers).toBe('number');
            expect(lobby.settings.shrinkingZone).toBe(false);
        });

        it('parses settings correctly when stored as object (not string)', async () => {
            const settingsObj = {
                maxPlayers: 4,
                bestOf: 1,
                shrinkingZone: false,
                shrinkInterval: 30,
                itemSpawns: true,
                itemSpawnInterval: 60,
            };

            const row = makeDbRow({ settings: settingsObj }); // object, not string

            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] });

            const lobby = await service.createLobby({ hostId: 42, username: 'Alice' });
            expect(lobby.settings.maxPlayers).toBe(4);
        });

        it('handles players stored as array (not string)', async () => {
            const playersArray = [
                {
                    id: '42',
                    username: 'Alice',
                    character: 'soldier',
                    characterLevel: 1,
                    isReady: false,
                    isHost: true,
                    isConnected: true,
                    joinedAt: new Date().toISOString(),
                },
            ];

            const row = makeDbRow({ players: playersArray }); // array, not JSON string

            mockQuery
                .mockResolvedValueOnce({ rowCount: 0, rows: [] })
                .mockResolvedValueOnce({ rowCount: 1, rows: [row] });

            const lobby = await service.createLobby({ hostId: 42, username: 'Alice' });
            expect(lobby.players).toHaveLength(1);
            expect(lobby.players[0].joinedAt).toBeInstanceOf(Date);
        });
    });
});
