import { Object3D, AnimationMixer, AnimationClip, OrthographicCamera, PerspectiveCamera } from 'three';

interface PlayOptions {
    loop?: boolean;
    crossFadeDuration?: number;
    timeScale?: number;
    clampWhenFinished?: boolean;
}
interface CharacterInstance {
    id: string;
    mesh: Object3D;
    mixer: AnimationMixer;
    playAnimation(name: string, options?: PlayOptions): void;
    stopAnimation(): void;
    update(delta: number): void;
    dispose(): void;
}
interface CharacterDefinition {
    id: string;
    modelUrl: string;
    defaultAnimation?: string;
    scale?: number;
}
interface AssetManifest {
    characters: CharacterDefinition[];
    version: string;
}
interface IsometricCameraOptions {
    /** Orthographic frustum half-size (default 10) */
    frustumSize?: number;
    /** Viewport aspect ratio (default 1) */
    aspect?: number;
    /** Pitch angle in degrees (default 45) */
    pitch?: number;
    /** Yaw angle in degrees (default 45) */
    yaw?: number;
    /** Distance from origin (default 20) */
    distance?: number;
    near?: number;
    far?: number;
}
interface PresentationCameraOptions {
    /** Vertical field-of-view in degrees (default 45) */
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
    /** Distance from origin (default 3) */
    distance?: number;
    /** Height offset (default 1.5) */
    height?: number;
}
interface OrbitCameraOptions {
    fov?: number;
    aspect?: number;
    near?: number;
    far?: number;
    /** Initial distance from origin (default 5) */
    distance?: number;
}
interface LightingRig {
    /** All lights as a group — add this to your scene */
    lights: Object3D[];
    dispose(): void;
}
interface LoadedModel {
    scene: Object3D;
    animations: AnimationClip[];
}

interface ModelLoaderOptions {
    /** Maximum number of models to keep in the LRU cache (default 20) */
    maxCacheSize?: number;
    /** Path to the Draco WASM decoder (default '/draco/') */
    dracoDecoderPath?: string;
}
/**
 * Loads GLB/GLTF models using Three.js GLTFLoader + DRACOLoader.
 * Maintains an LRU cache to avoid redundant network requests.
 * Deduplicates concurrent loads of the same URL.
 */
declare class ModelLoader {
    private readonly maxCacheSize;
    private readonly cache;
    private readonly inflight;
    private readonly gltfLoader;
    private readonly dracoLoader;
    constructor(options?: ModelLoaderOptions);
    /**
     * Load a model from `url`. Returns from cache if available; otherwise
     * deduplicates concurrent loads so that parallel callers receive the
     * same promise.
     */
    load(url: string): Promise<LoadedModel>;
    private loadFromNetwork;
    private addToCache;
    /** Pre-warm the cache by loading several models in parallel. */
    preload(urls: string[]): Promise<void>;
    /** Returns true if the model for `url` is already in the cache. */
    isCached(url: string): boolean;
    /** Returns the number of models currently in the cache. */
    getCacheSize(): number;
    /** Clear the cache and dispose loaders. */
    dispose(): void;
}

/**
 * Wraps Three.js AnimationMixer to provide a high-level API for animation
 * playback, cross-fading, and one-shot animations.
 */
declare class AnimationController {
    private readonly mixer;
    private readonly clips;
    private currentAction;
    private _currentAnimation;
    constructor(root: Object3D);
    /** Name of the currently playing animation, or null if none. */
    get currentAnimation(): string | null;
    /** Exposes the underlying AnimationMixer for external consumers. */
    get animationMixer(): AnimationMixer;
    /** Names of all registered clips. */
    get clipNames(): string[];
    /** Register an AnimationClip for later playback. */
    addClip(clip: AnimationClip): void;
    /**
     * Play a named clip. Cross-fades from the current animation if one is
     * active and `crossFadeDuration` > 0.
     */
    play(name: string, options?: PlayOptions): void;
    /**
     * Play a clip once, then automatically return to the previous animation
     * when the clip finishes.
     */
    playOnce(name: string, options?: Omit<PlayOptions, 'loop'>): void;
    /** Stop all animations. */
    stop(): void;
    /** Advance the animation mixer by `delta` seconds. Call every frame. */
    update(delta: number): void;
    /** Stop all actions and remove event listeners. */
    dispose(): void;
}

