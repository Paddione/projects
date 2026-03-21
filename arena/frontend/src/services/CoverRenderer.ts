// arena/frontend/src/services/CoverRenderer.ts
import {
    Group,
    BoxGeometry,
    CylinderGeometry,
    SphereGeometry,
    CircleGeometry,
    MeshStandardMaterial,
    LineBasicMaterial,
    EdgesGeometry,
    LineSegments,
    Mesh,
} from 'three';
import { GameRenderer3D, WORLD_SCALE } from './GameRenderer3D';
import type { TextureFactory } from './TextureFactory';

interface CoverData {
    id?: string | number;
    x: number;
    y: number;
    type: string;
    hp: number;
    width?: number;
    height?: number;
}

/** Neon edge glow color per cover type. */
const EDGE_COLORS: Record<string, number> = {
    building: 0x00f2ff,
    fountain: 0x00aaff,
    hedge: 0x00ff66,
    pond: 0x0088cc,
    bench: 0x00f2ff,
};

const DEFAULT_EDGE_COLOR = 0x00f2ff;

export class CoverRenderer {
    private readonly group: Group;
    private readonly factory: TextureFactory;
    private readonly objects = new Map<string | number, Mesh>();
    private readonly hpTracker = new Map<string | number, number>();

    constructor(group: Group, factory: TextureFactory) {
        this.group = group;
        this.factory = factory;
    }

    update(coverObjects: CoverData[]): void {
        // hp !== 0 (not hp > 0): indestructible covers have hp=-1, which must render.
        // The old code used hp > 0, which excluded hp=-1 from the ID set — covers were
        // re-created every frame then immediately removed. This fixes that bug.
        const currentIds = new Set(
            coverObjects.filter((c) => c.hp !== 0).map((c, i) => c.id ?? i),
        );

        // Remove destroyed / gone
        for (const [id, mesh] of this.objects) {
            if (!currentIds.has(id)) {
                this.removeMesh(id, mesh);
            }
        }

        coverObjects.forEach((cover, i) => {
            if (cover.hp === 0) return;
            const id = cover.id ?? i;
            const { wx, wz } = GameRenderer3D.toWorld(cover.x, cover.y);

            let mesh = this.objects.get(id);

            // Check if bench HP changed → regenerate texture
            if (mesh && cover.type === 'bench') {
                const prevHp = this.hpTracker.get(id);
                if (prevHp !== undefined && prevHp !== cover.hp) {
                    this.removeMesh(id, mesh);
                    mesh = undefined;
                }
            }

            if (!mesh) {
                mesh = this.createMesh(cover, id);
                this.objects.set(id, mesh);
                this.group.add(mesh);
            }

            this.hpTracker.set(id, cover.hp);
            const yOffset = this.getYOffset(cover);
            mesh.position.set(wx, yOffset, wz);
        });
    }

    private createMesh(cover: CoverData, id: string | number): Mesh {
        const w = (cover.width ?? 28) * WORLD_SCALE;
        const h = (cover.height ?? 28) * WORLD_SCALE;
        const seed = typeof id === 'number' ? id : id.charCodeAt(0);

        const { geometry, material } = this.buildGeometryAndMaterial(cover.type, w, h, seed, cover.hp);
        const mesh = new Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Type-specific extras
        if (cover.type === 'fountain') {
            const radius = Math.max(w, h) / 2;

            // Water top face — translucent blue circle
            const topGeo = new CircleGeometry(radius * 0.95, 24);
            const topMat = new MeshStandardMaterial({
                map: this.factory.getFountainTop(),
                transparent: true,
                opacity: 0.7,
                emissive: 0x0044aa,
                emissiveIntensity: 0.5,
            });
            const topMesh = new Mesh(topGeo, topMat);
            topMesh.rotation.x = -Math.PI / 2;
            topMesh.position.y = h * 0.3;
            mesh.add(topMesh);

            // Center pillar
            const pillarRadius = radius * 0.15;
            const pillarGeo = new CylinderGeometry(pillarRadius, pillarRadius, h, 8);
            const pillarMat = new MeshStandardMaterial({
                color: 0x3a3a5a,
                metalness: 0.4,
                roughness: 0.7,
            });
            const pillarMesh = new Mesh(pillarGeo, pillarMat);
            pillarMesh.position.y = h * 0.2;
            pillarMesh.castShadow = true;
            mesh.add(pillarMesh);
        }

        if (cover.type === 'hedge') {
            // Organic scale jitter ±5% (seeded, deterministic per id)
            let s = seed | 0;
            const jitter = () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
            mesh.scale.x *= 0.95 + jitter() * 0.1;
            mesh.scale.z *= 0.95 + jitter() * 0.1;
        }

        // Edge glow
        const edgeColor = EDGE_COLORS[cover.type] ?? DEFAULT_EDGE_COLOR;
        const edges = new EdgesGeometry(geometry);
        const edgeMat = new LineBasicMaterial({
            color: edgeColor,
            transparent: true,
            opacity: 0.6,
        });
        const edgeLine = new LineSegments(edges, edgeMat);
        edgeLine.scale.multiplyScalar(1.005); // slight offset to avoid z-fighting
        mesh.add(edgeLine);

        return mesh;
    }

