import { Object3D } from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { ModelLoader, type ModelLoaderOptions } from './loader.js';
import { AnimationController } from './animator.js';
import type { CharacterInstance, PlayOptions, LoadedModel } from './types.js';

export interface CharacterManagerOptions {
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
export class CharacterManager {
  private readonly loader: ModelLoader;
  /** Raw model cache: characterId → { url, model } */
  private readonly modelCache: Map<string, { url: string; model: LoadedModel }> = new Map();
  /** All live instances (for batch dispose) */
  private readonly instances: Set<CharacterInstance> = new Set();

  constructor(options: CharacterManagerOptions = {}) {
    this.loader = new ModelLoader(options.loaderOptions);
  }

  /**
   * Get a new, independent character instance. If the model for `id` has
   * already been loaded the cached geometry is reused; otherwise it is
   * fetched via ModelLoader.
   */
  async getCharacter(id: string, modelUrl: string): Promise<CharacterInstance> {
    let cached = this.modelCache.get(id);

    if (!cached || cached.url !== modelUrl) {
      const model = await this.loader.load(modelUrl);
      cached = { url: modelUrl, model };
      this.modelCache.set(id, cached);
    }

    // Clone the scene graph so each instance is independent
    const clonedScene = skeletonClone(cached.model.scene) as Object3D;

    // Set up animation controller and register all clips
    const animController = new AnimationController(clonedScene);
    for (const clip of cached.model.animations) {
      animController.addClip(clip);
    }

    const instance: CharacterInstance = {
      id,
      mesh: clonedScene,
      mixer: (animController as any).mixer,
      playAnimation(name: string, options?: PlayOptions) {
        animController.play(name, options);
      },
      stopAnimation() {
        animController.stop();
      },
      update(delta: number) {
        animController.update(delta);
      },
      dispose() {
        animController.dispose();
      },
    };

    this.instances.add(instance);
    return instance;
  }

  /**
   * Release a single instance, calling its dispose and removing it from
   * the tracked set.
   */
  releaseCharacter(instance: CharacterInstance): void {
    instance.dispose();
    this.instances.delete(instance);
  }

  /**
   * Pre-warm the model cache for a character without creating an instance.
   */
  async preloadCharacter(id: string, modelUrl: string): Promise<void> {
    await this.loader.preload([modelUrl]);
    // We don't store in modelCache here because we don't have the parsed model
    // object yet — ModelLoader.preload only warms the internal GLTF cache.
  }

  /**
   * Dispose all live instances and the underlying model loader.
   */
  dispose(): void {
    for (const instance of this.instances) {
      instance.dispose();
    }
    this.instances.clear();
    this.modelCache.clear();
    this.loader.dispose();
  }
}
