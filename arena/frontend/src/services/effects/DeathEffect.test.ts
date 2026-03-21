// arena/frontend/src/services/effects/DeathEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { DeathEffect } from './DeathEffect';

describe('DeathEffect', () => {
    it('creates particles in parent group', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 1, y: 0.5, z: 2 }, 0x00f2ff);
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('survives through 600ms lifetime', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0xff6b9d);
        expect(effect.update(0.3)).toBe(true);
        expect(effect.update(0.2)).toBe(true);
        effect.dispose();
    });

    it('dies after 600ms', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0x3eff8b);
        expect(effect.update(0.65)).toBe(false);
        effect.dispose();
    });

    it('dispose cleans up', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0xbc13fe);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
