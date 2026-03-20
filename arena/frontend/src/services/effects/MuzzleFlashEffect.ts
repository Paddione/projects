import {
    Sprite,
    SpriteMaterial,
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { PARTICLE_SCALE } from '../VFXManager';

const LIFETIME = 0.1; // 100ms
const FLASH_SIZE = 0.3;
const SPARK_COUNT = 6;

export class MuzzleFlashEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly flash: Sprite;
    private readonly sparks: Points;
    private readonly sparkVelocities: Vector3[];
    private readonly sparkPositions: Float32Array;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, angle: number) {
        this.parent = parent;

        const flashMat = new SpriteMaterial({
            color: 0xffffcc,
            transparent: true,
            opacity: 1,
        });
        this.flash = new Sprite(flashMat);
        this.flash.scale.set(FLASH_SIZE, FLASH_SIZE, 1);
        this.flash.position.set(worldPos.x, worldPos.y, worldPos.z);
        parent.add(this.flash);

        const count = Math.round(SPARK_COUNT * PARTICLE_SCALE);
        this.sparkPositions = new Float32Array(count * 3);
        this.sparkVelocities = [];

        for (let i = 0; i < count; i++) {
            this.sparkPositions[i * 3] = worldPos.x;
            this.sparkPositions[i * 3 + 1] = worldPos.y;
            this.sparkPositions[i * 3 + 2] = worldPos.z;

            const spread = (Math.random() - 0.5) * 0.6;
            const a = angle + spread;
            const speed = 3 + Math.random() * 2;
            this.sparkVelocities.push(new Vector3(
                Math.cos(a) * speed,
                (Math.random() - 0.3) * speed * 0.3,
                Math.sin(a) * speed,
            ));
        }

        const sparkGeo = new BufferGeometry();
        sparkGeo.setAttribute('position', new Float32BufferAttribute(this.sparkPositions, 3));
        const sparkMat = new PointsMaterial({
            color: 0xffee66,
            size: 0.03,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });
        this.sparks = new Points(sparkGeo, sparkMat);
        parent.add(this.sparks);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        (this.flash.material as SpriteMaterial).opacity = 1 - t;
        this.flash.scale.setScalar(FLASH_SIZE * (1 + t * 0.5));

        const posAttr = this.sparks.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.sparkVelocities.length; i++) {
            arr[i * 3] += this.sparkVelocities[i].x * delta;
            arr[i * 3 + 1] += this.sparkVelocities[i].y * delta;
            arr[i * 3 + 2] += this.sparkVelocities[i].z * delta;
        }
        posAttr.needsUpdate = true;
        (this.sparks.material as PointsMaterial).opacity = 1 - t;

        return true;
    }

    dispose(): void {
        this.parent.remove(this.flash);
        this.parent.remove(this.sparks);
        (this.flash.material as SpriteMaterial).dispose();
        this.sparks.geometry.dispose();
        (this.sparks.material as PointsMaterial).dispose();
    }
}
