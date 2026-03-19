import {
    Scene,
    WebGLRenderer,
    Group,
    Clock,
    Color,
} from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import {
    createIsometricCamera,
    createArenaLighting,
    CharacterManager,
} from 'shared-3d';
import type { OrthographicCamera } from 'three';
import type { LightingRig } from 'shared-3d';

/** Converts tile-based game coordinates (pixels at 32px/tile) to 3D world units. */
export const WORLD_SCALE = 1 / 32;

export class GameRenderer3D {
    readonly scene: Scene;
    readonly renderer: WebGLRenderer;
    readonly labelRenderer: CSS2DRenderer;
    readonly camera: OrthographicCamera;
    readonly characterManager: CharacterManager;

    // Layer groups — add objects to these to get correct draw order
    readonly terrainGroup: Group;
    readonly coverGroup: Group;
    readonly itemGroup: Group;
    readonly projectileGroup: Group;
    readonly playerGroup: Group;
    readonly npcGroup: Group;
    readonly zoneGroup: Group;

    private readonly lightingRig: LightingRig;
    private readonly container: HTMLElement;
    private readonly clock: Clock;
    /** Fixed isometric offset — camera position relative to the look-at target. */
    private readonly cameraOffset: { x: number; y: number; z: number };

    constructor(container: HTMLElement) {
        this.container = container;
        this.clock = new Clock();

        // Scene with dark background
        this.scene = new Scene();
        this.scene.background = new Color(0x0a0b1a);

        // Camera: isometric with steeper pitch for better floor visibility
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 22;
        this.camera = createIsometricCamera({
            frustumSize,
            aspect,
            pitch: 55,
            yaw: 45,
            distance: 30,
        });

        // WebGL renderer
        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // CSS2D renderer for labels
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(this.labelRenderer.domElement);

        // Lighting
        this.lightingRig = createArenaLighting();
        for (const light of this.lightingRig.lights) {
            this.scene.add(light);
        }

        // Layer groups
        this.terrainGroup = new Group();
        this.coverGroup = new Group();
        this.itemGroup = new Group();
        this.projectileGroup = new Group();
        this.playerGroup = new Group();
        this.npcGroup = new Group();
        this.zoneGroup = new Group();

        this.scene.add(
            this.terrainGroup,
            this.coverGroup,
            this.itemGroup,
            this.projectileGroup,
            this.playerGroup,
            this.npcGroup,
            this.zoneGroup,
        );

        // Character manager (shared model cache)
        this.characterManager = new CharacterManager();

        // Store the initial camera offset (isometric position relative to origin)
        this.cameraOffset = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z,
        };
    }

    /** Convert pixel-space game coordinates to 3D world units. */
    static toWorld(x: number, y: number): { wx: number; wz: number } {
        return { wx: x * WORLD_SCALE, wz: y * WORLD_SCALE };
    }

    /** Move the camera to track a player position (pixel space). */
    updateCamera(playerX: number, playerY: number): void {
        const { wx, wz } = GameRenderer3D.toWorld(playerX, playerY);
        this.camera.position.set(
            wx + this.cameraOffset.x,
            this.cameraOffset.y,
            wz + this.cameraOffset.z,
        );
        this.camera.lookAt(wx, 0, wz);
    }

    /** Get the elapsed delta from the internal clock. */
    getDelta(): number {
        return this.clock.getDelta();
    }

    /** Handle container resize. */
    resize(): void {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        const aspect = w / h;

        const frustumHalf = (this.camera.top);
        this.camera.left = -frustumHalf * aspect;
        this.camera.right = frustumHalf * aspect;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(w, h);
        this.labelRenderer.setSize(w, h);
    }

    /** Render one frame. */
    render(): void {
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }

    /** Clean up all GPU resources. */
    dispose(): void {
        this.lightingRig.dispose();
        this.characterManager.dispose();
        this.renderer.dispose();

        if (this.renderer.domElement.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
        if (this.labelRenderer.domElement.parentElement) {
            this.labelRenderer.domElement.parentElement.removeChild(this.labelRenderer.domElement);
        }
    }
}
