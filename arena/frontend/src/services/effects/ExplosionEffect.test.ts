import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { ExplosionEffect } from './ExplosionEffect';

describe('ExplosionEffect', () => {
    it('creates multiple children (shockwave + particles + light)', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 1, y: 0, z: 2 }, 2);
        expect(group.children.length).toBeGreaterThanOrEqual(3);
        effect.dispose();
    });

    it('stays alive during 600ms lifetime', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        expect(effect.update(0.3)).toBe(true);
        effect.dispose();
    });

    it('dies after lifetime', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        expect(effect.update(0.7)).toBe(false);
        effect.dispose();
    });

    it('dispose cleans up all children', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
