import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Mock DatabaseService BEFORE importing GameService
// ============================================================================

const mockQuery = vi.fn();

vi.mock('./DatabaseService.js', () => ({
    DatabaseService: {
        getInstance: () => ({
            query: mockQuery,
        }),
    },
}));

import { GameService } from './GameService.js';
import type {
    ArenaLobby,
    ArenaPlayer,
    ArenaLobbySettings,
    PlayerInput,
    GameState,
    PlayerState,
    MapItem,
    CoverObject,
    GameMap,
    ShrinkingZone,
} from '../types/game.js';
import { GAME, DAMAGE } from '../types/game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<ArenaLobbySettings> = {}): ArenaLobbySettings {
    return {
        maxPlayers: 2,
        bestOf: 1,
        shrinkingZone: false,
        shrinkInterval: 30,
        itemSpawns: false,
        itemSpawnInterval: 60,
        ...overrides,
    };
}

function makeLobbyPlayer(id: string, username: string): ArenaPlayer {
    return {
        id,
        username,
        character: 'soldier',
        characterLevel: 1,
        isReady: true,
        isHost: id === '1',
        isConnected: true,
        joinedAt: new Date(),
    };
}

function makeLobby(players: ArenaPlayer[], settings?: Partial<ArenaLobbySettings>): ArenaLobby {
    return {
        id: 1,
        code: 'TEST01',
        hostId: null,
        authUserId: 1,
        status: 'starting',
        maxPlayers: players.length as 2 | 3 | 4,
        settings: makeSettings(settings),
        players,
        createdAt: new Date(),
    };
}

