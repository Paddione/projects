import { v4 as uuidv4 } from 'uuid';
import type { GameMap, CoverObject, SpawnPoint } from '../types/game.js';
import { GAME } from '../types/game.js';

const W = GAME.MAP_WIDTH_TILES;  // 28
const H = GAME.MAP_HEIGHT_TILES; // 22
const T = GAME.TILE_SIZE;        // 32

// Tile grid: 0=grass, 1=dense treeline (perimeter + clusters), 2=dirt trail
function createTiles(): number[][] {
    const tiles: number[][] = Array(H).fill(null).map(() => Array(W).fill(0));

    // Thick perimeter treeline (2 tiles deep)
    for (let x = 0; x < W; x++) {
        tiles[0][x] = 1; tiles[1][x] = 1;
        tiles[H - 1][x] = 1; tiles[H - 2][x] = 1;
    }
    for (let y = 0; y < H; y++) {
        tiles[y][0] = 1; tiles[y][1] = 1;
        tiles[y][W - 1] = 1; tiles[y][W - 2] = 1;
    }
    // Re-open inner corners so spawn areas aren't fully blocked
    tiles[2][2] = 0; tiles[2][3] = 0; tiles[3][2] = 0;
    tiles[2][W - 3] = 0; tiles[2][W - 4] = 0; tiles[3][W - 3] = 0;
    tiles[H - 3][2] = 0; tiles[H - 3][3] = 0; tiles[H - 4][2] = 0;
    tiles[H - 3][W - 3] = 0; tiles[H - 3][W - 4] = 0; tiles[H - 4][W - 3] = 0;

    // Winding dirt trail — diagonal from top-left to bottom-right area
    const trailPoints = [
        [4, 4], [5, 4], [6, 5], [7, 5], [8, 6], [9, 6], [10, 7], [11, 8],
        [12, 9], [13, 10], [14, 10], [15, 11], [16, 12], [17, 13], [18, 13],
        [19, 14], [20, 15], [21, 16], [22, 17], [23, 17],
    ];
    for (const [tx, ty] of trailPoints) {
        if (tiles[ty][tx] !== 1) tiles[ty][tx] = 2;
        // Make trail 2-wide where possible
        if (tx + 1 < W && tiles[ty][tx + 1] !== 1) tiles[ty][tx + 1] = 2;
    }

    // Second trail — perpendicular, top-right to bottom-left
    const trail2 = [
        [23, 4], [22, 4], [21, 5], [20, 5], [19, 6], [18, 7], [17, 8],
        [16, 9], [15, 9], [14, 10], [13, 10], [12, 11], [11, 12], [10, 13],
        [9, 14], [8, 15], [7, 16], [6, 16], [5, 17], [4, 17],
    ];
    for (const [tx, ty] of trail2) {
        if (tiles[ty][tx] !== 1) tiles[ty][tx] = 2;
        if (ty + 1 < H && tiles[ty + 1][tx] !== 1) tiles[ty + 1][tx] = 2;
    }

    return tiles;
}

type CoverDef = { type: CoverObject['type']; tx: number; ty: number };

