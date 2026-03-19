import {
    Group,
    CapsuleGeometry,
    SphereGeometry,
    MeshBasicMaterial,
    MeshLambertMaterial,
    Mesh,
    Vector3,
} from 'three';
import { GameRenderer3D } from './GameRenderer3D';

// Bullet: small elongated capsule with bright glow
const BULLET_GEO = new CapsuleGeometry(0.06, 0.25, 4, 8);
const BULLET_MAT = new MeshBasicMaterial({ color: 0xffee66 });

// Grenade: medium sphere with warm metallic look
const GRENADE_GEO = new SphereGeometry(0.2, 12, 12);
const GRENADE_MAT = new MeshLambertMaterial({
    color: 0x555555,
    emissive: 0x994400,
    emissiveIntensity: 0.6,
});

// Reusable vector for lookAt target
const _target = new Vector3();

export class ProjectileRenderer {
    private readonly group: Group;
    private readonly objects: Map<string | number, Mesh> = new Map();

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
                let mesh = this.objects.get(id);
                if (!mesh) {
                    mesh = new Mesh(GRENADE_GEO, GRENADE_MAT);
                    mesh.castShadow = true;
                    this.objects.set(id, mesh);
                    this.group.add(mesh);
                }
                mesh.position.set(wx, 0.5, wz);
                // Slow tumble for realism
                mesh.rotation.x += 0.08;
                mesh.rotation.z += 0.05;
            } else {
                // Bullet: 3D capsule oriented in direction of travel
                let mesh = this.objects.get(id);
                if (!mesh) {
                    mesh = new Mesh(BULLET_GEO, BULLET_MAT);
                    mesh.castShadow = true;

                    // Orient capsule (Y-axis) toward travel direction
                    const angle = Number.isFinite(proj.angle) ? proj.angle : 0;
                    mesh.position.set(wx, 0.5, wz);
                    _target.set(
                        wx + Math.cos(angle),
                        0.5,
                        wz + Math.sin(angle),
                    );
                    mesh.lookAt(_target);
                    mesh.rotateX(-Math.PI / 2);

                    this.objects.set(id, mesh);
                    this.group.add(mesh);
                }
                mesh.position.set(wx, 0.5, wz);
            }
        });
    }

    dispose(): void {
        for (const obj of this.objects.values()) {
            this.group.remove(obj);
        }
        this.objects.clear();
    }
}
