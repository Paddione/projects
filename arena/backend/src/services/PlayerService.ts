import { v4 as uuidv4 } from 'uuid';
import type {
    PlayerState,
    MapItem,
    ItemType,
    DAMAGE,
    HP,
    GAME,
} from '../types/game.js';
import { WeaponState, PISTOL_DEFAULT, MACHINE_GUN_PICKUP, WEAPON_STATS, RELOAD_DURATION_MS } from '../types/weapon.js';
import { buildPowerUpData } from '../config/powerUps.js';

const MAX_WEAPONS = 3; // pistol + 2 pickups

// Re-import constants
const DMG = { GUN: 1, MELEE: 99, ZONE: 1 } as const;
const MAX_HP = 2;
const ARMOR_BONUS = 1;

export class PlayerService {
    /**
     * Create initial player state at a spawn point
     */
    createPlayer(
        id: string,
        username: string,
        character: string,
        gender: 'male' | 'female',
        characterLevel: number,
        spawnX: number,
        spawnY: number,
        powerUpId?: string | null
    ): PlayerState {
        const pistol = { ...PISTOL_DEFAULT };
        const powerUpData = buildPowerUpData(powerUpId);

        // Apply shield bonus armor at round start
        const hasArmor = powerUpData ? powerUpData.bonusArmor > 0 : false;

        // Apply fury: set furyEndsAt to 30s from now
        if (powerUpData && powerUpId === 'power_fury') {
            powerUpData.furyEndsAt = Date.now() + 30000;
        }

        return {
            id,
            username,
            character,
            gender,
            characterLevel,
            x: spawnX,
            y: spawnY,
            rotation: 0,
            hp: MAX_HP,
            hasArmor,
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
            powerUp: powerUpId ?? null,
            powerUpData,
        };
    }

    /**
     * Apply damage to a player.
     * Returns whether the player died.
     */
    applyDamage(
        player: PlayerState,
        damage: number,
        attackerId: string
    ): { died: boolean; remainingHp: number; hasArmor: boolean } {
        if (!player.isAlive) {
            return { died: false, remainingHp: 0, hasArmor: false };
        }

        // Melee is always instant kill
        if (damage >= DMG.MELEE) {
            player.hp = 0;
            player.hasArmor = false;
            player.isAlive = false;
            player.deaths++;
            return { died: true, remainingHp: 0, hasArmor: false };
        }

        // Normal damage: armor absorbs first hit
        if (player.hasArmor) {
            player.hasArmor = false;
            // Armor absorbs the hit, HP stays the same
        } else {
            player.hp = Math.max(0, player.hp - damage);
        }

        if (player.hp <= 0) {
            player.isAlive = false;
            player.deaths++;
            return { died: true, remainingHp: 0, hasArmor: false };
        }

        return {
            died: false,
            remainingHp: player.hp,
            hasArmor: player.hasArmor,
        };
    }

    /**
     * Apply melee damage (always kills)
     */
    applyMelee(player: PlayerState, attackerId: string): boolean {
        const result = this.applyDamage(player, DMG.MELEE, attackerId);
        return result.died;
    }

    /**
     * Collect an item
     */
    collectItem(player: PlayerState, item: MapItem): boolean {
        if (!player.isAlive || item.isCollected) return false;

        if (item.type === 'health') {
            if (player.hp >= MAX_HP) return false; // Already full HP
            player.hp = Math.min(MAX_HP, player.hp + 1);
            item.isCollected = true;
            return true;
        }

        if (item.type === 'armor') {
            if (player.hasArmor) return false; // Already has armor
            player.hasArmor = true;
            item.isCollected = true;
            return true;
        }

        return false;
    }

    /**
     * Reset player for a new round
     */
    resetForRound(player: PlayerState, spawnX: number, spawnY: number): void {
        player.x = spawnX;
        player.y = spawnY;
        player.rotation = 0;
        player.hp = MAX_HP;
        player.isAlive = true;
        player.isSpectating = false;
        player.lastMoveDirection = { dx: 0, dy: 0 };
        const pistol = { ...PISTOL_DEFAULT };
        player.weapon = pistol;
        player.weapons = [pistol];
        player.activeWeaponIndex = 0;
        player.lastShotTime = 0;
        player.pose = 'stand';

        // Re-apply power-up effects each round
        if (player.powerUpData) {
            // Shield: grant starting armor
            player.hasArmor = player.powerUpData.bonusArmor > 0;
            // Fury: reset 30s window for new round
            if (player.powerUp === 'power_fury') {
                player.powerUpData.furyEndsAt = Date.now() + 30000;
            }
        } else {
            player.hasArmor = false;
        }
    }

    /**
     * Transition player to spectator mode
     */
    makeSpectator(player: PlayerState): void {
        player.isSpectating = true;
        player.isAlive = false;
    }

