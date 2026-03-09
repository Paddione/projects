/**
 * AssetService — PixiJS Spritesheet Preloader & Typed Accessor
 *
 * Loads all sprite sheet atlases on game start and provides typed access
 * to individual sprites and animation frame sequences.
 *
 * Characters use a POSE-BASED system (single sprite rotated in-engine)
 * instead of 8-directional animations.
 */

import { Assets, Spritesheet, Texture, type UnresolvedAsset } from 'pixi.js';

const ATLAS_KEYS = ['characters', 'items', 'weapons', 'tiles', 'cover', 'ui'] as const;
type AtlasKey = (typeof ATLAS_KEYS)[number];

const ASSETS_BASE = '/assets/sprites';

/** Character pose — maps to sprite pack file suffixes */
export type CharacterPose = 'stand' | 'gun' | 'machine' | 'reload' | 'hold' | 'silencer';

class AssetServiceImpl {
    private loaded = false;
    private spritesheets: Partial<Record<AtlasKey, Spritesheet>> = {};

    get isLoaded(): boolean {
        return this.loaded;
    }

    async loadAll(onProgress?: (progress: number) => void): Promise<void> {
        if (this.loaded) return;

        const bundles: UnresolvedAsset[] = [];
        for (const key of ATLAS_KEYS) {
            bundles.push({ alias: key, src: `${ASSETS_BASE}/${key}.json` });
        }

        Assets.addBundle('arena-sprites', bundles);
        const assets = await Assets.loadBundle('arena-sprites', (progress) => {
            onProgress?.(progress);
        });

        for (const key of ATLAS_KEYS) {
            if (assets[key] instanceof Spritesheet) {
                this.spritesheets[key] = assets[key];
            }
        }

        this.loaded = true;
    }

    /**
     * Get a character pose texture. Characters are single sprites rotated in-engine.
     *
     * @param characterId e.g. 'warrior', 'rogue', 'mage', 'tank', 'zombie'
     * @param pose e.g. 'stand', 'gun', 'machine', 'reload', 'hold'
     * @returns Single Texture or null if not found
     */
    getCharacterPose(characterId: string, pose: CharacterPose): Texture | null {
        const sheet = this.spritesheets.characters;
        if (!sheet) return null;

        // Try animation key first (from pack_sprites.ts)
        const animKey = `${characterId}_${pose}`;
        const animFrames = sheet.animations?.[animKey];
        if (animFrames && animFrames.length > 0) {
            return animFrames[0];
        }

        // Fallback: direct frame lookup
        const frameName = `${characterId}/${characterId}-${pose}-00`;
        return sheet.textures?.[frameName] ?? null;
    }

    /**
     * Get a single sprite texture from an atlas.
     */
    getSprite(category: AtlasKey, assetId: string, frame = 0): Texture | null {
        const sheet = this.spritesheets[category];
        if (!sheet) return null;

        const withFrame = `${assetId}/${assetId}-${frame.toString().padStart(2, '0')}`;
        if (sheet.textures?.[withFrame]) return sheet.textures[withFrame];
        if (sheet.textures?.[assetId]) return sheet.textures[assetId];

        return null;
    }

    /**
     * Get animation frames for a non-character asset (items, weapons).
     */
    getItemAnimation(category: AtlasKey, assetId: string): Texture[] {
        const sheet = this.spritesheets[category];
        if (!sheet) return [];

        const animKey = `${assetId}_idle`;
        if (sheet.animations?.[animKey]) return sheet.animations[animKey];

        const frames: Texture[] = [];
        for (let i = 0; i < 10; i++) {
            const tex = this.getSprite(category, assetId, i);
            if (tex) frames.push(tex);
            else break;
        }
        return frames;
    }

    /**
     * Get floor tile textures for tiling.
     */
    getFloorTiles(): Texture[] {
        const tiles: Texture[] = [];
        for (let i = 1; i <= 4; i++) {
            const tex = this.getSprite('tiles', `floor_0${i}`);
            if (tex) tiles.push(tex);
        }
        return tiles;
    }

    hasAtlas(key: AtlasKey): boolean {
        return key in this.spritesheets;
    }
}

export const AssetService = new AssetServiceImpl();
