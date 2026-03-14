import { v4 as uuidv4 } from 'uuid';
import type { GameMap, CoverObject, SpawnPoint } from '../types/game.js';
import { GAME } from '../types/game.js';

const W = GAME.MAP_WIDTH_TILES;  // 28
const H = GAME.MAP_HEIGHT_TILES; // 22
const T = GAME.TILE_SIZE;        // 32

// Tile grid: 0=grass, 1=wall (perimeter), 2=path
function createTiles(): number[][] {
    const tiles: number[][] = Array(H).fill(null).map(() => Array(W).fill(0));

    // Perimeter walls
    for (let x = 0; x < W; x++) { tiles[0][x] = 1; tiles[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { tiles[y][0] = 1; tiles[y][W - 1] = 1; }

    // Horizontal cross path (rows 10-11, full width)
    for (let x = 1; x < W - 1; x++) { tiles[10][x] = 2; tiles[11][x] = 2; }

    // Vertical cross path (cols 13-14, full height)
    for (let y = 1; y < H - 1; y++) { tiles[y][13] = 2; tiles[y][14] = 2; }

    return tiles;
}

type CoverDef = { type: CoverObject['type']; tx: number; ty: number };

// All cover objects, hand-placed for visual balance across 4 quadrants.
// Each quadrant has: L-shaped building, 4 hedges, 3 benches, 2x2 pond.
const COVER_DEFS: CoverDef[] = [
    // === Central fountain (2x2) ===
    { type: 'fountain', tx: 13, ty: 10 },
    { type: 'fountain', tx: 14, ty: 10 },
    { type: 'fountain', tx: 13, ty: 11 },
    { type: 'fountain', tx: 14, ty: 11 },

    // === Top-left quadrant ===
    // Building L-shape
    { type: 'building', tx: 3, ty: 3 }, { type: 'building', tx: 4, ty: 3 }, { type: 'building', tx: 5, ty: 3 },
    { type: 'building', tx: 3, ty: 4 }, { type: 'building', tx: 3, ty: 5 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 12, ty: 3 }, { type: 'hedge', tx: 12, ty: 5 }, { type: 'hedge', tx: 12, ty: 7 },
    { type: 'hedge', tx: 10, ty: 9 },
    // Benches
    { type: 'bench', tx: 6, ty: 2 }, { type: 'bench', tx: 2, ty: 6 }, { type: 'bench', tx: 9, ty: 9 },
    // Pond 2x2
    { type: 'pond', tx: 8, ty: 5 }, { type: 'pond', tx: 9, ty: 5 },
    { type: 'pond', tx: 8, ty: 6 }, { type: 'pond', tx: 9, ty: 6 },

    // === Top-right quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 22, ty: 3 }, { type: 'building', tx: 23, ty: 3 }, { type: 'building', tx: 24, ty: 3 },
    { type: 'building', tx: 24, ty: 4 }, { type: 'building', tx: 24, ty: 5 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 15, ty: 3 }, { type: 'hedge', tx: 15, ty: 5 }, { type: 'hedge', tx: 15, ty: 7 },
    { type: 'hedge', tx: 17, ty: 9 },
    // Benches
    { type: 'bench', tx: 21, ty: 2 }, { type: 'bench', tx: 25, ty: 6 }, { type: 'bench', tx: 18, ty: 9 },
    // Pond 2x2
    { type: 'pond', tx: 18, ty: 5 }, { type: 'pond', tx: 19, ty: 5 },
    { type: 'pond', tx: 18, ty: 6 }, { type: 'pond', tx: 19, ty: 6 },

    // === Bottom-left quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 3, ty: 16 }, { type: 'building', tx: 3, ty: 17 },
    { type: 'building', tx: 3, ty: 18 }, { type: 'building', tx: 4, ty: 18 }, { type: 'building', tx: 5, ty: 18 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 12, ty: 14 }, { type: 'hedge', tx: 12, ty: 16 }, { type: 'hedge', tx: 12, ty: 18 },
    { type: 'hedge', tx: 10, ty: 12 },
    // Benches
    { type: 'bench', tx: 6, ty: 19 }, { type: 'bench', tx: 2, ty: 15 }, { type: 'bench', tx: 9, ty: 12 },
    // Pond 2x2
    { type: 'pond', tx: 8, ty: 15 }, { type: 'pond', tx: 9, ty: 15 },
    { type: 'pond', tx: 8, ty: 16 }, { type: 'pond', tx: 9, ty: 16 },

    // === Bottom-right quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 24, ty: 16 }, { type: 'building', tx: 24, ty: 17 },
    { type: 'building', tx: 22, ty: 18 }, { type: 'building', tx: 23, ty: 18 }, { type: 'building', tx: 24, ty: 18 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 15, ty: 14 }, { type: 'hedge', tx: 15, ty: 16 }, { type: 'hedge', tx: 15, ty: 18 },
    { type: 'hedge', tx: 17, ty: 12 },
    // Benches
    { type: 'bench', tx: 21, ty: 19 }, { type: 'bench', tx: 25, ty: 15 }, { type: 'bench', tx: 18, ty: 12 },
    // Pond 2x2
    { type: 'pond', tx: 18, ty: 15 }, { type: 'pond', tx: 19, ty: 15 },
    { type: 'pond', tx: 18, ty: 16 }, { type: 'pond', tx: 19, ty: 16 },
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

export const ITEM_SPAWN_POINTS: { x: number; y: number }[] = [
    // Horizontal path
    { x: 7, y: 10 }, { x: 7, y: 11 }, { x: 20, y: 10 }, { x: 20, y: 11 },
    // Vertical path
    { x: 13, y: 5 }, { x: 14, y: 5 }, { x: 13, y: 16 }, { x: 14, y: 16 },
    // Near center
    { x: 10, y: 10 }, { x: 17, y: 11 }, { x: 13, y: 8 }, { x: 14, y: 13 },
];

export function createCampusCourtyard(): GameMap {
    return {
        width: W,
        height: H,
        tileSize: T,
        tiles: createTiles(),
        coverObjects: createCover(),
        spawnPoints: SPAWN_POINTS,
        itemSpawnPoints: ITEM_SPAWN_POINTS,
    };
}

/** Number of cover objects in the static map (for tests). */
export const CAMPUS_COURTYARD_COVER_COUNT = COVER_DEFS.length;
