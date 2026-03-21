// arena/frontend/src/services/effects/DamageNumber.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

vi.mock('three/addons/renderers/CSS2DRenderer.js', () => ({
    CSS2DObject: class MockCSS2DObject {
        element: HTMLElement;
        position = { set: vi.fn(), x: 0, y: 0, z: 0 };
        removeFromParent = vi.fn();
        constructor(element: HTMLElement) { this.element = element; }
    },
}));

import { DamageNumber } from './DamageNumber';

describe('DamageNumber', () => {
    it('creates with correct color for damage', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 15, 'damage');
        expect(dn).toBeDefined();
        dn.dispose();
    });

    it('stays alive during 800ms lifetime', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 10, 'damage');
        expect(dn.update(0.4)).toBe(true);
        dn.dispose();
    });

    it('dies after 800ms', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 10, 'damage');
        expect(dn.update(0.9)).toBe(false);
        dn.dispose();
    });
});
