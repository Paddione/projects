import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    FogExp2,
    Scene,
    Vector3,
} from 'three';
import { PARTICLE_SCALE } from '../VFXManager';

const BASE_DUST_COUNT = 50;
const DRIFT_SPEED = 0.2;
const AREA_SIZE = 15;

const isMobile = typeof window !== 'undefined' && (navigator.maxTouchPoints > 0);

export class AtmosphereEffect {
    private readonly scene: Scene;
    private readonly dustMesh: Points;
    private readonly dustVelocities: Vector3[];
    private readonly dustPositions: Float32Array;

    constructor(scene: Scene) {
        this.scene = scene;

        if (!isMobile) {
            scene.fog = new FogExp2(0x0a0b1a, 0.015);
        }

        const count = Math.round(BASE_DUST_COUNT * PARTICLE_SCALE);
        this.dustPositions = new Float32Array(count * 3);
        this.dustVelocities = [];

        for (let i = 0; i < count; i++) {
            this.dustPositions[i * 3] = (Math.random() - 0.5) * AREA_SIZE * 2;
            this.dustPositions[i * 3 + 1] = Math.random() * 3;
            this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * AREA_SIZE * 2;

            this.dustVelocities.push(new Vector3(
                (Math.random() - 0.5) * DRIFT_SPEED,
                (Math.random() - 0.5) * DRIFT_SPEED * 0.3,
                (Math.random() - 0.5) * DRIFT_SPEED,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

        const mat = new PointsMaterial({
            color: 0x00f2ff,
            size: 0.02,
            transparent: true,
            opacity: 0.15,
            sizeAttenuation: true,
        });

        this.dustMesh = new Points(geo, mat);
        scene.add(this.dustMesh);
    }

    update(delta: number): void {
        const posAttr = this.dustMesh.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < this.dustVelocities.length; i++) {
            arr[i * 3] += this.dustVelocities[i].x * delta;
            arr[i * 3 + 1] += this.dustVelocities[i].y * delta;
            arr[i * 3 + 2] += this.dustVelocities[i].z * delta;

            if (Math.abs(arr[i * 3]) > AREA_SIZE) arr[i * 3] *= -0.9;
            if (arr[i * 3 + 1] > 3 || arr[i * 3 + 1] < 0) this.dustVelocities[i].y *= -1;
            if (Math.abs(arr[i * 3 + 2]) > AREA_SIZE) arr[i * 3 + 2] *= -0.9;
        }
        posAttr.needsUpdate = true;
    }

    dispose(): void {
        this.scene.remove(this.dustMesh);
        this.dustMesh.geometry.dispose();
        (this.dustMesh.material as PointsMaterial).dispose();
        this.scene.fog = null;
    }
}
