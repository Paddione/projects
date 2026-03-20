import { describe, it, expect, beforeEach } from 'vitest';
import { QualitySettings } from './QualitySettings';

describe('QualitySettings', () => {
    beforeEach(() => {
        localStorage.clear();
        QualitySettings.reset();
    });

    it('defaults to high on desktop', () => {
        expect(QualitySettings.current.tier).toBe('high');
    });

    it('provides correct particle counts for high tier', () => {
        QualitySettings.setTier('high');
        expect(QualitySettings.current.impactParticleCount).toBe(12);
        expect(QualitySettings.current.explosionParticleCount).toBe(30);
        expect(QualitySettings.current.deathParticleCount).toBe(20);
    });

    it('provides reduced counts for medium tier', () => {
        QualitySettings.setTier('medium');
        expect(QualitySettings.current.impactParticleCount).toBe(8);
        expect(QualitySettings.current.explosionParticleCount).toBe(15);
    });

    it('provides minimal counts for low tier', () => {
        QualitySettings.setTier('low');
        expect(QualitySettings.current.impactParticleCount).toBe(4);
        expect(QualitySettings.current.explosionParticleCount).toBe(8);
        expect(QualitySettings.current.showShockwave).toBe(false);
    });

    it('persists to localStorage', () => {
        QualitySettings.setTier('low');
        expect(localStorage.getItem('arena_quality')).toBe('low');
    });

    it('reads from localStorage on init', () => {
        localStorage.setItem('arena_quality', 'medium');
        QualitySettings.reset();
        expect(QualitySettings.current.tier).toBe('medium');
    });
});
