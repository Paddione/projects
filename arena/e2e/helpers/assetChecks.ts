import fs from 'fs';
import path from 'path';

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
    'grenade_pin_pull',
    'gunshot_pistol',
    'hit_armor',
    'hit_flesh',
    'item_spawn',
    'match_end',
    'match_start',
    'player_death',
    'player_knock',
    'player_pickup',
    'round_end',
    'round_start',
    'zone_shrink_warning',
];

export const MUSIC_FILES = [
    'lobby_loop',
    'battle_loop',
    'victory_sting',
    'defeat_sting',
];
