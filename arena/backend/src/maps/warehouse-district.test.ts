import { describe, it, expect } from 'vitest';
import { createWarehouseDistrict } from './warehouse-district.js';
import { GAME } from '../types/game.js';

describe('warehouse-district map', () => {
    const map = createWarehouseDistrict();

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
            expect(map.tiles[0][x]).toBe(1);
            expect(map.tiles[H - 1][x]).toBe(1);
        }
        for (let y = 0; y < H; y++) {
            expect(map.tiles[y][0]).toBe(1);
            expect(map.tiles[y][W - 1]).toBe(1);
        }
    });

    it('has internal wall segments creating rooms', () => {
        // Horizontal divider at row 7
        expect(map.tiles[7][1]).toBe(1);
        expect(map.tiles[7][5]).toBe(1);
        // Vertical divider at col 9
        expect(map.tiles[1][9]).toBe(1);
        expect(map.tiles[5][9]).toBe(1);
    });

    it('has doorway gaps in internal walls', () => {
        // Gap between horizontal walls at row 7 (x=12..15)
        expect(map.tiles[7][12]).not.toBe(1);
        expect(map.tiles[7][13]).not.toBe(1);
    });

    it('has loading lanes (path tiles) in central corridor', () => {
        for (let y = 2; y < map.height - 2; y++) {
            // Central corridor columns 12-15 should have paths where no wall
            const hasCorridor = [12, 13, 14, 15].some(x => map.tiles[y][x] === 2);
            expect(hasCorridor).toBe(true);
        }
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

    it('spawn points are inside map bounds', () => {
        for (const sp of map.spawnPoints) {
            expect(sp.x).toBeGreaterThanOrEqual(1);
            expect(sp.x).toBeLessThan(map.width - 1);
            expect(sp.y).toBeGreaterThanOrEqual(1);
            expect(sp.y).toBeLessThan(map.height - 1);
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

    it('has more buildings than campus (dense close-quarters layout)', () => {
        const buildings = map.coverObjects.filter(c => c.type === 'building');
        expect(buildings.length).toBeGreaterThan(20);
    });
});
