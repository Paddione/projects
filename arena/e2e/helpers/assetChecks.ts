import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Page } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SpriteAtlas {
    frames: Record<string, unknown>;
    meta: {
        image: string;
        [key: string]: unknown;
    };
}

export function getDistPath(): string {
    return path.join(__dirname, '../../frontend/dist');
}

export function getSpriteAtlasPath(atlasName: string): string {
    return path.join(getDistPath(), 'assets', 'sprites', `${atlasName}.json`);
}

export function getSpritePngPath(atlasName: string): string {
    return path.join(getDistPath(), 'assets', 'sprites', `${atlasName}.png`);
}

export function getAudioPath(filename: string): string {
    return path.join(getDistPath(), 'assets', 'sfx', filename);
}

export function getMusicPath(filename: string): string {
    return path.join(getDistPath(), 'assets', 'music', filename);
}

export function readJsonFile(filePath: string): unknown {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

export const SPRITE_ATLASES = ['characters', 'cover', 'items', 'tiles', 'ui', 'weapons'];

export const AUDIO_FILES = [
    'armor_pickup',
    'bullet_impact',
    'footstep_sprint',
    'footstep_walk',
    'grenade_explode',
    'grenade_launch',
    'gunshot',
    'health_pickup',
    'match_defeat',
    'match_victory',
    'melee_swing',
    'player_death',
    'player_hit',
    'round_end',
    'round_start',
    'zone_tick',
    'zone_warning',
];

export const MUSIC_FILES = [
    'lobby',
    'battle',
    'victory',
    'defeat',
];

/**
 * Mock auth but allow assets to load (don't mock /assets/ paths).
 * This lets us test real asset loading without a live backend.
 * Only mocks auth API + blocks socket.io.
 */
export async function mockAuthNoAssetBlock(page: Page, user: unknown) {
    await page.route('**/api/auth/me', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ user }),
        })
    );

    // Block socket but allow everything else including /assets/
    await page.route('**/socket.io/**', (route) => route.abort());
}
