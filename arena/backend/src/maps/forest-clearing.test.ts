import { describe, it, expect } from 'vitest';
import { createForestClearing } from './forest-clearing.js';
import { GAME } from '../types/game.js';

describe('forest-clearing map', () => {
    const map = createForestClearing();

    it('has correct dimensions', () => {
        expect(map.width).toBe(GAME.MAP_WIDTH_TILES);
        expect(map.height).toBe(GAME.MAP_HEIGHT_TILES);
        expect(map.tileSize).toBe(GAME.TILE_SIZE);
    });

    it('tile grid matches map dimensions', () => {
        expect(map.tiles).toHaveLength(GAME.MAP_HEIGHT_TILES);
        for (const row of map.tiles) {
            expect(row).toHaveLength(GAME.MAP_WIDTH_TILES);
        }
    });

    it('has thick 2-tile perimeter treeline', () => {
        const W = map.width;
        const H = map.height;
        // Outer perimeter
        for (let x = 0; x < W; x++) {
            expect(map.tiles[0][x]).toBe(1);
            expect(map.tiles[H - 1][x]).toBe(1);
        }
        // Second row (inner perimeter)
        for (let x = 0; x < W; x++) {
            expect(map.tiles[1][x]).toBe(1);
            expect(map.tiles[H - 2][x]).toBe(1);
        }
    });

    it('has opened inner corners for spawn points', () => {
        // Top-left corner should be open (not wall)
        expect(map.tiles[2][2]).toBe(0);
        expect(map.tiles[2][3]).toBe(0);
        // Top-right corner
        expect(map.tiles[2][map.width - 3]).toBe(0);
        // Bottom-left corner
        expect(map.tiles[map.height - 3][2]).toBe(0);
        // Bottom-right corner
        expect(map.tiles[map.height - 3][map.width - 3]).toBe(0);
    });

    it('has dirt trail tiles (type 2)', () => {
        const pathCount = map.tiles.flat().filter(t => t === 2).length;
        expect(pathCount).toBeGreaterThan(20);
    });

    it('interior tiles are only grass (0), wall (1), or path (2)', () => {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                expect([0, 1, 2]).toContain(map.tiles[y][x]);
            }
        }
    });

    it('has 4 spawn points in corners', () => {
        expect(map.spawnPoints).toHaveLength(4);
        const corners = map.spawnPoints.map(s => s.corner);
        expect(corners).toContain('top-left');
        expect(corners).toContain('top-right');
        expect(corners).toContain('bottom-left');
        expect(corners).toContain('bottom-right');
    });

    it('spawn points are inside map bounds and not on walls', () => {
        for (const sp of map.spawnPoints) {
            expect(sp.x).toBeGreaterThanOrEqual(2);
            expect(sp.x).toBeLessThan(map.width - 2);
            expect(sp.y).toBeGreaterThanOrEqual(2);
            expect(sp.y).toBeLessThan(map.height - 2);
            // Spawn tile should not be a wall
            expect(map.tiles[sp.y][sp.x]).not.toBe(1);
        }
    });

    it('has item spawn points inside map bounds', () => {
        expect(map.itemSpawnPoints.length).toBeGreaterThan(0);
        for (const sp of map.itemSpawnPoints) {
            expect(sp.x).toBeGreaterThanOrEqual(1);
            expect(sp.x).toBeLessThan(map.width - 1);
            expect(sp.y).toBeGreaterThanOrEqual(1);
            expect(sp.y).toBeLessThan(map.height - 1);
        }
    });

    it('cover objects have valid positions and properties', () => {
        expect(map.coverObjects.length).toBeGreaterThan(0);

        for (const cover of map.coverObjects) {
            expect(cover.id).toBeTruthy();
            expect(cover.x).toBeGreaterThanOrEqual(0);
            expect(cover.y).toBeGreaterThanOrEqual(0);
            expect(cover.width).toBe(GAME.TILE_SIZE);
            expect(cover.height).toBe(GAME.TILE_SIZE);
        }
    });

    it('benches are destructible, other cover is indestructible', () => {
        for (const cover of map.coverObjects) {
            if (cover.type === 'bench') {
                expect(cover.hp).toBe(3);
            } else {
                expect(cover.hp).toBe(-1);
            }
        }
    });

    it('has more hedges and ponds than campus (organic layout)', () => {
        const hedges = map.coverObjects.filter(c => c.type === 'hedge');
        const ponds = map.coverObjects.filter(c => c.type === 'pond');
        expect(hedges.length).toBeGreaterThan(16);
        expect(ponds.length).toBeGreaterThanOrEqual(12);
    });

    it('ponds slow movement but do not block it', () => {
        const ponds = map.coverObjects.filter(c => c.type === 'pond');
        expect(ponds.length).toBeGreaterThan(0);
        for (const pond of ponds) {
            expect(pond.blocksMovement).toBe(false);
            expect(pond.slowsMovement).toBe(true);
        }
    });
});