// Organic layout: large rocks (buildings), bushes (hedges), ponds, fallen logs (benches)
const COVER_DEFS: CoverDef[] = [
    // === Central clearing — sparse cover, high-risk area ===
    { type: 'fountain', tx: 13, ty: 10 }, // ancient stone well
    { type: 'fountain', tx: 14, ty: 11 },
    { type: 'bench', tx: 12, ty: 10 },    // fallen log
    { type: 'bench', tx: 15, ty: 11 },    // fallen log

    // === Large rock formations (buildings) — scattered near edges ===
    // North rocks
    { type: 'building', tx: 7, ty: 3 }, { type: 'building', tx: 8, ty: 3 },
    { type: 'building', tx: 20, ty: 3 }, { type: 'building', tx: 21, ty: 3 },

    // West rocks
    { type: 'building', tx: 3, ty: 8 }, { type: 'building', tx: 3, ty: 9 },
    { type: 'building', tx: 3, ty: 13 }, { type: 'building', tx: 3, ty: 14 },

    // East rocks
    { type: 'building', tx: 24, ty: 8 }, { type: 'building', tx: 24, ty: 9 },
    { type: 'building', tx: 24, ty: 13 }, { type: 'building', tx: 24, ty: 14 },

    // South rocks
    { type: 'building', tx: 7, ty: 18 }, { type: 'building', tx: 8, ty: 18 },
    { type: 'building', tx: 20, ty: 18 }, { type: 'building', tx: 21, ty: 18 },

    // === Bush clusters (hedges) — scattered throughout ===
    // NW quadrant
    { type: 'hedge', tx: 5, ty: 5 }, { type: 'hedge', tx: 6, ty: 6 },
    { type: 'hedge', tx: 9, ty: 4 }, { type: 'hedge', tx: 4, ty: 7 },
    // NE quadrant
    { type: 'hedge', tx: 22, ty: 5 }, { type: 'hedge', tx: 21, ty: 6 },
    { type: 'hedge', tx: 18, ty: 4 }, { type: 'hedge', tx: 23, ty: 7 },
    // SW quadrant
    { type: 'hedge', tx: 5, ty: 16 }, { type: 'hedge', tx: 6, ty: 15 },
    { type: 'hedge', tx: 9, ty: 17 }, { type: 'hedge', tx: 4, ty: 14 },
    // SE quadrant
    { type: 'hedge', tx: 22, ty: 16 }, { type: 'hedge', tx: 21, ty: 15 },
    { type: 'hedge', tx: 18, ty: 17 }, { type: 'hedge', tx: 23, ty: 14 },
    // Mid-field hedges
    { type: 'hedge', tx: 10, ty: 8 }, { type: 'hedge', tx: 17, ty: 8 },
    { type: 'hedge', tx: 10, ty: 13 }, { type: 'hedge', tx: 17, ty: 13 },

    // === Ponds — slow zones creating tactical chokepoints ===
    // NW pond (3 tiles L-shape)
    { type: 'pond', tx: 6, ty: 8 }, { type: 'pond', tx: 7, ty: 8 },
    { type: 'pond', tx: 6, ty: 9 },
    // NE pond
    { type: 'pond', tx: 20, ty: 8 }, { type: 'pond', tx: 21, ty: 8 },
    { type: 'pond', tx: 21, ty: 9 },
    // SW pond
    { type: 'pond', tx: 6, ty: 13 }, { type: 'pond', tx: 7, ty: 13 },
    { type: 'pond', tx: 6, ty: 14 },
    // SE pond
    { type: 'pond', tx: 20, ty: 13 }, { type: 'pond', tx: 21, ty: 13 },
    { type: 'pond', tx: 21, ty: 14 },

    // === Fallen logs (benches) — along trails ===
    { type: 'bench', tx: 8, ty: 6 }, { type: 'bench', tx: 19, ty: 6 },
    { type: 'bench', tx: 8, ty: 15 }, { type: 'bench', tx: 19, ty: 15 },
    { type: 'bench', tx: 11, ty: 9 }, { type: 'bench', tx: 16, ty: 12 },
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

// Spawn in the opened inner corners of the treeline
const SPAWN_POINTS: SpawnPoint[] = [
    { x: 3, y: 3, corner: 'top-left' },
    { x: W - 4, y: 3, corner: 'top-right' },
    { x: 3, y: H - 4, corner: 'bottom-left' },
    { x: W - 4, y: H - 4, corner: 'bottom-right' },
];

export const FOREST_ITEM_SPAWN_POINTS: { x: number; y: number }[] = [
    // Trail intersections (high traffic)
    { x: 13, y: 10 }, { x: 14, y: 11 },
    // Along trails
    { x: 8, y: 6 }, { x: 19, y: 6 }, { x: 8, y: 15 }, { x: 19, y: 15 },
    // Near rocks
    { x: 5, y: 9 }, { x: 22, y: 9 },
    { x: 5, y: 12 }, { x: 22, y: 12 },
    // Open field
    { x: 11, y: 7 }, { x: 16, y: 14 },
];

export function createForestClearing(): GameMap {
    return {
        width: W,
        height: H,
        tileSize: T,
        tiles: createTiles(),
        coverObjects: createCover(),
        spawnPoints: SPAWN_POINTS,
        itemSpawnPoints: FOREST_ITEM_SPAWN_POINTS,
    };
}
