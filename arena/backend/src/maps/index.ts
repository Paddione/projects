import { v4 as uuidv4 } from 'uuid';
import type { GameMap, CoverObject } from '../types/game.js';
import { createCampusCourtyard } from './campus-courtyard.js';
import { createWarehouseDistrict } from './warehouse-district.js';
import { createForestClearing } from './forest-clearing.js';

export type MapId = 'campus' | 'warehouse' | 'forest';
export type MapSize = 1 | 2 | 3;

export interface MapInfo {
    id: MapId;
    name: string;
    description: string;
    create: () => GameMap;
}

export const MAP_REGISTRY: Record<MapId, MapInfo> = {
    campus: {
        id: 'campus',
        name: 'Campus Courtyard',
        description: 'Balanced symmetry with cross paths and a central fountain',
        create: createCampusCourtyard,
    },
    warehouse: {
        id: 'warehouse',
        name: 'Warehouse District',
        description: 'Tight corridors and rooms — close-quarters combat',
        create: createWarehouseDistrict,
    },
    forest: {
        id: 'forest',
        name: 'Forest Clearing',
        description: 'Open sightlines with ponds, rocks, and winding trails',
        create: createForestClearing,
    },
};

/**
 * Scale a base map by a multiplier (2x or 3x).
 * Each tile becomes an NxN block. Cover, spawns, and item spawns scale proportionally.
 */
export function scaleMap(base: GameMap, scale: MapSize): GameMap {
    if (scale === 1) return base;

    const newW = base.width * scale;
    const newH = base.height * scale;

    // Scale tiles: each tile becomes a scale×scale block
    const tiles: number[][] = Array(newH).fill(null).map(() => Array(newW).fill(0));
    for (let y = 0; y < base.height; y++) {
        for (let x = 0; x < base.width; x++) {
            const val = base.tiles[y][x];
            for (let dy = 0; dy < scale; dy++) {
                for (let dx = 0; dx < scale; dx++) {
                    tiles[y * scale + dy][x * scale + dx] = val;
                }
            }
        }
    }

    // Scale cover objects: position and size multiply
    const coverObjects: CoverObject[] = base.coverObjects.map((c) => ({
        ...c,
        id: uuidv4(),
        x: c.x * scale,
        y: c.y * scale,
        width: c.width * scale,
        height: c.height * scale,
    }));

    // Scale spawn points (tile coordinates)
    const spawnPoints = base.spawnPoints.map((sp) => ({
        ...sp,
        x: sp.x * scale,
        y: sp.y * scale,
    }));

    // Scale item spawn points (tile coordinates)
    const itemSpawnPoints = base.itemSpawnPoints.map((p) => ({
        x: p.x * scale,
        y: p.y * scale,
    }));

    return {
        width: newW,
        height: newH,
        tileSize: base.tileSize,
        tiles,
        coverObjects,
        spawnPoints,
        itemSpawnPoints,
    };
}

/**
 * Check if a tile position is blocked by a wall tile or a movement-blocking cover object.
 */
function isTileBlocked(map: GameMap, tx: number, ty: number): boolean {
    // Wall tile
    if (map.tiles[ty]?.[tx] === 1) return true;

    // Blocking cover at this tile
    const px = tx * map.tileSize;
    const py = ty * map.tileSize;
    for (const cover of map.coverObjects) {
        if (!cover.blocksMovement) continue;
        if (px < cover.x + cover.width && px + map.tileSize > cover.x &&
            py < cover.y + cover.height && py + map.tileSize > cover.y) {
            return true;
        }
    }
    return false;
}

/**
 * Ensure no spawn point sits on a wall or inside a blocking cover object.
 * If one does, spiral outward to find the nearest free tile.
 */
export function sanitizeSpawns(map: GameMap): GameMap {
    const sanitized = map.spawnPoints.map((sp) => {
        if (!isTileBlocked(map, sp.x, sp.y)) return sp;

        // Spiral search for nearest unblocked tile
        for (let radius = 1; radius < Math.max(map.width, map.height); radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                    const nx = sp.x + dx;
                    const ny = sp.y + dy;
                    if (nx < 1 || ny < 1 || nx >= map.width - 1 || ny >= map.height - 1) continue;
                    if (!isTileBlocked(map, nx, ny)) {
                        return { ...sp, x: nx, y: ny };
                    }
                }
            }
        }
        return sp; // no free tile found (shouldn't happen)
    });

    return { ...map, spawnPoints: sanitized };
}

/**
 * Create a map by ID and optional size multiplier.
 */
export function createMap(mapId: MapId = 'campus', size: MapSize = 1): GameMap {
    const info = MAP_REGISTRY[mapId];
    if (!info) {
        console.warn(`Unknown map "${mapId}", falling back to campus`);
        return sanitizeSpawns(scaleMap(MAP_REGISTRY.campus.create(), size));
    }
    return sanitizeSpawns(scaleMap(info.create(), size));
}
