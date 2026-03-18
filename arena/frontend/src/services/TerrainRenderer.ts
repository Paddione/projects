import {
    PlaneGeometry,
    BoxGeometry,
    MeshLambertMaterial,
    Mesh,
    InstancedMesh,
    Matrix4,
    Color,
    Group,
} from 'three';
import { WORLD_SCALE } from './GameRenderer3D';

const TILE = WORLD_SCALE; // 1 world unit per tile

const FLOOR_COLOR = new Color(0x2a4a2a);
const WALL_COLOR = new Color(0x3a3a5a);
const PATH_COLOR = new Color(0x4a3a30);

export class TerrainRenderer {
    private readonly group: Group;
    private floorMesh: Mesh | null = null;
    private wallMesh: InstancedMesh | null = null;

    constructor(group: Group) {
        this.group = group;
    }

    build(tiles: number[][], mapW: number, mapH: number): void {
        this.clear();

        const w = mapW * TILE;
        const h = mapH * TILE;

        // Single flat plane for the floor
        const floorGeo = new PlaneGeometry(w, h);
        const floorMat = new MeshLambertMaterial({ color: FLOOR_COLOR });
        this.floorMesh = new Mesh(floorGeo, floorMat);
        this.floorMesh.rotation.x = -Math.PI / 2; // lay flat
        this.floorMesh.position.set(w / 2, 0, h / 2);
        this.floorMesh.receiveShadow = true;
        this.group.add(this.floorMesh);

        // Count walls and paths for instanced rendering
        const wallPositions: { tx: number; ty: number; type: number }[] = [];
        for (let ty = 0; ty < mapH; ty++) {
            for (let tx = 0; tx < mapW; tx++) {
                const t = tiles[ty]?.[tx] ?? 0;
                if (t === 1 || t === 2) {
                    wallPositions.push({ tx, ty, type: t });
                }
            }
        }

        if (wallPositions.length === 0) return;

        const boxGeo = new BoxGeometry(TILE, TILE * 1.5, TILE);
        const wallMat = new MeshLambertMaterial({ color: WALL_COLOR });
        this.wallMesh = new InstancedMesh(boxGeo, wallMat, wallPositions.length);
        this.wallMesh.castShadow = true;
        this.wallMesh.receiveShadow = true;

        const matrix = new Matrix4();
        const pathColor = PATH_COLOR.clone();
        const wallColor = WALL_COLOR.clone();

        wallPositions.forEach(({ tx, ty, type }, i) => {
            const x = (tx + 0.5) * TILE;
            const z = (ty + 0.5) * TILE;
            const y = type === 1 ? TILE * 0.75 : TILE * 0.05; // walls taller, paths flat
            matrix.setPosition(x, y, z);
            this.wallMesh!.setMatrixAt(i, matrix);
            this.wallMesh!.setColorAt(i, type === 1 ? wallColor : pathColor);
        });

        this.wallMesh.instanceMatrix.needsUpdate = true;
        if (this.wallMesh.instanceColor) {
            this.wallMesh.instanceColor.needsUpdate = true;
        }

        this.group.add(this.wallMesh);
    }

    clear(): void {
        if (this.floorMesh) {
            this.floorMesh.geometry.dispose();
            (this.floorMesh.material as MeshLambertMaterial).dispose();
            this.group.remove(this.floorMesh);
            this.floorMesh = null;
        }
        if (this.wallMesh) {
            this.wallMesh.geometry.dispose();
            (this.wallMesh.material as MeshLambertMaterial).dispose();
            this.group.remove(this.wallMesh);
            this.wallMesh = null;
        }
    }

    dispose(): void {
        this.clear();
    }
}