    /**
     * Get health display state
     */
    /**
     * Check if a player can shoot (not reloading, has ammo, cooldown elapsed)
     */
    canShoot(player: PlayerState): boolean {
        if (player.weapon.isReloading) return false;
        if (player.weapon.clipAmmo <= 0) return false;
        const stats = WEAPON_STATS[player.weapon.type];
        return (Date.now() - player.lastShotTime) >= stats.cooldownMs;
    }

    /**
     * Consume one round of ammo. Returns true if ammo was available.
     * Pistol has infinite ammo. Auto-reloads or reverts to pistol when empty.
     */
    consumeAmmo(player: PlayerState): boolean {
        if (player.weapon.type === 'pistol') return true;
        if (player.weapon.clipAmmo <= 0) return false;
        player.weapon.clipAmmo--;
        if (player.weapon.clipAmmo <= 0 && player.weapon.totalAmmo > 0) {
            this.startReload(player);
        }
        if (player.weapon.clipAmmo <= 0 && player.weapon.totalAmmo <= 0) {
            // Remove depleted weapon from inventory, switch to pistol
            player.weapons.splice(player.activeWeaponIndex, 1);
            player.activeWeaponIndex = 0;
            player.weapon = player.weapons[0]; // pistol is always at index 0
        }
        return true;
    }

    /**
     * Start reloading the current weapon
     */
    startReload(player: PlayerState): void {
        if (player.weapon.type === 'pistol') return;
        if (player.weapon.isReloading) return;
        if (player.weapon.totalAmmo <= 0) return;
        if (player.weapon.clipAmmo >= player.weapon.clipSize) return;
        player.weapon.isReloading = true;
        player.weapon.reloadStartTime = Date.now();
    }

    /**
     * Tick-based reload completion check
     */
    updateReload(player: PlayerState): void {
        if (!player.weapon.isReloading || !player.weapon.reloadStartTime) return;
        if (Date.now() - player.weapon.reloadStartTime >= RELOAD_DURATION_MS) {
            const needed = player.weapon.clipSize - player.weapon.clipAmmo;
            const toLoad = Math.min(needed, player.weapon.totalAmmo);
            player.weapon.clipAmmo += toLoad;
            player.weapon.totalAmmo -= toLoad;
            player.weapon.isReloading = false;
            player.weapon.reloadStartTime = null;
        }
    }

    /**
     * Pick up a weapon into inventory. If inventory full, replaces current active weapon.
     * Returns the dropped weapon (if any) for ground spawn.
     */
    pickupWeapon(player: PlayerState, itemWeapon: WeaponState): WeaponState | null {
        const newWeapon = { ...itemWeapon };

        if (player.weapons.length < MAX_WEAPONS) {
            // Inventory has space — add and switch to it
            player.weapons.push(newWeapon);
            player.activeWeaponIndex = player.weapons.length - 1;
            player.weapon = newWeapon;
            return null;
        }

        // Inventory full — replace current active weapon (don't replace pistol at index 0)
        const replaceIndex = player.activeWeaponIndex === 0 ? 1 : player.activeWeaponIndex;
        const oldWeapon = player.weapons[replaceIndex].type !== 'pistol'
            ? { ...player.weapons[replaceIndex] } : null;
        player.weapons[replaceIndex] = newWeapon;
        player.activeWeaponIndex = replaceIndex;
        player.weapon = newWeapon;
        return oldWeapon;
    }

    /**
     * Cycle to next/prev weapon in inventory
     */
    cycleWeapon(player: PlayerState, direction: number): void {
        if (player.weapons.length <= 1) return;
        let newIndex = player.activeWeaponIndex + direction;
        if (newIndex < 0) newIndex = player.weapons.length - 1;
        if (newIndex >= player.weapons.length) newIndex = 0;
        player.activeWeaponIndex = newIndex;
        player.weapon = player.weapons[newIndex];
    }

    /**
     * Get all non-pistol weapons to drop on death
     */
    getDeathDrop(player: PlayerState): WeaponState | null {
        // Drop the best non-pistol weapon
        for (const w of player.weapons) {
            if (w.type !== 'pistol') return { ...w };
        }
        return null;
    }

    /**
     * Update the player's pose based on current action and weapon
     */
    updatePose(player: PlayerState, isShooting: boolean, isMeleeing: boolean): void {
        if (player.weapon.isReloading) {
            player.pose = 'reload';
        } else if (isMeleeing) {
            player.pose = 'hold';
        } else if (player.weapon.type === 'machine_gun') {
            player.pose = 'machine';
        } else if (player.weapon.type === 'grenade_launcher') {
            player.pose = 'machine';  // Use same pose as machine gun
        } else if (isShooting) {
            player.pose = 'gun';
        } else {
            player.pose = 'stand';
        }
    }

    /**
     * Get health display state
     */
    getHealthDisplay(player: PlayerState): string {
        if (!player.isAlive) return 'dead';
        if (player.hasArmor && player.hp === MAX_HP) return 'armored';
        if (player.hasArmor && player.hp < MAX_HP) return 'armored_injured';
        if (player.hp === MAX_HP) return 'full';
        return 'injured';
    }
}
