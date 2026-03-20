import { Group, Scene, Vector3 } from 'three';

/** Base interface for all VFX effects. */
export interface VFXEffect {
    /** Returns true while effect is alive. */
    update(delta: number): boolean;
    dispose(): void;
}

const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
/** Temporary quality scale — replaced by QualitySettings in Wave 3. */
export const PARTICLE_SCALE = isMobile ? 0.5 : 1.0;

export class VFXManager {
    readonly effectGroup: Group;
    private readonly scene: Scene;
    private readonly effects: Set<VFXEffect> = new Set();
    private readonly shakeOffset = new Vector3();
    private shakeIntensity = 0;
    private shakeDuration = 0;
    private shakeElapsed = 0;
    private shakeType: 'sine' | 'jitter' = 'sine';

    constructor(scene: Scene) {
        this.scene = scene;
        this.effectGroup = new Group();
        this.effectGroup.name = 'vfx-effects';
        this.scene.add(this.effectGroup);
    }

    /** Tick all active effects and screen shake. */
    update(delta: number): void {
        for (const effect of this.effects) {
            const alive = effect.update(delta);
            if (!alive) {
                effect.dispose();
                this.effects.delete(effect);
            }
        }

        if (this.shakeElapsed < this.shakeDuration) {
            this.shakeElapsed += delta;
            const t = Math.min(this.shakeElapsed / this.shakeDuration, 1);
            const decay = 1 - t;
            const intensity = this.shakeIntensity * decay;

            if (this.shakeType === 'sine') {
                const freq = 30;
                this.shakeOffset.set(
                    Math.sin(this.shakeElapsed * freq) * intensity,
                    Math.cos(this.shakeElapsed * freq * 0.7) * intensity * 0.5,
                    0,
                );
            } else {
                this.shakeOffset.set(
                    (Math.random() - 0.5) * 2 * intensity,
                    (Math.random() - 0.5) * 2 * intensity * 0.5,
                    (Math.random() - 0.5) * intensity * 0.3,
                );
            }
        } else {
            this.shakeOffset.set(0, 0, 0);
        }
    }

    addEffect(effect: VFXEffect): void {
        this.effects.add(effect);
    }

    getShakeOffset(): Vector3 {
        return this.shakeOffset;
    }

    triggerShake(type: 'hit' | 'explosion'): void {
        const mobileScale = isMobile ? 0.5 : 1.0;
        if (type === 'hit') {
            this.shakeIntensity = 0.15 * mobileScale;
            this.shakeDuration = 0.2;
            this.shakeType = 'sine';
        } else {
            this.shakeIntensity = 0.4 * mobileScale;
            this.shakeDuration = 0.4;
            this.shakeType = 'jitter';
        }
        this.shakeElapsed = 0;
    }

    dispose(): void {
        for (const effect of this.effects) {
            effect.dispose();
        }
        this.effects.clear();
        this.scene.remove(this.effectGroup);
    }
}
