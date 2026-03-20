// arena/frontend/src/services/effects/AtmosphereEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Scene, FogExp2 } from 'three';
import { AtmosphereEffect } from './AtmosphereEffect';

describe('AtmosphereEffect', () => {
    it('adds dust particles to scene', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        const dustChild = scene.children.find(c => c.type === 'Points');
        expect(dustChild).toBeDefined();
        atmo.dispose();
    });

    it('sets FogExp2 on scene', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        expect(scene.fog).toBeInstanceOf(FogExp2);
        atmo.dispose();
    });

    it('update does not throw', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        expect(() => atmo.update(0.016)).not.toThrow();
        atmo.dispose();
    });

    it('dispose removes particles and fog', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        atmo.dispose();
        expect(scene.fog).toBeNull();
    });
});
