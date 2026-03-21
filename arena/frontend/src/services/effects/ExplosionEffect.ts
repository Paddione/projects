import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    TorusGeometry,
    MeshBasicMaterial,
    Mesh,
    PointLight,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { QualitySettings } from '../QualitySettings';

const LIFETIME = 0.6;
const SHOCKWAVE_DURATION = 0.4;
const LIGHT_DURATION = 0.2;

export class ExplosionEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly shockwave: Mesh | null;
    private readonly particles: Points;
    private readonly light: PointLight;
    private readonly velocities: Vector3[];
    private readonly positions: Float32Array;
    private readonly targetRadius: number;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, radiusWorld: number) {
        this.parent = parent;
        this.targetRadius = radiusWorld;

        // Shockwave ring (torus) — optional based on quality tier
        if (QualitySettings.current.showShockwave) {
            const shockGeo = new TorusGeometry(0.01, 0.03, 8, 32);
            const shockMat = new MeshBasicMaterial({
                color: 0x00f2ff,
                transparent: true,
                opacity: 0.8,
            });
            this.shockwave = new Mesh(shockGeo, shockMat);
            this.shockwave.position.set(worldPos.x, 0.05, worldPos.z);
            this.shockwave.rotation.x = -Math.PI / 2;
            parent.add(this.shockwave);
        } else {
            this.shockwave = null;
        }

        // Debris particles
        const count = QualitySettings.current.explosionParticleCount;
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x;
            this.positions[i * 3 + 1] = 0.3;
            this.positions[i * 3 + 2] = worldPos.z;

            const theta = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.velocities.push(new Vector3(
                Math.cos(theta) * speed,
                1 + Math.random() * 2,
                Math.sin(theta) * speed,
            ));
        }

        const particleGeo = new BufferGeometry();
        particleGeo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        const particleMat = new PointsMaterial({
            color: 0xff6600,
            size: 0.08,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });
        this.particles = new Points(particleGeo, particleMat);
        parent.add(this.particles);

        // Point light flash
        this.light = new PointLight(0xffffff, 3, radiusWorld * 2);
        this.light.position.set(worldPos.x, 1, worldPos.z);
        parent.add(this.light);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Shockwave expansion
        if (this.shockwave) {
            if (this.elapsed < SHOCKWAVE_DURATION) {
                const st = this.elapsed / SHOCKWAVE_DURATION;
                const scale = st * this.targetRadius;
                this.shockwave.scale.set(scale, scale, 1);
                (this.shockwave.material as MeshBasicMaterial).opacity = 0.8 * (1 - st);
            } else {
                this.shockwave.visible = false;
            }
        }

        // Light decay
        if (this.elapsed < LIGHT_DURATION) {
            this.light.intensity = 3 * (1 - this.elapsed / LIGHT_DURATION);
        } else {
            this.light.intensity = 0;
        }

        // Particle movement + gravity
        const posAttr = this.particles.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.velocities.length; i++) {
            this.velocities[i].y -= 5 * delta;
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] = Math.max(0, arr[i * 3 + 1] + this.velocities[i].y * delta);
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        // Color shift orange → red
        const r = 1;
        const g = 0.4 * (1 - t);
        (this.particles.material as PointsMaterial).color.setRGB(r, g, 0);
        (this.particles.material as PointsMaterial).opacity = 1 - t;

        return true;
    }

    dispose(): void {
        if (this.shockwave) {
            this.parent.remove(this.shockwave);
            (this.shockwave.geometry as TorusGeometry).dispose();
            (this.shockwave.material as MeshBasicMaterial).dispose();
        }
        this.parent.remove(this.particles);
        this.parent.remove(this.light);
        this.particles.geometry.dispose();
        (this.particles.material as PointsMaterial).dispose();
        this.light.dispose();
    }
}
