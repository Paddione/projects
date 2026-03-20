// arena/frontend/src/services/effects/ImpactEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { ImpactEffect } from './ImpactEffect';

describe('ImpactEffect', () => {
    it('creates Points mesh and adds to parent group', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 1, y: 0.3, z: 2 });
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('returns true (alive) before lifetime expires', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        expect(effect.update(0.1)).toBe(true); // 100ms < 300ms lifetime
        effect.dispose();
    });

    it('returns false (dead) after lifetime expires', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        expect(effect.update(0.35)).toBe(false); // 350ms > 300ms lifetime
        effect.dispose();
    });

    it('dispose removes mesh from parent', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        const childCount = group.children.length;
        effect.dispose();
        expect(group.children.length).toBe(childCount - 1);
    });
});
