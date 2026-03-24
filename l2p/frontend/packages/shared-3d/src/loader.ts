import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { LoadedModel } from './types.js';

export interface ModelLoaderOptions {
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
export class ModelLoader {
  private readonly maxCacheSize: number;
  private readonly cache: Map<string, LoadedModel> = new Map();
  // URLs that are currently in-flight (key = url, value = shared promise)
  private readonly inflight: Map<string, Promise<LoadedModel>> = new Map();

  private readonly gltfLoader: InstanceType<typeof GLTFLoader>;
  private readonly dracoLoader: InstanceType<typeof DRACOLoader>;

  constructor(options: ModelLoaderOptions = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 20;

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(options.dracoDecoderPath ?? '/draco/');

    this.gltfLoader = new GLTFLoader();
    (this.gltfLoader as any).setDRACOLoader(this.dracoLoader);
  }

  /**
   * Load a model from `url`. Returns from cache if available; otherwise
   * deduplicates concurrent loads so that parallel callers receive the
   * same promise.
   */
  async load(url: string): Promise<LoadedModel> {
    // 1. Cache hit — move to end (most-recently-used) and return
    if (this.cache.has(url)) {
      const model = this.cache.get(url)!;
      this.cache.delete(url);
      this.cache.set(url, model);
      return model;
    }

    // 2. In-flight deduplication
    const existing = this.inflight.get(url);
    if (existing) return existing;

    // 3. Start new load
    const promise = this.loadFromNetwork(url);
    this.inflight.set(url, promise);

    try {
      const model = await promise;
      this.inflight.delete(url);
      this.addToCache(url, model);
      return model;
    } catch (err) {
      this.inflight.delete(url);
      throw err;
    }
  }

  private loadFromNetwork(url: string): Promise<LoadedModel> {
    return new Promise((resolve, reject) => {
      (this.gltfLoader as any).load(
        url,
        (gltf: { scene: any; animations: any[] }) => {
          resolve({ scene: gltf.scene, animations: gltf.animations });
        },
        (_progress: unknown) => {
          // progress callback — intentionally empty
        },
        (error: unknown) => {
          reject(error);
        },
      );
    });
  }

  private addToCache(url: string, model: LoadedModel): void {
    // LRU eviction: remove the oldest entry (first key in Map)
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(url, model);
  }

  /** Pre-warm the cache by loading several models in parallel. */
  async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.load(url)));
  }

  /** Returns true if the model for `url` is already in the cache. */
  isCached(url: string): boolean {
    return this.cache.has(url);
  }

  /** Returns the number of models currently in the cache. */
  getCacheSize(): number {
    return this.cache.size;
  }

  /** Clear the cache and dispose loaders. */
  dispose(): void {
    this.cache.clear();
    this.inflight.clear();
    (this.dracoLoader as any).dispose?.();
  }
}
