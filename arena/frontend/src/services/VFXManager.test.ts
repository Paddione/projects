import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Group, Scene } from 'three';

vi.mock('three', async () => {
    const actual = await vi.importActual('three');
    return actual;
});

import { VFXManager } from './VFXManager';

describe('VFXManager', () => {
    let scene: Scene;
    let vfx: VFXManager;

    beforeEach(() => {
        scene = new Scene();
        vfx = new VFXManager(scene);
    });

    it('adds effectGroup to scene on construction', () => {
        expect(scene.children).toHaveLength(1);
        expect(scene.children[0]).toBeInstanceOf(Group);
    });

    it('update with no active effects does not throw', () => {
        expect(() => vfx.update(0.016)).not.toThrow();
    });

    it('dispose removes effectGroup from scene', () => {
        vfx.dispose();
        expect(scene.children).toHaveLength(0);
    });

    it('getShakeOffset returns zero vector when no shake active', () => {
        const offset = vfx.getShakeOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
        expect(offset.z).toBe(0);
    });
});
