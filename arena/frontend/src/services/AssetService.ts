/**
 * AssetService — PixiJS Spritesheet Preloader & Typed Accessor
 *
 * Loads all sprite sheet atlases on game start and provides typed access
 * to individual sprites and animation frame sequences.
 *
 * Usage:
 *   await AssetService.loadAll(onProgress);
 *   const textures = AssetService.getAnimation('student', 'walk', 'N');
 *   const texture = AssetService.getSprite('health_pack', 0);
 */

import { Assets, Spritesheet, Texture, type UnresolvedAsset } from 'pixi.js';

// Atlas definitions — each maps to a .png + .json pair in public/assets/sprites/
const ATLAS_KEYS = ['characters', 'items', 'weapons', 'tiles', 'cover', 'ui'] as const;
type AtlasKey = (typeof ATLAS_KEYS)[number];

const ASSETS_BASE = '/assets/sprites';

// Character directions (8-way, matching manifest)
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// Character animation states (matching manifest)
export type CharacterAnimation = 'idle' | 'walk' | 'gun_attack' | 'melee_attack' | 'death' | 'hit';

// Map rotation angle (radians) → nearest 8-direction
const DIRECTION_ANGLES: Record<Direction, number> = {
    N: -Math.PI / 2,
    NE: -Math.PI / 4,
    E: 0,
    SE: Math.PI / 4,
    S: Math.PI / 2,
    SW: (3 * Math.PI) / 4,
    W: Math.PI,
    NW: (-3 * Math.PI) / 4,
};

class AssetServiceImpl {
    private loaded = false;
    private loadingPromise: Promise<void> | null = null;
    private spritesheets: Partial<Record<AtlasKey, Spritesheet>> = {};

    /**
     * Whether all assets have been loaded.
     */
    get isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Load all sprite atlases. Call once at game start.
     * @param onProgress Optional callback with progress 0-1
     */
    async loadAll(onProgress?: (progress: number) => void): Promise<void> {
        if (this.loaded) return;
        // Deduplicate concurrent calls — return the same promise if already loading
        if (this.loadingPromise) return this.loadingPromise;

        const bundles: UnresolvedAsset[] = [];

        for (const key of ATLAS_KEYS) {
            bundles.push({
                alias: key,
                src: `${ASSETS_BASE}/${key}.json`,
            });
        }

        // Register all atlas assets
        Assets.addBundle('arena-sprites', bundles);

        // Load with progress tracking
        const assets = await Assets.loadBundle('arena-sprites', (progress) => {
            onProgress?.(progress);
        });

        // Store references to spritesheets
        for (const key of ATLAS_KEYS) {
            if (assets[key] instanceof Spritesheet) {
                this.spritesheets[key] = assets[key];
            }
        }

        this.loaded = true;
        this.loadingPromise = null;
    }

    /**
     * Get animation frame textures for a character.
     *
     * @param characterId e.g. 'student', 'professor', 'researcher', 'dean', 'librarian'
     * @param animation   e.g. 'idle', 'walk', 'gun_attack', 'melee_attack', 'death', 'hit'
     * @param direction   e.g. 'N', 'NE', 'E', etc.
     * @returns Array of Textures for AnimatedSprite, or empty array if not found
     */
    getAnimation(characterId: string, animation: CharacterAnimation, direction: Direction): Texture[] {
        const sheet = this.spritesheets.characters;
        if (!sheet) return [];

        // Animation key matches the format from pack_sprites.ts
        const animKey = `${characterId}_${animation}_${direction}`;
        const animFrames = sheet.animations?.[animKey];

        if (animFrames && animFrames.length > 0) {
            return animFrames;
        }

        // Fallback: try to find individual frames
        const frames: Texture[] = [];
        for (let i = 0; i < 10; i++) {
            const frameName = `${characterId}/${characterId}-${animation}-${direction}-${i.toString().padStart(2, '0')}`;
            const tex = sheet.textures?.[frameName];
            if (tex) {
                frames.push(tex);
            } else {
                break;
            }
        }

        return frames;
    }

    /**
     * Get a single sprite texture from an atlas.
     *
     * @param category Atlas category (items, weapons, tiles, cover, ui)
     * @param assetId  Asset identifier e.g. 'health_pack', 'floor_01'
     * @param frame    Frame index (default 0)
     */
    getSprite(category: AtlasKey, assetId: string, frame = 0): Texture | null {
        const sheet = this.spritesheets[category];
        if (!sheet) return null;

        // Try with frame index
        const withFrame = `${assetId}/${assetId}-${frame.toString().padStart(2, '0')}`;
        if (sheet.textures?.[withFrame]) {
            return sheet.textures[withFrame];
        }

        // Try direct name
        if (sheet.textures?.[assetId]) {
            return sheet.textures[assetId];
        }

        return null;
    }

    /**
     * Get animation frames for a non-character asset (items, weapons).
     *
     * @param category Atlas category
     * @param assetId  Asset identifier
     * @returns Array of Textures
     */
    getItemAnimation(category: AtlasKey, assetId: string): Texture[] {
        const sheet = this.spritesheets[category];
        if (!sheet) return [];

        // Check named animation
        const animKey = `${assetId}_idle`;
        if (sheet.animations?.[animKey]) {
            return sheet.animations[animKey];
        }

        // Collect numbered frames
        const frames: Texture[] = [];
        for (let i = 0; i < 10; i++) {
            const tex = this.getSprite(category, assetId, i);
            if (tex) {
                frames.push(tex);
            } else {
                break;
            }
        }

        return frames;
    }

    /**
     * Convert a rotation angle (radians) to the nearest 8-direction.
     * Used to pick the correct directional sprite for a player.
     */
    angleToDirection(angle: number): Direction {
        // Normalize to [0, 2π)
        let normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        // Find closest direction
        let closest: Direction = 'E';
        let minDiff = Infinity;

        for (const [dir, dirAngle] of Object.entries(DIRECTION_ANGLES)) {
            const dirNorm = ((dirAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            let diff = Math.abs(normalized - dirNorm);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff < minDiff) {
                minDiff = diff;
                closest = dir as Direction;
            }
        }

        return closest;
    }

    /**
     * Get all tile variant textures for floor rendering.
     */
    getFloorTiles(): Texture[] {
        const tiles: Texture[] = [];
        for (let i = 1; i <= 4; i++) {
            const tex = this.getSprite('tiles', `floor_0${i}`);
            if (tex) tiles.push(tex);
        }
        return tiles;
    }

    /**
     * Check if a specific atlas has been loaded.
     */
    hasAtlas(key: AtlasKey): boolean {
        return key in this.spritesheets;
    }
}

// Singleton export
export const AssetService = new AssetServiceImpl();
