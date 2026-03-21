import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Color,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { QualitySettings } from '../QualitySettings';

const LIFETIME = 0.6;

export class DeathEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly particles: Points;
    private readonly velocities: Vector3[];
    private readonly positions: Float32Array;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, charColor: number) {
        this.parent = parent;
        const count = QualitySettings.current.deathParticleCount;
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.3;
            this.positions[i * 3 + 1] = worldPos.y + Math.random() * 0.5;
            this.positions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3;

            this.velocities.push(new Vector3(
                (Math.random() - 0.5) * 0.5,
                0.5 + Math.random() * 1.5,
                (Math.random() - 0.5) * 0.5,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

        const mat = new PointsMaterial({
            color: new Color(charColor),
            size: 0.06,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });

        this.particles = new Points(geo, mat);
        parent.add(this.particles);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Flash red in first 100ms
        if (this.elapsed < 0.1) {
            const mat = this.particles.material as PointsMaterial;
            const flash = new Color(0xff2200);
            mat.color.lerp(flash, 0.5 * (this.elapsed / 0.1));
        }

        // Move particles upward
        const posAttr = this.particles.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.velocities.length; i++) {
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] += this.velocities[i].y * delta;
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        (this.particles.material as PointsMaterial).opacity = 1 - t;
        (this.particles.material as PointsMaterial).size = 0.06 * (1 - t * 0.5);

        return true;
    }

    dispose(): void {
        this.parent.remove(this.particles);
        this.particles.geometry.dispose();
        (this.particles.material as PointsMaterial).dispose();
    }
}
