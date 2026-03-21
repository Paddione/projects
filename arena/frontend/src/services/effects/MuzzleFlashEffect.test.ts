import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { MuzzleFlashEffect } from './MuzzleFlashEffect';

describe('MuzzleFlashEffect', () => {
    it('creates children (sprite + spark points)', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 1, y: 0.3, z: 2 }, 0);
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('has very short lifetime (~100ms)', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 0, y: 0.3, z: 0 }, 0);
        expect(effect.update(0.05)).toBe(true); // 50ms alive
        expect(effect.update(0.1)).toBe(false); // 150ms total > ~100ms
        effect.dispose();
    });

    it('dispose cleans up', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 0, y: 0.3, z: 0 }, 0);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
