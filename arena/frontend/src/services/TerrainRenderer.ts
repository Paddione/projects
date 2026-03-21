// arena/frontend/src/services/TerrainRenderer.ts
import {
    PlaneGeometry,
    BoxGeometry,
    MeshStandardMaterial,
    MeshBasicMaterial,
    Mesh,
    InstancedMesh,
    InstancedBufferAttribute,
    Matrix4,
    Group,
    EdgesGeometry,
    LineBasicMaterial,
    LineSegments,
} from 'three';
import type { TextureFactory } from './TextureFactory';

const TILE = 1;
const WALL_H = TILE * 1.5;
const PATH_H = TILE * 0.15;
const BOUNDARY_COLOR = 0x334466;

/** Simple hash for deterministic per-instance atlas variant selection. */
function tileHash(tx: number, ty: number): number {
    return ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
}

/**
 * Patch a MeshStandardMaterial to read a per-instance `atlasOffset` attribute
 * and shift UV.x into the correct atlas panel. `panels` is the number of
 * side-by-side panels in the atlas texture (e.g. 4 for walls, 3 for paths).
 */
function patchMaterialForAtlas(mat: MeshStandardMaterial, panels: number): void {
    mat.onBeforeCompile = (shader) => {
        // Declare the instance attribute in the vertex shader
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
attribute float atlasOffset;
varying float vAtlasOffset;`,
        );
        // Pass it to the fragment shader
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
vAtlasOffset = atlasOffset;`,
        );
        // In the fragment shader, scale and offset UV.x
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
varying float vAtlasOffset;`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
  vec2 atlasUv = vec2(vUv.x / ${panels.toFixed(1)} + vAtlasOffset, vUv.y);
  vec4 sampledDiffuseColor = texture2D(map, atlasUv);
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = vec4(mix(pow(sampledDiffuseColor.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), sampledDiffuseColor.rgb * 0.0773993808, vec3(lessThanEqual(sampledDiffuseColor.rgb, vec3(0.04045)))), sampledDiffuseColor.w);
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif`,
        );
    };
}

export class TerrainRenderer {
    private readonly group: Group;
    private readonly factory: TextureFactory;
    private readonly disposables: { dispose(): void }[] = [];
    private wallMesh: InstancedMesh | null = null;
    private pathMesh: InstancedMesh | null = null;
    private floor: Mesh | null = null;
    private boundary: LineSegments | null = null;

    constructor(group: Group, factory: TextureFactory) {
        this.group = group;
        this.factory = factory;
    }

