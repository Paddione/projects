export type QualityTier = 'high' | 'medium' | 'low';

interface QualityConfig {
    tier: QualityTier;
    impactParticleCount: number;
    explosionParticleCount: number;
    deathParticleCount: number;
    dustParticleCount: number;
    muzzleSparkCount: number;
    showShockwave: boolean;
    bloomEnabled: boolean;
    bloomStrength: number;
    vignetteEnabled: boolean;
    chromaticEnabled: boolean;
    fogEnabled: boolean;
    fogDensity: number;
    shakeScale: number;
    resolutionScale: number;
}

const TIERS: Record<QualityTier, QualityConfig> = {
    high: {
        tier: 'high',
        impactParticleCount: 12,
        explosionParticleCount: 30,
        deathParticleCount: 20,
        dustParticleCount: 50,
        muzzleSparkCount: 6,
        showShockwave: true,
        bloomEnabled: true,
        bloomStrength: 0.8,
        vignetteEnabled: true,
        chromaticEnabled: true,
        fogEnabled: true,
        fogDensity: 0.015,
        shakeScale: 1.0,
        resolutionScale: 1.0,
    },
    medium: {
        tier: 'medium',
        impactParticleCount: 8,
        explosionParticleCount: 15,
        deathParticleCount: 10,
        dustParticleCount: 20,
        muzzleSparkCount: 4,
        showShockwave: true,
        bloomEnabled: true,
        bloomStrength: 0.4,
        vignetteEnabled: true,
        chromaticEnabled: false,
        fogEnabled: true,
        fogDensity: 0.008,
        shakeScale: 0.5,
        resolutionScale: 1.0,
    },
    low: {
        tier: 'low',
        impactParticleCount: 4,
        explosionParticleCount: 8,
        deathParticleCount: 0,
        dustParticleCount: 0,
        muzzleSparkCount: 2,
        showShockwave: false,
        bloomEnabled: false,
        bloomStrength: 0,
        vignetteEnabled: false,
        chromaticEnabled: false,
        fogEnabled: false,
        fogDensity: 0,
        shakeScale: 0.25,
        resolutionScale: 0.75,
    },
};

const STORAGE_KEY = 'arena_quality';

function detectTier(): QualityTier {
    if (typeof window === 'undefined') return 'high';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in TIERS) return saved as QualityTier;
    const isTouch = navigator.maxTouchPoints > 0;
    const isSmall = window.innerWidth <= 768;
    if (isSmall) return 'low';
    if (isTouch) return 'medium';
    return 'high';
}

export const QualitySettings = {
    current: { ...TIERS[detectTier()] },

    setTier(tier: QualityTier): void {
        Object.assign(this.current, TIERS[tier]);
        localStorage.setItem(STORAGE_KEY, tier);
    },

    reset(): void {
        Object.assign(this.current, TIERS[detectTier()]);
    },
};
