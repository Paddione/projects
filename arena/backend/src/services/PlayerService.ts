import { v4 as uuidv4 } from 'uuid';
import type {
    PlayerState,
    MapItem,
    ItemType,
    DAMAGE,
    HP,
    GAME,
} from '../types/game.js';

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
        characterLevel: number,
        spawnX: number,
        spawnY: number
    ): PlayerState {
        return {
            id,
            username,
            character,
            characterLevel,
            x: spawnX,
            y: spawnY,
            rotation: 0,
            hp: MAX_HP,
            hasArmor: false,
            isAlive: true,
            isSpectating: false,
            kills: 0,
            deaths: 0,
            roundsWon: 0,
            lastMoveDirection: { dx: 0, dy: 0 },
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
        player.hasArmor = false;
        player.isAlive = true;
        player.isSpectating = false;
        player.lastMoveDirection = { dx: 0, dy: 0 };
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
    getHealthDisplay(player: PlayerState): string {
        if (!player.isAlive) return 'dead';
        if (player.hasArmor && player.hp === MAX_HP) return 'armored';
        if (player.hasArmor && player.hp < MAX_HP) return 'armored_injured';
        if (player.hp === MAX_HP) return 'full';
        return 'injured';
    }
}
