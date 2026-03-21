// arena/frontend/src/services/TerrainRenderer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Group, Mesh, InstancedMesh, LineSegments } from 'three';
import { TerrainRenderer } from './TerrainRenderer';
import { TextureFactory } from './TextureFactory';

describe('TerrainRenderer', () => {
    let group: Group;
    let factory: TextureFactory;
    let renderer: TerrainRenderer;

    const tiles = [
        [1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0],
        [0, 2, 2, 2, 0],
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
    ];

    beforeEach(() => {
        group = new Group();
        factory = new TextureFactory();
        renderer = new TerrainRenderer(group, factory);
    });

    afterEach(() => {
        renderer.dispose();
        factory.dispose();
    });

    it('build adds children to group', () => {
        renderer.build(tiles, 5, 5);
        expect(group.children.length).toBeGreaterThan(0);
    });

    it('creates separate wall and path InstancedMeshes', () => {
        renderer.build(tiles, 5, 5);
        const instanced = group.children.filter(c => c instanceof InstancedMesh);
        expect(instanced.length).toBe(2);
    });

    it('wall mesh has correct instance count (10 perimeter walls)', () => {
        renderer.build(tiles, 5, 5);
        const instanced = group.children.filter(c => c instanceof InstancedMesh) as InstancedMesh[];
        const wallMesh = instanced.find(m => m.count === 10);
        expect(wallMesh).toBeTruthy();
    });

    it('path mesh has correct instance count (3 path tiles)', () => {
        renderer.build(tiles, 5, 5);
        const instanced = group.children.filter(c => c instanceof InstancedMesh) as InstancedMesh[];
        const pathMesh = instanced.find(m => m.count === 3);
        expect(pathMesh).toBeTruthy();
    });

    it('creates a floor mesh (not LineSegments)', () => {
        renderer.build(tiles, 5, 5);
        const floorMesh = group.children.find(
            c => c instanceof Mesh && !(c instanceof InstancedMesh) && !(c instanceof LineSegments)
        );
        expect(floorMesh).toBeTruthy();
    });

    it('creates a boundary LineSegments', () => {
        renderer.build(tiles, 5, 5);
        const boundary = group.children.find(c => c instanceof LineSegments);
        expect(boundary).toBeTruthy();
    });

    it('clear removes all children', () => {
        renderer.build(tiles, 5, 5);
        renderer.dispose();
        expect(group.children).toHaveLength(0);
    });

    it('build after build replaces previous terrain', () => {
        renderer.build(tiles, 5, 5);
        const countBefore = group.children.length;
        renderer.build(tiles, 5, 5);
        expect(group.children.length).toBe(countBefore);
    });
});
