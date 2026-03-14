import { describe, it, expect } from 'vitest';
import { createCampusCourtyard, CAMPUS_COURTYARD_COVER_COUNT } from './campus-courtyard.js';
import { GAME } from '../types/game.js';

describe('campus-courtyard map', () => {
    const map = createCampusCourtyard();

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

    it('perimeter tiles are walls (1)', () => {
        const W = map.width;
        const H = map.height;
        for (let x = 0; x < W; x++) {
            expect(map.tiles[0][x]).toBe(1);     // top
            expect(map.tiles[H - 1][x]).toBe(1); // bottom
        }
        for (let y = 0; y < H; y++) {
            expect(map.tiles[y][0]).toBe(1);     // left
            expect(map.tiles[y][W - 1]).toBe(1); // right
        }
    });

    it('interior tiles are grass (0) or path (2), not wall', () => {
        for (let y = 1; y < map.height - 1; y++) {
            for (let x = 1; x < map.width - 1; x++) {
                expect([0, 2]).toContain(map.tiles[y][x]);
            }
        }
    });

    it('has cross-shaped paths', () => {
        // Horizontal path at rows 10-11
        for (let x = 1; x < map.width - 1; x++) {
            expect(map.tiles[10][x]).toBe(2);
            expect(map.tiles[11][x]).toBe(2);
        }
        // Vertical path at cols 13-14
        for (let y = 1; y < map.height - 1; y++) {
            expect(map.tiles[y][13]).toBe(2);
            expect(map.tiles[y][14]).toBe(2);
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

    it('spawn points are inside map bounds', () => {
        for (const sp of map.spawnPoints) {
            expect(sp.x).toBeGreaterThanOrEqual(1);
            expect(sp.x).toBeLessThan(map.width - 1);
            expect(sp.y).toBeGreaterThanOrEqual(1);
            expect(sp.y).toBeLessThan(map.height - 1);
        }
    });

    it('has item spawn points', () => {
        expect(map.itemSpawnPoints.length).toBeGreaterThan(0);
        for (const sp of map.itemSpawnPoints) {
            expect(sp.x).toBeGreaterThanOrEqual(1);
            expect(sp.x).toBeLessThan(map.width - 1);
            expect(sp.y).toBeGreaterThanOrEqual(1);
            expect(sp.y).toBeLessThan(map.height - 1);
        }
    });

    it('cover objects have valid positions and properties', () => {
        expect(map.coverObjects).toHaveLength(CAMPUS_COURTYARD_COVER_COUNT);

        for (const cover of map.coverObjects) {
            expect(cover.id).toBeTruthy();
            expect(cover.x).toBeGreaterThanOrEqual(0);
            expect(cover.y).toBeGreaterThanOrEqual(0);
            expect(cover.width).toBe(GAME.TILE_SIZE);
            expect(cover.height).toBe(GAME.TILE_SIZE);
        }
    });

    it('benches are destructible (hp > 0), other cover is indestructible', () => {
        for (const cover of map.coverObjects) {
            if (cover.type === 'bench') {
                expect(cover.hp).toBe(3);
            } else {
                expect(cover.hp).toBe(-1);
            }
        }
    });

    it('hedges and ponds do not block projectiles or LOS', () => {
        for (const cover of map.coverObjects) {
            if (cover.type === 'hedge' || cover.type === 'pond') {
                expect(cover.blocksProjectiles).toBe(false);
                expect(cover.blocksLineOfSight).toBe(false);
            }
        }
    });

    it('ponds slow movement but do not block it', () => {
        const ponds = map.coverObjects.filter(c => c.type === 'pond');
        expect(ponds.length).toBeGreaterThan(0);
        for (const pond of ponds) {
            expect(pond.blocksMovement).toBe(false);
            expect(pond.slowsMovement).toBe(true);
        }
    });

    it('buildings and fountains block movement and projectiles', () => {
        const solids = map.coverObjects.filter(c => c.type === 'building' || c.type === 'fountain');
        expect(solids.length).toBeGreaterThan(0);
        for (const cover of solids) {
            expect(cover.blocksMovement).toBe(true);
            expect(cover.blocksProjectiles).toBe(true);
        }
    });

    it('has 4-way symmetry in cover placement (4 quadrants)', () => {
        const buildings = map.coverObjects.filter(c => c.type === 'building');
        const hedges = map.coverObjects.filter(c => c.type === 'hedge');
        const benches = map.coverObjects.filter(c => c.type === 'bench');
        const ponds = map.coverObjects.filter(c => c.type === 'pond');
        const fountains = map.coverObjects.filter(c => c.type === 'fountain');

        // 5 building tiles per quadrant × 4 = 20
        expect(buildings).toHaveLength(20);
        // 4 hedges per quadrant × 4 = 16
        expect(hedges).toHaveLength(16);
        // 3 benches per quadrant × 4 = 12
        expect(benches).toHaveLength(12);
        // 4 pond tiles per quadrant × 4 = 16
        expect(ponds).toHaveLength(16);
        // 4 fountain tiles at center
        expect(fountains).toHaveLength(4);
    });
});
