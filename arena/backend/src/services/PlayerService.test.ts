import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerService } from './PlayerService.js';
import type { PlayerState, MapItem } from '../types/game.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        id: 'p1',
        username: 'Alice',
        character: 'student',
        characterLevel: 1,
        x: 100,
        y: 100,
        rotation: 0,
        hp: 2,
        hasArmor: false,
        isAlive: true,
        isSpectating: false,
        kills: 0,
        deaths: 0,
        roundsWon: 0,
        lastMoveDirection: { dx: 0, dy: 0 },
        ...overrides,
    };
}

function makeItem(type: 'health' | 'armor', overrides: Partial<MapItem> = {}): MapItem {
    return {
        id: 'item-1',
        type,
        x: 100,
        y: 100,
        isCollected: false,
        spawnedAt: Date.now(),
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayerService', () => {
    let service: PlayerService;

    beforeEach(() => {
        service = new PlayerService();
    });

    // -----------------------------------------------------------------------
    // createPlayer
    // -----------------------------------------------------------------------

    describe('createPlayer', () => {
        it('creates a player with correct initial stats', () => {
            const player = service.createPlayer('id-1', 'Bob', 'student', 3, 50, 80);

            expect(player.id).toBe('id-1');
            expect(player.username).toBe('Bob');
            expect(player.character).toBe('student');
            expect(player.characterLevel).toBe(3);
            expect(player.x).toBe(50);
            expect(player.y).toBe(80);
            expect(player.rotation).toBe(0);
            expect(player.hp).toBe(2);
            expect(player.hasArmor).toBe(false);
            expect(player.isAlive).toBe(true);
            expect(player.isSpectating).toBe(false);
            expect(player.kills).toBe(0);
            expect(player.deaths).toBe(0);
            expect(player.roundsWon).toBe(0);
            expect(player.lastMoveDirection).toEqual({ dx: 0, dy: 0 });
        });

        it('places player at the given spawn coordinates', () => {
            const player = service.createPlayer('p', 'user', 'ninja', 1, 320, 640);
            expect(player.x).toBe(320);
            expect(player.y).toBe(640);
        });
    });

    // -----------------------------------------------------------------------
    // applyDamage
    // -----------------------------------------------------------------------

    describe('applyDamage', () => {
        it('returns early when player is already dead', () => {
            const player = makePlayer({ isAlive: false });
            const result = service.applyDamage(player, 1, 'attacker');

            expect(result).toEqual({ died: false, remainingHp: 0, hasArmor: false });
            expect(player.deaths).toBe(0); // should not increment
        });

        it('kills instantly with melee damage (>= 99)', () => {
            const player = makePlayer({ hp: 2 });
            const result = service.applyDamage(player, 99, 'attacker');

            expect(result.died).toBe(true);
            expect(result.remainingHp).toBe(0);
            expect(player.hp).toBe(0);
            expect(player.isAlive).toBe(false);
            expect(player.deaths).toBe(1);
        });

        it('melee kills even if player has armor', () => {
            const player = makePlayer({ hp: 2, hasArmor: true });
            const result = service.applyDamage(player, 99, 'attacker');

            expect(result.died).toBe(true);
            expect(result.hasArmor).toBe(false);
            expect(player.hasArmor).toBe(false);
        });

        it('armor absorbs one gun hit without reducing HP', () => {
            const player = makePlayer({ hp: 2, hasArmor: true });
            const result = service.applyDamage(player, 1, 'attacker');

            expect(result.died).toBe(false);
            expect(result.remainingHp).toBe(2);   // HP unchanged
            expect(result.hasArmor).toBe(false);   // armor consumed
            expect(player.hp).toBe(2);
            expect(player.hasArmor).toBe(false);
            expect(player.deaths).toBe(0);
        });

        it('gun reduces HP when player has no armor', () => {
            const player = makePlayer({ hp: 2, hasArmor: false });
            const result = service.applyDamage(player, 1, 'attacker');

            expect(result.died).toBe(false);
            expect(result.remainingHp).toBe(1);
            expect(player.hp).toBe(1);
            expect(player.deaths).toBe(0);
        });

        it('kills when HP drops to 0 from gun', () => {
            const player = makePlayer({ hp: 1, hasArmor: false });
            const result = service.applyDamage(player, 1, 'attacker');

            expect(result.died).toBe(true);
            expect(result.remainingHp).toBe(0);
            expect(player.hp).toBe(0);
            expect(player.isAlive).toBe(false);
            expect(player.deaths).toBe(1);
        });

        it('does not reduce HP below 0', () => {
            const player = makePlayer({ hp: 1 });
            service.applyDamage(player, 5, 'attacker'); // over-damage
            expect(player.hp).toBe(0);
        });

        it('returns hasArmor status in result after hit (no armor)', () => {
            const player = makePlayer({ hp: 2 });
            const result = service.applyDamage(player, 1, 'a');
            expect(result.hasArmor).toBe(false);
        });

        it('returns hasArmor=false in result after armor absorbed a hit', () => {
            const player = makePlayer({ hp: 2, hasArmor: true });
            const result = service.applyDamage(player, 1, 'a');
            expect(result.hasArmor).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // applyMelee
    // -----------------------------------------------------------------------

    describe('applyMelee', () => {
        it('kills an alive player', () => {
            const player = makePlayer({ hp: 2 });
            const died = service.applyMelee(player, 'attacker');
            expect(died).toBe(true);
            expect(player.isAlive).toBe(false);
        });

        it('returns false if player was already dead', () => {
            const player = makePlayer({ isAlive: false });
            const died = service.applyMelee(player, 'attacker');
            expect(died).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // collectItem
    // -----------------------------------------------------------------------

    describe('collectItem', () => {
        it('returns false if player is dead', () => {
            const player = makePlayer({ isAlive: false });
            const item = makeItem('health');
            expect(service.collectItem(player, item)).toBe(false);
        });

        it('returns false if item is already collected', () => {
            const player = makePlayer();
            const item = makeItem('health', { isCollected: true });
            expect(service.collectItem(player, item)).toBe(false);
        });

        it('collects health item and increases HP by 1', () => {
            const player = makePlayer({ hp: 1 });
            const item = makeItem('health');
            const collected = service.collectItem(player, item);

            expect(collected).toBe(true);
            expect(player.hp).toBe(2);
            expect(item.isCollected).toBe(true);
        });

        it('returns false if player already has full HP', () => {
            const player = makePlayer({ hp: 2 });
            const item = makeItem('health');
            expect(service.collectItem(player, item)).toBe(false);
            expect(item.isCollected).toBe(false);
        });

        it('does not overheal beyond max HP', () => {
            const player = makePlayer({ hp: 1 });
            const item = makeItem('health');
            service.collectItem(player, item);
            expect(player.hp).toBeLessThanOrEqual(2);
        });

        it('collects armor item and grants armor', () => {
            const player = makePlayer({ hasArmor: false });
            const item = makeItem('armor');
            const collected = service.collectItem(player, item);

            expect(collected).toBe(true);
            expect(player.hasArmor).toBe(true);
            expect(item.isCollected).toBe(true);
        });

        it('returns false if player already has armor', () => {
            const player = makePlayer({ hasArmor: true });
            const item = makeItem('armor');
            expect(service.collectItem(player, item)).toBe(false);
            expect(item.isCollected).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // resetForRound
    // -----------------------------------------------------------------------

    describe('resetForRound', () => {
        it('resets player state for a new round', () => {
            const player = makePlayer({
                x: 0,
                y: 0,
                hp: 0,
                hasArmor: true,
                isAlive: false,
                isSpectating: true,
                lastMoveDirection: { dx: 1, dy: -1 },
                rotation: 3.14,
            });

            service.resetForRound(player, 200, 300);

            expect(player.x).toBe(200);
            expect(player.y).toBe(300);
            expect(player.rotation).toBe(0);
            expect(player.hp).toBe(2);
            expect(player.hasArmor).toBe(false);
            expect(player.isAlive).toBe(true);
            expect(player.isSpectating).toBe(false);
            expect(player.lastMoveDirection).toEqual({ dx: 0, dy: 0 });
        });

        it('does not reset kills or deaths (carry-over stats)', () => {
            const player = makePlayer({ kills: 5, deaths: 3 });
            service.resetForRound(player, 10, 10);
            expect(player.kills).toBe(5);
            expect(player.deaths).toBe(3);
        });
    });

    // -----------------------------------------------------------------------
    // makeSpectator
    // -----------------------------------------------------------------------

    describe('makeSpectator', () => {
        it('sets player as spectating and not alive', () => {
            const player = makePlayer({ isAlive: true, isSpectating: false });
            service.makeSpectator(player);
            expect(player.isSpectating).toBe(true);
            expect(player.isAlive).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // getHealthDisplay
    // -----------------------------------------------------------------------

    describe('getHealthDisplay', () => {
        it('returns "dead" when player is not alive', () => {
            const player = makePlayer({ isAlive: false });
            expect(service.getHealthDisplay(player)).toBe('dead');
        });

        it('returns "armored" when player has armor and full HP', () => {
            const player = makePlayer({ hasArmor: true, hp: 2 });
            expect(service.getHealthDisplay(player)).toBe('armored');
        });

        it('returns "armored_injured" when player has armor and reduced HP', () => {
            const player = makePlayer({ hasArmor: true, hp: 1 });
            expect(service.getHealthDisplay(player)).toBe('armored_injured');
        });

        it('returns "full" when player has full HP and no armor', () => {
            const player = makePlayer({ hasArmor: false, hp: 2 });
            expect(service.getHealthDisplay(player)).toBe('full');
        });

        it('returns "injured" when player has reduced HP and no armor', () => {
            const player = makePlayer({ hasArmor: false, hp: 1 });
            expect(service.getHealthDisplay(player)).toBe('injured');
        });
    });
});
