import { describe, it, expect } from 'vitest';
import { createMap, scaleMap, MAP_REGISTRY, type MapId, type MapSize } from './index.js';
import { GAME } from '../types/game.js';

describe('Map registry', () => {
    it('contains all three maps', () => {
        expect(Object.keys(MAP_REGISTRY)).toEqual(['campus', 'warehouse', 'forest']);
    });

    it('each registry entry has required metadata', () => {
        for (const [id, info] of Object.entries(MAP_REGISTRY)) {
            expect(info.id).toBe(id);
            expect(info.name).toBeTruthy();
            expect(info.description).toBeTruthy();
            expect(typeof info.create).toBe('function');
        }
    });

    it('each map creates valid GameMap with correct base dimensions', () => {
        for (const info of Object.values(MAP_REGISTRY)) {
            const map = info.create();
            expect(map.width).toBe(GAME.MAP_WIDTH_TILES);
            expect(map.height).toBe(GAME.MAP_HEIGHT_TILES);
            expect(map.tileSize).toBe(GAME.TILE_SIZE);
            expect(map.tiles).toHaveLength(map.height);
            expect(map.tiles[0]).toHaveLength(map.width);
            expect(map.spawnPoints.length).toBeGreaterThanOrEqual(4);
            expect(map.itemSpawnPoints.length).toBeGreaterThan(0);
            expect(map.coverObjects.length).toBeGreaterThan(0);
        }
    });
});

describe('createMap', () => {
    it('defaults to campus at 1x', () => {
        const map = createMap();
        expect(map.width).toBe(GAME.MAP_WIDTH_TILES);
        expect(map.height).toBe(GAME.MAP_HEIGHT_TILES);
    });

    it('creates each map by ID', () => {
        const ids: MapId[] = ['campus', 'warehouse', 'forest'];
        for (const id of ids) {
            const map = createMap(id);
            expect(map.width).toBe(GAME.MAP_WIDTH_TILES);
            expect(map.height).toBe(GAME.MAP_HEIGHT_TILES);
        }
    });

    it('falls back to campus for unknown map ID', () => {
        const map = createMap('nonexistent' as MapId);
        expect(map.width).toBe(GAME.MAP_WIDTH_TILES);
    });

    it('applies size multiplier', () => {
        const map2x = createMap('campus', 2);
        expect(map2x.width).toBe(GAME.MAP_WIDTH_TILES * 2);
        expect(map2x.height).toBe(GAME.MAP_HEIGHT_TILES * 2);

        const map3x = createMap('campus', 3);
        expect(map3x.width).toBe(GAME.MAP_WIDTH_TILES * 3);
        expect(map3x.height).toBe(GAME.MAP_HEIGHT_TILES * 3);
    });
});

describe('scaleMap', () => {
    const base = MAP_REGISTRY.campus.create();

    it('returns original map at scale 1', () => {
        const scaled = scaleMap(base, 1);
        expect(scaled).toBe(base); // same reference
    });

    it('doubles tile grid dimensions at 2x', () => {
        const scaled = scaleMap(base, 2);
        expect(scaled.width).toBe(base.width * 2);
        expect(scaled.height).toBe(base.height * 2);
        expect(scaled.tiles).toHaveLength(base.height * 2);
        expect(scaled.tiles[0]).toHaveLength(base.width * 2);
    });

    it('triples tile grid dimensions at 3x', () => {
        const scaled = scaleMap(base, 3);
        expect(scaled.width).toBe(base.width * 3);
        expect(scaled.height).toBe(base.height * 3);
        expect(scaled.tiles).toHaveLength(base.height * 3);
        expect(scaled.tiles[0]).toHaveLength(base.width * 3);
    });

    it('preserves tile size (pixels per tile unchanged)', () => {
        const scaled = scaleMap(base, 2);
        expect(scaled.tileSize).toBe(GAME.TILE_SIZE);
    });

    it('scales each tile into NxN block', () => {
        const scaled = scaleMap(base, 2);
        // Check a wall tile (perimeter top-left corner: 0,0)
        expect(scaled.tiles[0][0]).toBe(1);
        expect(scaled.tiles[0][1]).toBe(1);
        expect(scaled.tiles[1][0]).toBe(1);
        expect(scaled.tiles[1][1]).toBe(1);

        // Check an interior grass tile at (5,5) -> (10,10) in 2x
        const originalTile = base.tiles[5][5];
        expect(scaled.tiles[10][10]).toBe(originalTile);
        expect(scaled.tiles[10][11]).toBe(originalTile);
        expect(scaled.tiles[11][10]).toBe(originalTile);
        expect(scaled.tiles[11][11]).toBe(originalTile);
    });

    it('scales cover object positions and sizes', () => {
        const scaled = scaleMap(base, 2);
        expect(scaled.coverObjects).toHaveLength(base.coverObjects.length);

        for (let i = 0; i < base.coverObjects.length; i++) {
            const orig = base.coverObjects[i];
            const sc = scaled.coverObjects[i];
            expect(sc.x).toBe(orig.x * 2);
            expect(sc.y).toBe(orig.y * 2);
            expect(sc.width).toBe(orig.width * 2);
            expect(sc.height).toBe(orig.height * 2);
            // Properties preserved
            expect(sc.type).toBe(orig.type);
            expect(sc.hp).toBe(orig.hp);
            expect(sc.blocksMovement).toBe(orig.blocksMovement);
        }
    });

    it('scales spawn point coordinates', () => {
        const scaled = scaleMap(base, 3);
        expect(scaled.spawnPoints).toHaveLength(base.spawnPoints.length);

        for (let i = 0; i < base.spawnPoints.length; i++) {
            expect(scaled.spawnPoints[i].x).toBe(base.spawnPoints[i].x * 3);
            expect(scaled.spawnPoints[i].y).toBe(base.spawnPoints[i].y * 3);
            expect(scaled.spawnPoints[i].corner).toBe(base.spawnPoints[i].corner);
        }
    });

    it('scales item spawn point coordinates', () => {
        const scaled = scaleMap(base, 2);
        expect(scaled.itemSpawnPoints).toHaveLength(base.itemSpawnPoints.length);

        for (let i = 0; i < base.itemSpawnPoints.length; i++) {
            expect(scaled.itemSpawnPoints[i].x).toBe(base.itemSpawnPoints[i].x * 2);
            expect(scaled.itemSpawnPoints[i].y).toBe(base.itemSpawnPoints[i].y * 2);
        }
    });

    it('generates new UUIDs for scaled cover objects', () => {
        const scaled = scaleMap(base, 2);
        const baseIds = new Set(base.coverObjects.map(c => c.id));
        for (const cover of scaled.coverObjects) {
            expect(baseIds.has(cover.id)).toBe(false);
        }
    });

    it('works with all map types at all sizes', () => {
        const ids: MapId[] = ['campus', 'warehouse', 'forest'];
        const sizes: MapSize[] = [1, 2, 3];

        for (const id of ids) {
            for (const size of sizes) {
                const map = createMap(id, size);
                expect(map.width).toBe(GAME.MAP_WIDTH_TILES * size);
                expect(map.height).toBe(GAME.MAP_HEIGHT_TILES * size);
                expect(map.tiles).toHaveLength(map.height);
                expect(map.tiles[0]).toHaveLength(map.width);
                expect(map.spawnPoints.length).toBeGreaterThanOrEqual(4);
            }
        }
    });
});
