import { v4 as uuidv4 } from 'uuid';
import type { GameMap, CoverObject, SpawnPoint } from '../types/game.js';
import { GAME } from '../types/game.js';

const W = GAME.MAP_WIDTH_TILES;  // 28
const H = GAME.MAP_HEIGHT_TILES; // 22
const T = GAME.TILE_SIZE;        // 32

// Tile grid: 0=concrete floor, 1=wall (perimeter + internal walls), 2=path (loading lanes)
function createTiles(): number[][] {
    const tiles: number[][] = Array(H).fill(null).map(() => Array(W).fill(0));

    // Perimeter walls
    for (let x = 0; x < W; x++) { tiles[0][x] = 1; tiles[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { tiles[y][0] = 1; tiles[y][W - 1] = 1; }

    // Internal wall segments — create corridors and rooms
    // Horizontal dividers (with gaps for doorways)
    for (let x = 1; x < 12; x++) { tiles[7][x] = 1; }
    // Gap at x=12
    for (let x = 16; x < W - 1; x++) { tiles[7][x] = 1; }

    for (let x = 1; x < 12; x++) { tiles[14][x] = 1; }
    // Gap at x=12
    for (let x = 16; x < W - 1; x++) { tiles[14][x] = 1; }

    // Vertical dividers (with gaps)
    for (let y = 1; y < 7; y++) { tiles[y][9] = 1; }
    for (let y = 8; y < 14; y++) { tiles[y][9] = 1; }
    for (let y = 15; y < H - 1; y++) { tiles[y][9] = 1; }

    for (let y = 1; y < 7; y++) { tiles[y][18] = 1; }
    for (let y = 8; y < 14; y++) { tiles[y][18] = 1; }
    for (let y = 15; y < H - 1; y++) { tiles[y][18] = 1; }

    // Loading lanes (paths) — horizontal through center corridor
    for (let x = 12; x < 16; x++) {
        for (let y = 1; y < H - 1; y++) {
            if (tiles[y][x] !== 1) tiles[y][x] = 2;
        }
    }

    return tiles;
}

type CoverDef = { type: CoverObject['type']; tx: number; ty: number };

// Dense cover layout — crate stacks, pillars, benches in tight spaces
const COVER_DEFS: CoverDef[] = [
    // === Central loading area (between vertical walls) ===
    { type: 'fountain', tx: 13, ty: 10 }, // forklift station (reuse fountain type)
    { type: 'fountain', tx: 14, ty: 11 },

    // === Top-left room ===
    // Crate cluster (buildings = crate stacks)
    { type: 'building', tx: 2, ty: 2 }, { type: 'building', tx: 3, ty: 2 },
    { type: 'building', tx: 2, ty: 3 },
    { type: 'building', tx: 6, ty: 4 }, { type: 'building', tx: 7, ty: 4 },
    { type: 'bench', tx: 4, ty: 5 }, { type: 'bench', tx: 5, ty: 2 },
    { type: 'hedge', tx: 8, ty: 2 }, { type: 'hedge', tx: 8, ty: 5 },

    // === Top-right room ===
    { type: 'building', tx: 24, ty: 2 }, { type: 'building', tx: 25, ty: 2 },
    { type: 'building', tx: 25, ty: 3 },
    { type: 'building', tx: 20, ty: 4 }, { type: 'building', tx: 21, ty: 4 },
    { type: 'bench', tx: 22, ty: 5 }, { type: 'bench', tx: 23, ty: 2 },
    { type: 'hedge', tx: 19, ty: 2 }, { type: 'hedge', tx: 19, ty: 5 },

    // === Middle-left room ===
    { type: 'building', tx: 2, ty: 9 }, { type: 'building', tx: 3, ty: 9 },
    { type: 'building', tx: 2, ty: 10 },
    { type: 'building', tx: 6, ty: 11 }, { type: 'building', tx: 7, ty: 11 },
    { type: 'bench', tx: 4, ty: 12 }, { type: 'bench', tx: 5, ty: 9 },
    { type: 'hedge', tx: 8, ty: 10 }, { type: 'hedge', tx: 8, ty: 12 },
    { type: 'pond', tx: 3, ty: 12 }, { type: 'pond', tx: 4, ty: 12 },

    // === Middle-right room ===
    { type: 'building', tx: 24, ty: 9 }, { type: 'building', tx: 25, ty: 9 },
    { type: 'building', tx: 25, ty: 10 },
    { type: 'building', tx: 20, ty: 11 }, { type: 'building', tx: 21, ty: 11 },
    { type: 'bench', tx: 22, ty: 12 }, { type: 'bench', tx: 23, ty: 9 },
    { type: 'hedge', tx: 19, ty: 10 }, { type: 'hedge', tx: 19, ty: 12 },
    { type: 'pond', tx: 24, ty: 12 }, { type: 'pond', tx: 25, ty: 12 },

    // === Bottom-left room ===
    { type: 'building', tx: 2, ty: 16 }, { type: 'building', tx: 3, ty: 16 },
    { type: 'building', tx: 2, ty: 17 },
    { type: 'building', tx: 6, ty: 18 }, { type: 'building', tx: 7, ty: 18 },
    { type: 'bench', tx: 4, ty: 19 }, { type: 'bench', tx: 5, ty: 16 },
    { type: 'hedge', tx: 8, ty: 16 }, { type: 'hedge', tx: 8, ty: 19 },

    // === Bottom-right room ===
    { type: 'building', tx: 24, ty: 16 }, { type: 'building', tx: 25, ty: 16 },
    { type: 'building', tx: 25, ty: 17 },
    { type: 'building', tx: 20, ty: 18 }, { type: 'building', tx: 21, ty: 18 },
    { type: 'bench', tx: 22, ty: 19 }, { type: 'bench', tx: 23, ty: 16 },
    { type: 'hedge', tx: 19, ty: 16 }, { type: 'hedge', tx: 19, ty: 19 },

    // === Corridor pillars (along the central loading lane) ===
    { type: 'building', tx: 13, ty: 3 },
    { type: 'building', tx: 14, ty: 5 },
    { type: 'building', tx: 13, ty: 16 },
    { type: 'building', tx: 14, ty: 18 },
];

function createCover(): CoverObject[] {
    return COVER_DEFS.map((def) => ({
        id: uuidv4(),
        type: def.type,
        x: def.tx * T,
        y: def.ty * T,
        width: T,
        height: T,
        hp: def.type === 'bench' ? 3 : -1,
        blocksProjectiles: def.type !== 'hedge' && def.type !== 'pond',
        blocksLineOfSight: def.type !== 'hedge' && def.type !== 'pond',
        blocksMovement: def.type !== 'pond',
        slowsMovement: def.type === 'pond',
    }));
}

const SPAWN_POINTS: SpawnPoint[] = [
    { x: 2, y: 2, corner: 'top-left' },
    { x: W - 3, y: 2, corner: 'top-right' },
    { x: 2, y: H - 3, corner: 'bottom-left' },
    { x: W - 3, y: H - 3, corner: 'bottom-right' },
];

export const WAREHOUSE_ITEM_SPAWN_POINTS: { x: number; y: number }[] = [
    // Central corridor
    { x: 13, y: 7 }, { x: 14, y: 7 }, { x: 13, y: 14 }, { x: 14, y: 14 },
    // Room interiors
    { x: 5, y: 3 }, { x: 22, y: 3 }, { x: 5, y: 18 }, { x: 22, y: 18 },
    // Doorway areas
    { x: 12, y: 7 }, { x: 15, y: 7 }, { x: 12, y: 14 }, { x: 15, y: 14 },
];

export function createWarehouseDistrict(): GameMap {
    return {
        width: W,
        height: H,
        tileSize: T,
        tiles: createTiles(),
        coverObjects: createCover(),
        spawnPoints: SPAWN_POINTS,
        itemSpawnPoints: WAREHOUSE_ITEM_SPAWN_POINTS,
    };
}