    build(tiles: number[][], mapW: number, mapH: number): void {
        this.clear();

        const w = mapW * TILE;
        const h = mapH * TILE;

        // ── Textured floor (replaces dark plane + grid LineSegments) ──
        const floorGeo = new PlaneGeometry(w, h);
        const floorMat = new MeshBasicMaterial({
            map: this.factory.getFloor(mapW, mapH),
        });
        this.floor = new Mesh(floorGeo, floorMat);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.set(w / 2, -0.01, h / 2);
        this.group.add(this.floor);

        // ── Map boundary ──
        const boundaryGeo = new BoxGeometry(w, 0.1, h);
        const boundaryEdges = new EdgesGeometry(boundaryGeo);
        this.boundary = new LineSegments(
            boundaryEdges,
            new LineBasicMaterial({ color: BOUNDARY_COLOR, linewidth: 2 }),
        );
        this.boundary.position.set(w / 2, 0.05, h / 2);
        this.group.add(this.boundary);
        this.disposables.push(
            { dispose: () => { boundaryGeo.dispose(); } },
        );

        // ── Collect wall and path positions separately ──
        const walls: { tx: number; ty: number }[] = [];
        const paths: { tx: number; ty: number }[] = [];
        for (let ty = 0; ty < mapH; ty++) {
            for (let tx = 0; tx < mapW; tx++) {
                const t = tiles[ty]?.[tx] ?? 0;
                if (t === 1) walls.push({ tx, ty });
                else if (t === 2) paths.push({ tx, ty });
            }
        }

        // ── Wall InstancedMesh (4-panel atlas) ──
        if (walls.length > 0) {
            const WALL_PANELS = 4;
            const wallGeo = new BoxGeometry(TILE * 0.95, WALL_H, TILE * 0.95);
            const wallMat = new MeshStandardMaterial({
                map: this.factory.getWallAtlas(),
                metalness: 0.6,
                roughness: 0.7,
            });
            patchMaterialForAtlas(wallMat, WALL_PANELS);

            this.wallMesh = new InstancedMesh(wallGeo, wallMat, walls.length);
            this.wallMesh.castShadow = true;
            this.wallMesh.receiveShadow = true;

            const matrix = new Matrix4();
            const offsets = new Float32Array(walls.length);
            walls.forEach(({ tx, ty }, i) => {
                matrix.identity();
                matrix.setPosition(
                    (tx + 0.5) * TILE,
                    WALL_H / 2,
                    (ty + 0.5) * TILE,
                );
                this.wallMesh!.setMatrixAt(i, matrix);
                const panel = tileHash(tx, ty) % WALL_PANELS;
                offsets[i] = panel / WALL_PANELS;
            });
            this.wallMesh.instanceMatrix.needsUpdate = true;
            wallGeo.setAttribute('atlasOffset',
                new InstancedBufferAttribute(offsets, 1));
            this.group.add(this.wallMesh);
        }

        // ── Path InstancedMesh (3-panel atlas, ~25% LED variant) ──
        if (paths.length > 0) {
            const PATH_PANELS = 3;
            const pathGeo = new BoxGeometry(TILE * 0.95, PATH_H, TILE * 0.95);
            const pathMat = new MeshStandardMaterial({
                map: this.factory.getPathAtlas(),
                metalness: 0.1,
                roughness: 0.9,
            });
            patchMaterialForAtlas(pathMat, PATH_PANELS);

            this.pathMesh = new InstancedMesh(pathGeo, pathMat, paths.length);
            this.pathMesh.receiveShadow = true;

            const matrix = new Matrix4();
            const offsets = new Float32Array(paths.length);
            paths.forEach(({ tx, ty }, i) => {
                matrix.identity();
                matrix.setPosition(
                    (tx + 0.5) * TILE,
                    PATH_H / 2,
                    (ty + 0.5) * TILE,
                );
                this.pathMesh!.setMatrixAt(i, matrix);
                const h = tileHash(tx, ty);
                const panel = (h % 4 === 0) ? 2 : h % 2;
                offsets[i] = panel / PATH_PANELS;
            });
            this.pathMesh.instanceMatrix.needsUpdate = true;
            pathGeo.setAttribute('atlasOffset',
                new InstancedBufferAttribute(offsets, 1));
            this.group.add(this.pathMesh);
        }
    }

    clear(): void {
        if (this.floor) {
            this.floor.geometry.dispose();
            (this.floor.material as MeshBasicMaterial).dispose();
            this.group.remove(this.floor);
            this.floor = null;
        }
        if (this.boundary) {
            this.boundary.geometry.dispose();
            (this.boundary.material as LineBasicMaterial).dispose();
            this.group.remove(this.boundary);
            this.boundary = null;
        }
        if (this.wallMesh) {
            this.wallMesh.geometry.dispose();
            (this.wallMesh.material as MeshStandardMaterial).dispose();
            this.group.remove(this.wallMesh);
            this.wallMesh = null;
        }
        if (this.pathMesh) {
            this.pathMesh.geometry.dispose();
            (this.pathMesh.material as MeshStandardMaterial).dispose();
            this.group.remove(this.pathMesh);
            this.pathMesh = null;
        }
        for (const d of this.disposables) d.dispose();
        this.disposables.length = 0;
    }

    dispose(): void {
        this.clear();
    }
}
