// arena/frontend/src/services/effects/ImpactEffect.ts
import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { QualitySettings } from '../QualitySettings';

const LIFETIME = 0.3; // 300ms
const SPEED_MIN = 2;
const SPEED_MAX = 4;
const SIZE = 0.05;

export class ImpactEffect implements VFXEffect {
    private readonly mesh: Points;
    private readonly parent: Group;
    private readonly velocities: Vector3[];
    private elapsed = 0;
    private readonly positions: Float32Array;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }) {
        this.parent = parent;
        const count = QualitySettings.current.impactParticleCount;
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x;
            this.positions[i * 3 + 1] = worldPos.y;
            this.positions[i * 3 + 2] = worldPos.z;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5;
            const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
            this.velocities.push(new Vector3(
                Math.cos(theta) * Math.sin(phi) * speed,
                Math.cos(phi) * speed,
                Math.sin(theta) * Math.sin(phi) * speed,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

        const mat = new PointsMaterial({
            color: 0xffee66,
            size: SIZE,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });

        this.mesh = new Points(geo, mat);
        this.parent.add(this.mesh);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;
        const posAttr = this.mesh.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < this.velocities.length; i++) {
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] += this.velocities[i].y * delta;
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        const fadeStart = 0.66;
        const opacity = t > fadeStart ? 1 - (t - fadeStart) / (1 - fadeStart) : 1;
        (this.mesh.material as PointsMaterial).opacity = opacity;
        (this.mesh.material as PointsMaterial).size = SIZE * (1 - t);

        return true;
    }

    dispose(): void {
        this.parent.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as PointsMaterial).dispose();
    }
}
