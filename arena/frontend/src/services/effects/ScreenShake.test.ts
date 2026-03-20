import { describe, it, expect } from 'vitest';
import { VFXManager } from '../VFXManager';
import { Scene } from 'three';

describe('ScreenShake (via VFXManager)', () => {
    it('produces non-zero offset after triggerShake("hit")', () => {
        const vfx = new VFXManager(new Scene());
        vfx.triggerShake('hit');
        vfx.update(0.05); // 50ms into 200ms shake
        const offset = vfx.getShakeOffset();
        expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
    });

    it('returns to zero after shake duration expires', () => {
        const vfx = new VFXManager(new Scene());
        vfx.triggerShake('hit');
        vfx.update(0.3); // 300ms > 200ms duration
        const offset = vfx.getShakeOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
    });

    it('explosion shake is stronger than hit shake', () => {
        const scene1 = new Scene();
        const vfx1 = new VFXManager(scene1);
        vfx1.triggerShake('hit');
        vfx1.update(0.01);

        const scene2 = new Scene();
        const vfx2 = new VFXManager(scene2);
        vfx2.triggerShake('explosion');
        vfx2.update(0.01);

        expect(vfx2['shakeIntensity']).toBeGreaterThan(vfx1['shakeIntensity']);
    });
});