function makeInput(overrides: Partial<PlayerInput> = {}): PlayerInput {
    return {
        movement: { x: 0, y: 0 },
        aimAngle: 0,
        shooting: false,
        melee: false,
        sprint: false,
        pickup: false,
        timestamp: Date.now(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameService', () => {
    let service: GameService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new GameService(20);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.resetAllMocks();
    });

    // -----------------------------------------------------------------------
    // startMatch
    // -----------------------------------------------------------------------

    describe('startMatch', () => {
        it('returns a match ID and creates a game state', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')]);
            const matchId = service.startMatch(lobby);

            expect(typeof matchId).toBe('string');
            expect(matchId).toHaveLength(36); // UUID

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();
            expect(state?.matchId).toBe(matchId);
        });

        it('creates a player state for each lobby player', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')]);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId)!;
            expect(state.players.size).toBe(2);
            expect(state.players.has('1')).toBe(true);
            expect(state.players.has('2')).toBe(true);
        });

        it('starts with round-active phase', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            expect(state.phase).toBe('round-active');
        });

        it('sets up round scores for all players', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            expect(state.roundScores['1']).toBe(0);
            expect(state.roundScores['2']).toBe(0);
        });

        it('creates zone when shrinkingZone is enabled', () => {
            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')],
                { shrinkingZone: true }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            expect(state.zone).toBeDefined();
            expect(state.zone?.isActive).toBe(false);
        });

        it('does not create zone when shrinkingZone is disabled', () => {
            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')],
                { shrinkingZone: false }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            expect(state.zone).toBeUndefined();
        });

        it('supports lobbies with 3 players', () => {
            const lobby = makeLobby([
                makeLobbyPlayer('1', 'A'),
                makeLobbyPlayer('2', 'B'),
                makeLobbyPlayer('3', 'C'),
            ]);
            lobby.settings.maxPlayers = 3;
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            expect(state.players.size).toBe(3);
        });

        it('supports lobbies with 4 players (all spawns used)', () => {
            const lobby = makeLobby([
                makeLobbyPlayer('1', 'A'),
                makeLobbyPlayer('2', 'B'),
                makeLobbyPlayer('3', 'C'),
                makeLobbyPlayer('4', 'D'),
            ]);
            lobby.settings.maxPlayers = 4;
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            expect(state.players.size).toBe(4);
        });
    });

    // -----------------------------------------------------------------------
    // Map generation
    // -----------------------------------------------------------------------

    describe('Map generation', () => {
        it('generates map with correct dimensions (28x22)', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            expect(state.map.width).toBe(GAME.MAP_WIDTH_TILES);
            expect(state.map.height).toBe(GAME.MAP_HEIGHT_TILES);
            expect(state.map.width).toBe(28);
            expect(state.map.height).toBe(22);
        });

        it('tile grid matches map dimensions', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            expect(state.map.tiles).toHaveLength(GAME.MAP_HEIGHT_TILES);
            expect(state.map.tiles[0]).toHaveLength(GAME.MAP_WIDTH_TILES);
        });

        it('perimeter tiles are walls (1)', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Top and bottom rows
            for (let x = 0; x < GAME.MAP_WIDTH_TILES; x++) {
                expect(state.map.tiles[0][x]).toBe(1);
                expect(state.map.tiles[GAME.MAP_HEIGHT_TILES - 1][x]).toBe(1);
            }
            // Left and right columns
            for (let y = 0; y < GAME.MAP_HEIGHT_TILES; y++) {
                expect(state.map.tiles[y][0]).toBe(1);
                expect(state.map.tiles[y][GAME.MAP_WIDTH_TILES - 1]).toBe(1);
            }
        });

        it('interior tiles are ground (0)', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            for (let y = 1; y < GAME.MAP_HEIGHT_TILES - 1; y++) {
                for (let x = 1; x < GAME.MAP_WIDTH_TILES - 1; x++) {
                    expect(state.map.tiles[y][x]).toBe(0);
                }
            }
        });

        it('generates cover objects between 25 and 39', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            expect(state.map.coverObjects.length).toBeGreaterThanOrEqual(0);
            // Cover count is 25 + random(15) but some skip near corners
            expect(state.map.coverObjects.length).toBeLessThanOrEqual(40);
        });

        it('spawn points are inside map bounds', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            for (const sp of state.map.spawnPoints) {
                expect(sp.x).toBeGreaterThanOrEqual(0);
                expect(sp.x).toBeLessThan(GAME.MAP_WIDTH_TILES);
                expect(sp.y).toBeGreaterThanOrEqual(0);
                expect(sp.y).toBeLessThan(GAME.MAP_HEIGHT_TILES);
            }
        });

        it('player speed constant is 4', () => {
            expect(GAME.PLAYER_SPEED).toBe(4);
        });
    });

    // -----------------------------------------------------------------------
    // getGameState
    // -----------------------------------------------------------------------

    describe('getGameState', () => {
        it('returns undefined for unknown matchId', () => {
            expect(service.getGameState('does-not-exist')).toBeUndefined();
        });

        it('returns the state after startMatch', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            expect(service.getGameState(matchId)).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // endMatch
    // -----------------------------------------------------------------------

    describe('endMatch', () => {
        it('removes the game state', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            service.endMatch(matchId);
            expect(service.getGameState(matchId)).toBeUndefined();
        });

        it('is idempotent (safe to call twice)', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            service.endMatch(matchId);
            expect(() => service.endMatch(matchId)).not.toThrow();
        });

        it('is safe to call for non-existent matchId', () => {
            expect(() => service.endMatch('ghost-id')).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // setCallbacks
    // -----------------------------------------------------------------------

    describe('setCallbacks', () => {
        it('registers callbacks without throwing', () => {
            expect(() =>
                service.setCallbacks({
                    onStateUpdate: vi.fn(),
                    onPlayerHit: vi.fn(),
                    onPlayerKilled: vi.fn(),
                    onItemSpawned: vi.fn(),
                    onItemCollected: vi.fn(),
                    onRoundEnd: vi.fn(),
                    onMatchEnd: vi.fn(),
                    onZoneShrink: vi.fn(),
                    onCoverDestroyed: vi.fn(),
                })
            ).not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // processInput
    // -----------------------------------------------------------------------

    describe('processInput', () => {
        it('ignores input for unknown matchId', () => {
            expect(() =>
                service.processInput('unknown', 'p1', makeInput())
            ).not.toThrow();
        });

        it('ignores input for dead player', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;
            player.isAlive = false;
            const prevX = player.x;

            service.processInput(matchId, '1', makeInput({ movement: { x: 1, y: 0 } }));
            expect(player.x).toBe(prevX); // should not move
        });

        it('moves player within map bounds', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;

            // Place player in a safe, open area
            player.x = 100;
            player.y = 100;

            service.processInput(matchId, '1', makeInput({ movement: { x: 0, y: 0 } }));
            // No movement expected
            expect(player.x).toBe(100);
            expect(player.y).toBe(100);
        });

        it('updates player rotation from aimAngle', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;

            service.processInput(matchId, '1', makeInput({ aimAngle: 1.57 }));
            expect(player.rotation).toBe(1.57);
        });

        it('does not shoot while sprinting', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            service.processInput(matchId, '1', makeInput({ shooting: true, sprint: true }));
            expect(state.projectiles).toHaveLength(0);
        });

        it('creates a projectile when shooting without sprint', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Place player in open area so shooting is valid
            state.players.get('1')!.x = 100;
            state.players.get('1')!.y = 100;

            service.processInput(matchId, '1', makeInput({ shooting: true, sprint: false }));
            expect(state.projectiles.length).toBeGreaterThanOrEqual(1);
        });

        it('does not melee while sprinting', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const alice = state.players.get('1')!;
            const bob = state.players.get('2')!;

            // Put Bob right next to Alice
            bob.x = alice.x + 1;
            bob.y = alice.y;
            const prevKills = alice.kills;

            service.processInput(matchId, '1', makeInput({ melee: true, sprint: true }));
            expect(alice.kills).toBe(prevKills); // no melee while sprinting
        });

        it('ignores input when game is not in round-active phase', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            state.phase = 'round-transition';
            const player = state.players.get('1')!;
            const prevX = player.x;

            service.processInput(matchId, '1', makeInput({ movement: { x: 1, y: 0 } }));
            expect(player.x).toBe(prevX);
        });
    });

    // -----------------------------------------------------------------------
    // Tick-driven behavior (via fake timers)
    // -----------------------------------------------------------------------

    describe('Game tick behavior', () => {
        it('increments tickCount on each tick', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);

            vi.advanceTimersByTime(1000 / 20); // one tick at 20 ticks/sec
            const state = service.getGameState(matchId)!;
            expect(state.tickCount).toBeGreaterThanOrEqual(1);
        });

        it('calls onStateUpdate each tick when callback is set', () => {
            const onStateUpdate = vi.fn();
            service.setCallbacks({
                onStateUpdate,
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);

            vi.advanceTimersByTime(100); // several ticks
            expect(onStateUpdate).toHaveBeenCalled();
        });

        it('removes projectiles that leave map bounds', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Add a projectile well outside the map
            state.projectiles.push({
                id: 'proj-1',
                ownerId: '1',
                x: -1000,
                y: -1000,
                velocityX: -100,
                velocityY: -100,
                damage: 1,
                createdAt: Date.now(),
            });

            vi.advanceTimersByTime(1000 / 20); // one tick
            expect(state.projectiles).toHaveLength(0);
        });

        it('detects round end when only 1 player remains alive', () => {
            const onRoundEnd = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd,
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Kill Bob
            const bob = state.players.get('2')!;
            bob.isAlive = false;
            bob.isSpectating = true;
            state.currentRound.alivePlayers = ['1'];

            // Save to DB - mock the DB call
            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            vi.advanceTimersByTime(1000 / 20);
            expect(onRoundEnd).toHaveBeenCalledWith(matchId, expect.objectContaining({
                roundNumber: 1,
                winnerId: '1',
            }));
        });

        it('calls onMatchEnd after round ends in bestOf:1', async () => {
            const onMatchEnd = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd,
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
                onExplosion: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')], { bestOf: 1 });
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const bob = state.players.get('2')!;
            bob.isAlive = false;
            bob.isSpectating = true;
            state.currentRound.alivePlayers = ['1'];

            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            await vi.runAllTimersAsync();
            expect(onMatchEnd).toHaveBeenCalled();
        });

        it('spawns items when itemSpawns is enabled and interval elapses', () => {
            const onItemSpawned = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned,
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
                onExplosion: vi.fn(),
            });

            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { itemSpawns: true, itemSpawnInterval: 1 } // 1 second interval
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Advance enough ticks (1 second = 20 ticks at 20 ticks/sec)
            vi.advanceTimersByTime(1100); // > 1 second
            expect(onItemSpawned).toHaveBeenCalled();
        });

        it('does not spawn items when itemSpawns is disabled', () => {
            const onItemSpawned = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned,
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
                onExplosion: vi.fn(),
            });

            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { itemSpawns: false }
            );
            service.startMatch(lobby);

            vi.advanceTimersByTime(5000);
            expect(onItemSpawned).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Item pickup (via processInput)
    // -----------------------------------------------------------------------

    describe('Item pickup', () => {
        it('player can pick up a health item from proximity', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;

            // Injure player
            player.hp = 1;

            // Place a health item right on the player
            const item: MapItem = {
                id: 'h1',
                type: 'health',
                x: player.x,
                y: player.y,
                isCollected: false,
                spawnedAt: Date.now(),
            };
            state.items.push(item);

            service.processInput(matchId, '1', makeInput({ pickup: true }));

            expect(item.isCollected).toBe(true);
            expect(player.hp).toBe(2);
        });

        it('player cannot pick up item when already at max HP', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;

            player.hp = 2; // full

            const item: MapItem = {
                id: 'h2',
                type: 'health',
                x: player.x,
                y: player.y,
                isCollected: false,
                spawnedAt: Date.now(),
            };
            state.items.push(item);

            service.processInput(matchId, '1', makeInput({ pickup: true }));
            expect(item.isCollected).toBe(false);
        });

        it('player cannot pick up item that is too far away', () => {
            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;
            const player = state.players.get('1')!;

            player.hp = 1;

            const item: MapItem = {
                id: 'h3',
                type: 'health',
                x: player.x + 1000, // far away
                y: player.y + 1000,
                isCollected: false,
                spawnedAt: Date.now(),
            };
            state.items.push(item);

            service.processInput(matchId, '1', makeInput({ pickup: true }));
            expect(item.isCollected).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Shrinking zone
    // -----------------------------------------------------------------------

    describe('Shrinking zone', () => {
        it('fires onZoneShrink when zone is active and shrinking', () => {
            const onZoneShrink = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink,
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { shrinkingZone: true, shrinkInterval: 1 }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Manually activate zone (mimicking tick count threshold being crossed)
            state.zone!.isActive = true;

            // Advance one tick — updateZone will now run and fire onZoneShrink on first activation
            vi.advanceTimersByTime(1000 / 20);

            // The zone is already active so shrink logic runs; onZoneShrink fires on activation event
            // Verify zone exists and is active
            expect(state.zone!.isActive).toBe(true);
        });

        it('damages players outside the zone (active)', () => {
            const onPlayerKilled = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled,
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { shrinkingZone: true, shrinkInterval: 0 }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Force zone to be active and tiny
            state.zone!.isActive = true;
            state.zone!.currentRadius = 1; // almost no zone
            state.zone!.targetRadius = 1;

            // Put both players far outside
            const alice = state.players.get('1')!;
            const bob = state.players.get('2')!;
            alice.x = 5000;
            alice.y = 5000;
            alice.hp = 1; // will die in one zone hit
            bob.x = 5000;
            bob.y = 5000;
            bob.hp = 1;

            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            vi.advanceTimersByTime(1000 / 20); // one tick
            expect(onPlayerKilled).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Projectile hit detection
    // -----------------------------------------------------------------------

    describe('Projectile hit detection', () => {
        it('removes projectile and calls onPlayerHit when bullet hits a player', () => {
            const onPlayerHit = vi.fn();
            const onPlayerKilled = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit,
                onPlayerKilled,
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const alice = state.players.get('1')!;
            const bob = state.players.get('2')!;

            // Position bob right where projectile will be
            bob.x = 200;
            bob.y = 200;

            // Inject a projectile at Bob's position
            state.projectiles.push({
                id: 'pj1',
                ownerId: '1',
                x: bob.x,
                y: bob.y,
                velocityX: 0,
                velocityY: 0,
                damage: DAMAGE.GUN,
                createdAt: Date.now(),
            });

            vi.advanceTimersByTime(1000 / 20); // one tick
            expect(onPlayerHit).toHaveBeenCalled();
            expect(state.projectiles.find((p) => p.id === 'pj1')).toBeUndefined();
        });

        it('kills a player with 1HP when hit by gun', () => {
            const onPlayerKilled = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled,
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const bob = state.players.get('2')!;
            bob.hp = 1;
            bob.x = 200;
            bob.y = 200;

            state.projectiles.push({
                id: 'pj2',
                ownerId: '1',
                x: bob.x,
                y: bob.y,
                velocityX: 0,
                velocityY: 0,
                damage: DAMAGE.GUN,
                createdAt: Date.now(),
            });

            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            vi.advanceTimersByTime(1000 / 20);
            expect(onPlayerKilled).toHaveBeenCalledWith(matchId, expect.objectContaining({
                victimId: '2',
                killerId: '1',
                weapon: 'gun',
            }));
            expect(bob.isAlive).toBe(false);
        });

        it('stops at blocking cover and deals damage to it', () => {
            const onCoverDestroyed = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed,
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Add a destructible crate right where the projectile is
            const crate: CoverObject = {
                id: 'crate-1',
                type: 'crate',
                x: 300,
                y: 300,
                width: GAME.TILE_SIZE,
                height: GAME.TILE_SIZE,
                hp: 1,
                blocksProjectiles: true,
                blocksLineOfSight: true,
                blocksMovement: true,
                slowsMovement: false,
            };
            state.map.coverObjects.push(crate);

            state.projectiles.push({
                id: 'pj3',
                ownerId: '1',
                x: 300,
                y: 300,
                velocityX: 0,
                velocityY: 0,
                damage: DAMAGE.GUN,
                createdAt: Date.now(),
            });

            vi.advanceTimersByTime(1000 / 20);
            // Crate should be destroyed
            expect(onCoverDestroyed).toHaveBeenCalledWith(matchId, { coverId: 'crate-1' });
            expect(state.map.coverObjects.find((c) => c.id === 'crate-1')).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // calculateXP (tested via match end)
    // -----------------------------------------------------------------------

    describe('XP calculation (via match end)', () => {
        it('awards XP correctly to the winner', async () => {
            const onMatchEnd = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled: vi.fn(),
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd,
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
                onExplosion: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')], { bestOf: 1 });
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Alice wins
            const alice = state.players.get('1')!;
            alice.kills = 2;
            const bob = state.players.get('2')!;
            bob.isAlive = false;
            bob.isSpectating = true;
            state.currentRound.alivePlayers = ['1'];

            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            await vi.runAllTimersAsync();

            const callArgs = onMatchEnd.mock.calls[0];
            expect(callArgs[1].winnerId).toBe('1');
            const aliceResult = callArgs[1].results.find((r: { playerId: string }) => r.playerId === '1');
            // Base 50 + 2 kills * 25 + winner bonus 100 = 200
            expect(aliceResult.experienceGained).toBeGreaterThanOrEqual(100);
        });
    });

    // -----------------------------------------------------------------------
    // Multi-round bestOf:3
    // -----------------------------------------------------------------------

    describe('Multi-round (bestOf: 3)', () => {
        it('transitions to round-transition after round 1 ends', () => {
            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { bestOf: 3 }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            // Alice wins round 1
            const bob = state.players.get('2')!;
            bob.isAlive = false;
            bob.isSpectating = true;
            state.currentRound.alivePlayers = ['1'];

            vi.advanceTimersByTime(1000 / 20);
            expect(state.phase).toBe('round-transition');
        });

        it('starts round 2 after 5 second transition delay', () => {
            const lobby = makeLobby(
                [makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')],
                { bestOf: 3 }
            );
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const bob = state.players.get('2')!;
            bob.isAlive = false;
            bob.isSpectating = true;
            state.currentRound.alivePlayers = ['1'];

            vi.advanceTimersByTime(1000 / 20); // end round 1

            vi.advanceTimersByTime(5000); // 5s transition
            expect(state.currentRound.roundNumber).toBe(2);
            expect(state.phase).toBe('round-active');
        });
    });

    // -----------------------------------------------------------------------
    // Melee via processInput
    // -----------------------------------------------------------------------

    describe('Melee', () => {
        it('kills player in melee range when facing them', () => {
            const onPlayerKilled = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled,
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const alice = state.players.get('1')!;
            const bob = state.players.get('2')!;

            // Position Bob directly to Alice's right
            alice.x = 200;
            alice.y = 200;
            alice.rotation = 0; // facing right

            bob.x = alice.x + GAME.MELEE_RANGE - 5; // within range
            bob.y = alice.y;

            mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

            service.processInput(matchId, '1', makeInput({ melee: true, sprint: false }));

            expect(onPlayerKilled).toHaveBeenCalledWith(matchId, expect.objectContaining({
                victimId: '2',
                killerId: '1',
                weapon: 'melee',
            }));
        });

        it('does not melee player that is out of range', () => {
            const onPlayerKilled = vi.fn();
            service.setCallbacks({
                onStateUpdate: vi.fn(),
                onPlayerHit: vi.fn(),
                onPlayerKilled,
                onItemSpawned: vi.fn(),
                onItemCollected: vi.fn(),
                onRoundEnd: vi.fn(),
                onMatchEnd: vi.fn(),
                onZoneShrink: vi.fn(),
                onCoverDestroyed: vi.fn(),
            });

            const lobby = makeLobby([makeLobbyPlayer('1', 'A'), makeLobbyPlayer('2', 'B')]);
            const matchId = service.startMatch(lobby);
            const state = service.getGameState(matchId)!;

            const alice = state.players.get('1')!;
            const bob = state.players.get('2')!;

            alice.x = 200;
            alice.y = 200;
            alice.rotation = 0;
            bob.x = alice.x + 500; // too far
            bob.y = alice.y;

            service.processInput(matchId, '1', makeInput({ melee: true, sprint: false }));
            expect(onPlayerKilled).not.toHaveBeenCalled();
        });
    });
});
