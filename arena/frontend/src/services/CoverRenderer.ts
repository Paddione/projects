import {
    Group,
    BoxGeometry,
    MeshLambertMaterial,
    Mesh,
} from 'three';
import { GameRenderer3D, WORLD_SCALE } from './GameRenderer3D';

const COVER_COLORS: Record<string, number> = {
    wall_cover: 0x4a4a6a,
    crate: 0x8b6914,
    pillar: 0x6a6a6a,
    bush: 0x2d6a2d,
    water: 0x1a4a8a,
    fountain: 0x2a6a9a,
    pond: 0x1a3a6a,
    hedge: 0x2a5a2a,
    bench: 0x7a5a3a,
};

const DEFAULT_COLOR = 0x5a5a7a;

export class CoverRenderer {
    private readonly group: Group;
    private readonly objects: Map<string | number, Mesh> = new Map();

    constructor(group: Group) {
        this.group = group;
    }

    update(coverObjects: Array<{
        id?: string | number;
        x: number;
        y: number;
        type: string;
        hp: number;
        width?: number;
        height?: number;
    }>): void {
        const currentIds = new Set(
            coverObjects.filter((c) => c.hp > 0).map((c, i) => c.id ?? i),
        );

        // Remove destroyed / gone
        for (const [id, mesh] of this.objects) {
            if (!currentIds.has(id)) {
                this.group.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as MeshLambertMaterial).dispose();
                this.objects.delete(id);
            }
        }

        coverObjects.forEach((cover, i) => {
            if (cover.hp === 0) return;
            const id = cover.id ?? i;
            const { wx, wz } = GameRenderer3D.toWorld(cover.x, cover.y);

            let mesh = this.objects.get(id);
            if (!mesh) {
                const w = (cover.width ?? 28) * WORLD_SCALE;
                const h = (cover.height ?? 28) * WORLD_SCALE;
                const geo = new BoxGeometry(w, h, w);
                const color = COVER_COLORS[cover.type] ?? DEFAULT_COLOR;
                const mat = new MeshLambertMaterial({ color });
                mesh = new Mesh(geo, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.objects.set(id, mesh);
                this.group.add(mesh);
            }

            mesh.position.set(wx, WORLD_SCALE * 14, wz);
        });
    }

    dispose(): void {
        for (const mesh of this.objects.values()) {
            this.group.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as MeshLambertMaterial).dispose();
        }
        this.objects.clear();
    }
}
