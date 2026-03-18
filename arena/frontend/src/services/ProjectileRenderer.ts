import {
    Group,
    BufferGeometry,
    Float32BufferAttribute,
    LineBasicMaterial,
    Line,
    SphereGeometry,
    MeshLambertMaterial,
    Mesh,
} from 'three';
import { GameRenderer3D } from './GameRenderer3D';

const BULLET_MAT = new LineBasicMaterial({ color: 0xffdd44, linewidth: 2 });
const GRENADE_GEO = new SphereGeometry(0.15, 8, 8);
const GRENADE_MAT = new MeshLambertMaterial({ color: 0x666666, emissive: 0x884400 });

export class ProjectileRenderer {
    private readonly group: Group;
    private readonly objects: Map<string | number, Line | Mesh> = new Map();

    constructor(group: Group) {
        this.group = group;
    }

    update(projectiles: Array<{
        id?: string | number;
        x: number;
        y: number;
        angle: number;
        type?: string;
    }>): void {
        const currentIds = new Set(projectiles.map((p, i) => p.id ?? i));

        // Remove stale
        for (const [id, obj] of this.objects) {
            if (!currentIds.has(id)) {
                this.group.remove(obj);
                this.objects.delete(id);
            }
        }

        // Add / update
        projectiles.forEach((proj, i) => {
            const id = proj.id ?? i;
            const { wx, wz } = GameRenderer3D.toWorld(proj.x, proj.y);

            if (proj.type === 'grenade') {
                let mesh = this.objects.get(id) as Mesh | undefined;
                if (!mesh) {
                    mesh = new Mesh(GRENADE_GEO, GRENADE_MAT);
                    this.objects.set(id, mesh);
                    this.group.add(mesh);
                }
                mesh.position.set(wx, 0.4, wz);
            } else {
                // Bullet: short line in the direction of travel
                let line = this.objects.get(id) as Line | undefined;
                if (!line) {
                    const len = 0.3;
                    const dx = Math.cos(proj.angle) * len;
                    const dz = Math.sin(proj.angle) * len;
                    const geo = new BufferGeometry();
                    geo.setAttribute('position', new Float32BufferAttribute([
                        -dx, 0.5, -dz,
                        dx, 0.5, dz,
                    ], 3));
                    line = new Line(geo, BULLET_MAT);
                    this.objects.set(id, line);
                    this.group.add(line);
                }
                line.position.set(wx, 0, wz);
            }
        });
    }

    dispose(): void {
        for (const obj of this.objects.values()) {
            this.group.remove(obj);
            if (obj instanceof Line) obj.geometry.dispose();
        }
        this.objects.clear();
    }
}
