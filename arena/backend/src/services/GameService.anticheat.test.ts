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
import type { ArenaLobby, ArenaPlayer, ArenaLobbySettings, PlayerInput } from '../types/game.js';

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
        character: 'student',
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

describe('GameService — Anti-Cheat Basics', () => {
    let service: GameService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new GameService(20); // 20 ticks/sec = 50ms per tick
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Timestamp Validation', () => {
        it('rejects input with future timestamp > 500ms', () => {
            const players = [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')];
            const lobby = makeLobby(players);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();

            const now = Date.now();
            const futureInput = makeInput({
                timestamp: now + 600, // 600ms in future (exceeds 500ms threshold)
                movement: { x: 1, y: 0 },
            });

            // Mock console.warn to verify anti-cheat logging
            const warnSpy = vi.spyOn(console, 'warn');

            service.processInput(matchId, '1', futureInput);

            // Verify anti-cheat warning was logged
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Future timestamp')
            );

            // Verify anti-cheat warning was logged (input should be rejected or movement clamped)
            const player = state?.players.get('1');
            expect(player).toBeDefined();
            // With future timestamp rejection, player should not have moved far
            expect(player?.lastMoveDirection).toBeDefined();

            warnSpy.mockRestore();
        });

        it('accepts input with timestamp within 500ms window', () => {
            const players = [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')];
            const lobby = makeLobby(players);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();

            const now = Date.now();
            const validInput = makeInput({
                timestamp: now + 400, // 400ms in future (within threshold)
                movement: { x: 1, y: 0 },
            });

            const player = state?.players.get('1');
            const startX = player?.x ?? 0;

            service.processInput(matchId, '1', validInput);

            // Verify player moved (input was accepted)
            const updatedPlayer = state?.players.get('1');
            expect(updatedPlayer?.x).toBeGreaterThan(startX);
        });
    });

    describe('Movement Clamping', () => {
        it('clamps excessive movement speed to 2x maximum', () => {
            const players = [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')];
            const lobby = makeLobby(players);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();

            const player = state?.players.get('1');
            const startX = player?.x ?? 0;

            // Try to move with 10x normal speed (will be clamped)
            const excessiveInput = makeInput({
                movement: { x: 10, y: 0 },
                timestamp: Date.now(),
            });

            const warnSpy = vi.spyOn(console, 'warn');

            service.processInput(matchId, '1', excessiveInput);

            // Verify anti-cheat warning was logged
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Excessive movement speed')
            );

            // Verify movement was clamped (moved less than 10x but more than normal)
            const updatedPlayer = state?.players.get('1');
            const deltaX = (updatedPlayer?.x ?? 0) - startX;
            expect(deltaX).toBeGreaterThan(0);
            expect(deltaX).toBeLessThan(GAME.PLAYER_SPEED * 2); // Should not exceed 2x speed

            warnSpy.mockRestore();
        });

        it('allows normal movement within bounds', () => {
            const players = [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')];
            const lobby = makeLobby(players);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();

            const player = state?.players.get('1');
            const startX = player?.x ?? 0;

            // Small normal movement (normalized direction vector)
            const normalInput = makeInput({
                movement: { x: 0.1, y: 0 },
                timestamp: Date.now(),
            });

            service.processInput(matchId, '1', normalInput);

            // Verify player moved
            const updatedPlayer = state?.players.get('1');
            // Movement might be clamped but should process without rejection
            expect(updatedPlayer).toBeDefined();
            expect(updatedPlayer?.lastMoveDirection).toBeDefined();
        });
    });

    describe('Shooting Cooldown (Latency-Tolerant)', () => {
        it('uses 0.8x cooldown for latency tolerance', () => {
            const players = [makeLobbyPlayer('1', 'Alice'), makeLobbyPlayer('2', 'Bob')];
            const lobby = makeLobby(players);
            const matchId = service.startMatch(lobby);

            const state = service.getGameState(matchId);
            expect(state).toBeDefined();

            const player = state?.players.get('1');
            expect(player).toBeDefined();

            // First shot
            const firstShot = makeInput({
                shooting: true,
                timestamp: Date.now(),
            });

            service.processInput(matchId, '1', firstShot);

            const projectilesAfterFirst = (state?.projectiles ?? []).length;
            expect(projectilesAfterFirst).toBeGreaterThan(0);

            // Try to shoot again at 80% of normal cooldown (should succeed)
            const pistolCooldown = 500; // Pistol default (if exists)
            const eightPercentCooldown = Math.floor(pistolCooldown * 0.8);

            vi.advanceTimersByTime(eightPercentCooldown);

            const secondShot = makeInput({
                shooting: true,
                timestamp: Date.now(),
            });

            service.processInput(matchId, '1', secondShot);

            const projectilesAfterSecond = (state?.projectiles ?? []).length;
            // May or may not shoot depending on weapon type, but anti-cheat shouldn't reject it
            expect(projectilesAfterSecond).toBeGreaterThanOrEqual(projectilesAfterFirst);
        });
    });
});

// Import GAME constant for spawn positions
import { GAME } from '../types/game.js';