/**
 * Create an OrthographicCamera configured for isometric top-down views.
 *
 * The camera is positioned at `pitch` and `yaw` angles (degrees) and
 * oriented to look at the world origin.
 */
declare function createIsometricCamera(opts?: IsometricCameraOptions): OrthographicCamera;
/**
 * Create a PerspectiveCamera suitable for character viewer / presentation panels.
 */
declare function createPresentationCamera(opts?: PresentationCameraOptions): PerspectiveCamera;
/**
 * Create a PerspectiveCamera positioned along the Z-axis, suitable for use
 * with OrbitControls.
 */
declare function createOrbitCamera(opts?: OrbitCameraOptions): PerspectiveCamera;

/**
 * Creates a standard 3-light rig for arena / isometric views.
 *
 * - Ambient: soft fill
 * - Key (DirectionalLight): top-right, casts shadows
 * - Fill (DirectionalLight): bottom-left, no shadows
 */
declare function createArenaLighting(): LightingRig;
/**
 * 3-point lighting rig for quiz / character scenes.
 *
 * @param rimColor  Hex colour for the rim/back light (default #4466ff).
 */
declare function createQuizLighting(rimColor?: number | string): LightingRig;
/**
 * Ambient + spotlight overhead for lobby / character-select screens.
 */
declare function createLobbyLighting(): LightingRig;

interface CharacterManagerOptions {
    loaderOptions?: ModelLoaderOptions;
}
/**
 * Manages loading, cloning, and lifecycle of 3D character models.
 *
 * Internally caches the raw geometry via ModelLoader so that multiple
 * instances of the same character share a single network request. Each
 * call to `getCharacter` returns an independent instance with its own
 * cloned mesh and AnimationController.
 */
declare class CharacterManager {
    private readonly loader;
    /** Raw model cache: characterId → { url, model } */
    private readonly modelCache;
    /** All live instances (for batch dispose) */
    private readonly instances;
    constructor(options?: CharacterManagerOptions);
    /**
     * Get a new, independent character instance. If the model for `id` has
     * already been loaded the cached geometry is reused; otherwise it is
     * fetched via ModelLoader.
     */
    getCharacter(id: string, modelUrl: string): Promise<CharacterInstance>;
    /**
     * Release a single instance, calling its dispose and removing it from
     * the tracked set.
     */
    releaseCharacter(instance: CharacterInstance): void;
    /**
     * Pre-warm the model cache for a character without creating an instance.
     */
    preloadCharacter(id: string, modelUrl: string): Promise<void>;
    /**
     * Dispose all live instances and the underlying model loader.
     */
    dispose(): void;
}

/**
 * Public interface for the CharacterViewer.
 */
interface CharacterViewer {
    /** Mount the Three.js canvas into the given container element. */
    mount(container: HTMLElement): void;
    /** Load and display a character model from a CharacterDefinition. */
    loadCharacter(def: CharacterDefinition): Promise<void>;
    /** Play a named animation clip (one-shot via AnimationController.playOnce). */
    playAnimation(name: string): void;
    /** Update renderer and camera aspect ratio after container resize. */
    resize(): void;
    /** Stop animation loop and release all Three.js resources. */
    dispose(): void;
}
/**
 * Create a CharacterViewer that uses a shared ModelLoader for GLB loading,
 * OrbitControls with auto-rotate, and quiz-style 3-point lighting.
 *
 * @param loader  A ModelLoader instance (can be shared with other viewers).
 */
declare function createCharacterViewer(loader: ModelLoader): CharacterViewer;

export { AnimationController, type AssetManifest, type CharacterDefinition, type CharacterInstance, CharacterManager, type CharacterManagerOptions, type CharacterViewer, type IsometricCameraOptions, type LightingRig, type LoadedModel, ModelLoader, type ModelLoaderOptions, type OrbitCameraOptions, type PlayOptions, type PresentationCameraOptions, createArenaLighting, createCharacterViewer, createIsometricCamera, createLobbyLighting, createOrbitCamera, createPresentationCamera, createQuizLighting };
