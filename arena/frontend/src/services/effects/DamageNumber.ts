import { Scene } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { VFXEffect } from '../VFXManager';

const LIFETIME = 0.8;
const FLOAT_DISTANCE = 1.5;

const COLORS = {
    damage: '#ff4d6d',
    armor: '#38bdf8',
    heal: '#3eff8b',
} as const;

export class DamageNumber implements VFXEffect {
    private readonly scene: Scene;
    private readonly label: CSS2DObject;
    private readonly startY: number;
    private elapsed = 0;

    constructor(
        scene: Scene,
        worldPos: { x: number; y: number; z: number },
        amount: number,
        type: 'damage' | 'armor' | 'heal',
    ) {
        this.scene = scene;
        this.startY = worldPos.y;

        const div = document.createElement('div');
        div.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
        div.style.cssText = `
            font-family: monospace;
            font-weight: 900;
            color: ${COLORS[type]};
            text-shadow: 0 0 8px ${COLORS[type]}80;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
        `;

        const fontSize = Math.min(14 + amount * 0.4, 28);
        div.style.fontSize = `${fontSize}px`;

        this.label = new CSS2DObject(div);
        this.label.position.set(worldPos.x, worldPos.y, worldPos.z);
        scene.add(this.label);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;
        this.label.position.y = this.startY + t * FLOAT_DISTANCE;

        const fadeStart = 0.625;
        if (t > fadeStart) {
            const fadeT = (t - fadeStart) / (1 - fadeStart);
            this.label.element.style.opacity = String(1 - fadeT);
        }

        return true;
    }

    dispose(): void {
        this.label.removeFromParent();
        if (this.label.element.parentElement) {
            this.label.element.parentElement.removeChild(this.label.element);
        }
    }
}
