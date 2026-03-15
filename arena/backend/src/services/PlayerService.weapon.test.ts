import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerService } from './PlayerService.js';
import type { PlayerState } from '../types/game.js';
import { PISTOL_DEFAULT, MACHINE_GUN_PICKUP } from '../types/weapon.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
    const pistol = { ...PISTOL_DEFAULT };
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
        damageDealt: 0,
        itemsCollected: 0,
        lastMoveDirection: { dx: 0, dy: 0 },
        weapon: pistol,
        weapons: [pistol],
        activeWeaponIndex: 0,
        lastShotTime: 0,
        pose: 'stand',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlayerService — Weapon Mechanics', () => {
    let service: PlayerService;

    beforeEach(() => {
        service = new PlayerService();
    });

    it('starts with pistol (infinite ammo)', () => {
        const player = service.createPlayer('id-1', 'Bob', 'student', 3, 50, 80);

        expect(player.weapon.type).toBe('pistol');
        expect(player.weapon.clipAmmo).toBe(Infinity);
        expect(player.weapon.totalAmmo).toBe(Infinity);
        expect(service.canShoot(player)).toBe(true);
    });

    it('picks up machine gun with 30/60 ammo', () => {
        const player = makePlayer();
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });

        expect(player.weapon.type).toBe('machine_gun');
        expect(player.weapon.clipAmmo).toBe(30);
        expect(player.weapon.totalAmmo).toBe(60);
    });

    it('consumes ammo on shot', () => {
        const player = makePlayer();
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        service.consumeAmmo(player);

        expect(player.weapon.clipAmmo).toBe(29);
    });

    it('auto-reloads when clip empty', () => {
        const player = makePlayer();
        service.pickupWeapon(player, {
            ...MACHINE_GUN_PICKUP,
            clipAmmo: 1,
            totalAmmo: 60,
        });
        service.consumeAmmo(player);

        expect(player.weapon.isReloading).toBe(true);
    });

    it('discards weapon when all ammo spent', () => {
        const player = makePlayer();
        service.pickupWeapon(player, {
            ...MACHINE_GUN_PICKUP,
            clipAmmo: 1,
            totalAmmo: 0,
        });
        service.consumeAmmo(player);

        expect(player.weapon.type).toBe('pistol');
    });

    it('completes reload after 2 seconds', () => {
        const player = makePlayer();
        service.pickupWeapon(player, {
            ...MACHINE_GUN_PICKUP,
            clipAmmo: 0,
            totalAmmo: 60,
        });
        service.startReload(player);

        expect(player.weapon.isReloading).toBe(true);

        // Simulate 2001ms elapsed
        player.weapon.reloadStartTime = Date.now() - 2001;
        service.updateReload(player);

        expect(player.weapon.isReloading).toBe(false);
        expect(player.weapon.clipAmmo).toBe(30);
        expect(player.weapon.totalAmmo).toBe(30);
    });

    it('drops weapon on death / does not drop pistol', () => {
        // Machine gun should drop
        const playerWithGun = makePlayer();
        service.pickupWeapon(playerWithGun, { ...MACHINE_GUN_PICKUP });
        const drop = service.getDeathDrop(playerWithGun);

        expect(drop).not.toBeNull();
        expect(drop!.type).toBe('machine_gun');
        expect(drop!.clipAmmo).toBe(30);

        // Pistol should not drop
        const playerWithPistol = makePlayer();
        const noDrop = service.getDeathDrop(playerWithPistol);

        expect(noDrop).toBeNull();
    });
});