    private buildGeometryAndMaterial(
        type: string, w: number, h: number, seed: number, hp: number,
    ): { geometry: BoxGeometry | CylinderGeometry | SphereGeometry | CircleGeometry; material: MeshStandardMaterial } {
        switch (type) {
            case 'fountain': {
                const radius = Math.max(w, h) / 2;
                const geometry = new CylinderGeometry(radius, radius, h * 0.6, 16, 1, true);
                const material = new MeshStandardMaterial({
                    map: this.factory.getFountainSide(),
                    metalness: 0.2,
                    roughness: 0.8,
                    emissive: 0x001122,
                    emissiveIntensity: 0.3,
                });
                return { geometry, material };
            }
            case 'hedge': {
                const radius = Math.max(w, h) / 2;
                const geometry = new SphereGeometry(radius, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
                const material = new MeshStandardMaterial({
                    map: this.factory.getHedge(seed),
                    metalness: 0.0,
                    roughness: 0.95,
                    emissive: 0x001a00,
                    emissiveIntensity: 0.2,
                });
                return { geometry, material };
            }
            case 'pond': {
                const radius = Math.max(w, h) / 2;
                const geometry = new CircleGeometry(radius, 24);
                geometry.rotateX(-Math.PI / 2);
                const material = new MeshStandardMaterial({
                    map: this.factory.getPond(),
                    transparent: true,
                    opacity: 0.85,
                    metalness: 0.1,
                    roughness: 0.3,
                    emissive: 0x001133,
                    emissiveIntensity: 0.4,
                });
                return { geometry, material };
            }
            case 'bench': {
                const benchH = h / 3;
                const geometry = new BoxGeometry(w, benchH, w);
                const material = new MeshStandardMaterial({
                    map: this.factory.getBench(hp),
                    metalness: 0.3,
                    roughness: 0.8,
                    emissive: 0x000000,
                });
                return { geometry, material };
            }
            default: {
                // building (and any unknown type)
                const geometry = new BoxGeometry(w, h, w);
                const material = new MeshStandardMaterial({
                    map: this.factory.getBuilding(seed),
                    metalness: 0.5,
                    roughness: 0.6,
                    emissive: 0x050520,
                    emissiveIntensity: 0.2,
                });
                return { geometry, material };
            }
        }
    }

    private getYOffset(cover: CoverData): number {
        const h = (cover.height ?? 28) * WORLD_SCALE;
        switch (cover.type) {
            case 'pond': return 0.01;
            case 'bench': return (h / 3) / 2;
            case 'fountain': return (h * 0.6) / 2;
            case 'hedge': return 0;
            default: return h / 2;
        }
    }

    private removeMesh(id: string | number, mesh: Mesh): void {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
        for (const child of mesh.children) {
            if (child instanceof LineSegments) {
                child.geometry.dispose();
                (child.material as LineBasicMaterial).dispose();
            }
        }
        this.objects.delete(id);
        this.hpTracker.delete(id);
    }

    dispose(): void {
        for (const [id, mesh] of this.objects) {
            this.removeMesh(id, mesh);
        }
    }
}
