// arena/frontend/src/services/CoverRenderer.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Group, Mesh, LineSegments, CylinderGeometry, SphereGeometry, CircleGeometry, BoxGeometry } from 'three';
import { CoverRenderer } from './CoverRenderer';
import { TextureFactory } from './TextureFactory';

describe('CoverRenderer', () => {
    let group: Group;
    let factory: TextureFactory;
    let renderer: CoverRenderer;

    beforeEach(() => {
        group = new Group();
        factory = new TextureFactory();
        renderer = new CoverRenderer(group, factory);
    });

    afterEach(() => {
        renderer.dispose();
        factory.dispose();
    });

    const makeCover = (type: string, id: number = 1, hp: number = -1) => ({
        id, x: 100, y: 100, type, hp, width: 32, height: 32,
    });

    it('creates a mesh for each cover type', () => {
        renderer.update([makeCover('building')]);
        expect(group.children.length).toBeGreaterThan(0);
    });

    it('building uses BoxGeometry', () => {
        renderer.update([makeCover('building')]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    });

    it('fountain uses CylinderGeometry', () => {
        renderer.update([makeCover('fountain')]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        expect(mesh.geometry).toBeInstanceOf(CylinderGeometry);
    });

    it('hedge uses SphereGeometry', () => {
        renderer.update([makeCover('hedge')]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        expect(mesh.geometry).toBeInstanceOf(SphereGeometry);
    });

    it('pond uses CircleGeometry', () => {
        renderer.update([makeCover('pond')]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        expect(mesh.geometry).toBeInstanceOf(CircleGeometry);
    });

    it('bench uses BoxGeometry with reduced height', () => {
        renderer.update([makeCover('bench', 1, 3)]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    });

    it('adds edge glow LineSegments as child of mesh', () => {
        renderer.update([makeCover('building')]);
        const mesh = group.children.find(c => c instanceof Mesh) as Mesh;
        const edgeGlow = mesh.children.find(c => c instanceof LineSegments);
        expect(edgeGlow).toBeTruthy();
    });

    it('removes mesh when cover is destroyed (hp=0)', () => {
        renderer.update([makeCover('building', 1, 3)]);
        expect(group.children.length).toBeGreaterThan(0);
        renderer.update([makeCover('building', 1, 0)]);
        expect(group.children.filter(c => c instanceof Mesh)).toHaveLength(0);
    });

    it('updates bench texture on HP change', () => {
        renderer.update([makeCover('bench', 1, 3)]);
        const meshBefore = group.children.find(c => c instanceof Mesh) as Mesh;
        const matBefore = (meshBefore.material as any).map;

        renderer.update([makeCover('bench', 1, 1)]);
        const meshAfter = group.children.find(c => c instanceof Mesh) as Mesh;
        const matAfter = (meshAfter.material as any).map;

        expect(matAfter).not.toBe(matBefore);
    });

    it('dispose cleans up all meshes', () => {
        renderer.update([makeCover('building'), makeCover('hedge', 2)]);
        renderer.dispose();
        expect(group.children).toHaveLength(0);
    });
});
