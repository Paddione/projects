import {
    PlaneGeometry,
    BoxGeometry,
    MeshLambertMaterial,
    Mesh,
    InstancedMesh,
    Matrix4,
    Color,
    Group,
    GridHelper,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
} from 'three';
import { WORLD_SCALE } from './GameRenderer3D';

const TILE = WORLD_SCALE; // 1 world unit per tile

const FLOOR_COLOR = new Color(0x1a3a1a);   // dark green base
const WALL_COLOR = new Color(0x5a5a8a);    // blue-gray walls
const PATH_COLOR = new Color(0x8a7a5a);    // warm brown paths
const BOUNDARY_COLOR = 0x334466;           // map edge

export class TerrainRenderer {
    private readonly group: Group;
    private readonly meshes: Mesh[] = [];
    private wallMesh: InstancedMesh | null = null;
    private gridHelper: GridHelper | null = null;
    private boundary: LineSegments | null = null;

    constructor(group: Group) {
        this.group = group;
    }

    build(tiles: number[][], mapW: number, mapH: number): void {
        this.clear();

        const w = mapW * TILE;
        const h = mapH * TILE;

        // Floor plane — visible green
        const floorGeo = new PlaneGeometry(w, h);
        const floorMat = new MeshLambertMaterial({ color: FLOOR_COLOR });
        const floor = new Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(w / 2, -0.01, h / 2);
        floor.receiveShadow = true;
        this.group.add(floor);
        this.meshes.push(floor);

        // Grid overlay for spatial reference
        this.gridHelper = new GridHelper(
            Math.max(w, h),  // size
            Math.max(mapW, mapH),  // divisions
            0x2a4a2a,  // center line color
            0x1a3a1a,  // grid color
        );
        this.gridHelper.position.set(w / 2, 0.001, h / 2);
        this.gridHelper.material.opacity = 0.4;
        this.gridHelper.material.transparent = true;
        this.group.add(this.gridHelper);

        // Map boundary — bright outline
        const boundaryGeo = new BoxGeometry(w, 0.1, h);
        const boundaryEdges = new EdgesGeometry(boundaryGeo);
        this.boundary = new LineSegments(
            boundaryEdges,
            new LineBasicMaterial({ color: BOUNDARY_COLOR, linewidth: 2 }),
        );
        this.boundary.position.set(w / 2, 0.05, h / 2);
        this.group.add(this.boundary);

        // Collect wall and path positions for instanced rendering
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

        // Walls are tall, paths are flat
        const wallH = TILE * 1.5;
        const pathH = TILE * 0.15;
        const maxH = wallH; // use tallest for shared geometry
        const boxGeo = new BoxGeometry(TILE * 0.95, maxH, TILE * 0.95);
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
            if (type === 1) {
                // Walls: tall blocks
                matrix.identity();
                matrix.setPosition(x, wallH / 2, z);
                this.wallMesh!.setMatrixAt(i, matrix);
                this.wallMesh!.setColorAt(i, wallColor);
            } else {
                // Paths: flat slabs
                matrix.identity();
                matrix.makeScale(1, pathH / maxH, 1);
                matrix.setPosition(x, pathH / 2, z);
                this.wallMesh!.setMatrixAt(i, matrix);
                this.wallMesh!.setColorAt(i, pathColor);
            }
        });

        this.wallMesh.instanceMatrix.needsUpdate = true;
        if (this.wallMesh.instanceColor) {
            this.wallMesh.instanceColor.needsUpdate = true;
        }

        this.group.add(this.wallMesh);
    }

    clear(): void {
        for (const mesh of this.meshes) {
            mesh.geometry.dispose();
            (mesh.material as MeshLambertMaterial).dispose();
            this.group.remove(mesh);
        }
        this.meshes.length = 0;

        if (this.wallMesh) {
            this.wallMesh.geometry.dispose();
            (this.wallMesh.material as MeshLambertMaterial).dispose();
            this.group.remove(this.wallMesh);
            this.wallMesh = null;
        }
        if (this.gridHelper) {
            this.group.remove(this.gridHelper);
            this.gridHelper = null;
        }
        if (this.boundary) {
            this.boundary.geometry.dispose();
            (this.boundary.material as LineBasicMaterial).dispose();
            this.group.remove(this.boundary);
            this.boundary = null;
        }
    }

    dispose(): void {
        this.clear();
    }
}
