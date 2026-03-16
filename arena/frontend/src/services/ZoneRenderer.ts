import {
    Group,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    RingGeometry,
} from 'three';
import { GameRenderer3D, WORLD_SCALE } from './GameRenderer3D';

export class ZoneRenderer {
    private readonly group: Group;
    private overlay: Mesh | null = null;
    private ring: Mesh | null = null;
    private time = 0;

    constructor(group: Group) {
        this.group = group;
    }

    update(
        zone: {
            isActive: boolean;
            centerX: number;
            centerY: number;
            currentRadius: number;
        } | undefined,
        mapW: number,
        mapH: number,
        delta: number,
    ): void {
        this.time += delta;

        if (!zone?.isActive) {
            this.clear();
            return;
        }

        const { wx: cx, wz: cz } = GameRenderer3D.toWorld(zone.centerX, zone.centerY);
        const r = zone.currentRadius * WORLD_SCALE;
        const mw = mapW * WORLD_SCALE;
        const mh = mapH * WORLD_SCALE;

        // Red translucent overlay over the full map
        if (!this.overlay) {
            const geo = new PlaneGeometry(mw, mh);
            const mat = new MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
            });
            this.overlay = new Mesh(geo, mat);
            this.overlay.rotation.x = -Math.PI / 2;
            this.overlay.position.set(mw / 2, 0.01, mh / 2);
            this.group.add(this.overlay);
        }

        // Pulsing border ring
        if (this.ring) {
            this.group.remove(this.ring);
            this.ring.geometry.dispose();
            (this.ring.material as MeshBasicMaterial).dispose();
            this.ring = null;
        }

        const pulse = 0.4 + 0.3 * Math.sin(this.time * 3);
        const ringGeo = new RingGeometry(r - 0.02, r + 0.02, 64);
        const ringMat = new MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: pulse,
            depthWrite: false,
            side: 2, // THREE.DoubleSide
        });
        this.ring = new Mesh(ringGeo, ringMat);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.set(cx, 0.02, cz);
        this.group.add(this.ring);
    }

    private clear(): void {
        if (this.overlay) {
            this.group.remove(this.overlay);
            this.overlay.geometry.dispose();
            (this.overlay.material as MeshBasicMaterial).dispose();
            this.overlay = null;
        }
        if (this.ring) {
            this.group.remove(this.ring);
            this.ring.geometry.dispose();
            (this.ring.material as MeshBasicMaterial).dispose();
            this.ring = null;
        }
    }

    dispose(): void {
        this.clear();
    }
}
