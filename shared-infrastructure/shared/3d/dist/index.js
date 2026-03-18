// src/loader.ts
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
var ModelLoader = class {
  constructor(options = {}) {
    this.cache = /* @__PURE__ */ new Map();
    // URLs that are currently in-flight (key = url, value = shared promise)
    this.inflight = /* @__PURE__ */ new Map();
    this.maxCacheSize = options.maxCacheSize ?? 20;
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(options.dracoDecoderPath ?? "/draco/");
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }
  /**
   * Load a model from `url`. Returns from cache if available; otherwise
   * deduplicates concurrent loads so that parallel callers receive the
   * same promise.
   */
  async load(url) {
    if (this.cache.has(url)) {
      const model = this.cache.get(url);
      this.cache.delete(url);
      this.cache.set(url, model);
      return model;
    }
    const existing = this.inflight.get(url);
    if (existing) return existing;
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
  loadFromNetwork(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          resolve({ scene: gltf.scene, animations: gltf.animations });
        },
        (_progress) => {
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
  addToCache(url, model) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== void 0) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(url, model);
  }
  /** Pre-warm the cache by loading several models in parallel. */
  async preload(urls) {
    await Promise.all(urls.map((url) => this.load(url)));
  }
  /** Returns true if the model for `url` is already in the cache. */
  isCached(url) {
    return this.cache.has(url);
  }
  /** Returns the number of models currently in the cache. */
  getCacheSize() {
    return this.cache.size;
  }
  /** Clear the cache and dispose loaders. */
  dispose() {
    this.cache.clear();
    this.inflight.clear();
    this.dracoLoader.dispose?.();
  }
};

// src/animator.ts
import {
  AnimationMixer,
  LoopRepeat,
  LoopOnce
} from "three";
var AnimationController = class {
  constructor(root) {
    this.clips = /* @__PURE__ */ new Map();
    this.currentAction = null;
    this._currentAnimation = null;
    this.mixer = new AnimationMixer(root);
  }
  /** Name of the currently playing animation, or null if none. */
  get currentAnimation() {
    return this._currentAnimation;
  }
  /** Exposes the underlying AnimationMixer for external consumers. */
  get animationMixer() {
    return this.mixer;
  }
  /** Names of all registered clips. */
  get clipNames() {
    return Array.from(this.clips.keys());
  }
  /** Register an AnimationClip for later playback. */
  addClip(clip) {
    this.clips.set(clip.name, clip);
  }
  /**
   * Play a named clip. Cross-fades from the current animation if one is
   * active and `crossFadeDuration` > 0.
   */
  play(name, options = {}) {
    const clip = this.clips.get(name);
    if (!clip) {
      console.warn(`[AnimationController] Unknown clip: "${name}"`);
      return;
    }
    const {
      loop = true,
      crossFadeDuration = 0,
      timeScale = 1,
      clampWhenFinished = false
    } = options;
    const prevAction = this.currentAction;
    const newAction = this.mixer.clipAction(clip);
    newAction.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    newAction.clampWhenFinished = clampWhenFinished;
    newAction.setEffectiveTimeScale(timeScale);
    newAction.reset();
    if (prevAction && crossFadeDuration > 0) {
      newAction.crossFadeFrom(prevAction, crossFadeDuration, false);
    }
    newAction.play();
    this.currentAction = newAction;
    this._currentAnimation = name;
  }
  /**
   * Play a clip once, then automatically return to the previous animation
   * when the clip finishes.
   */
  playOnce(name, options = {}) {
    const previousAnimation = this._currentAnimation;
    this.play(name, { ...options, loop: false, clampWhenFinished: true });
    const finishedHandler = (event) => {
      if (event.action === this.currentAction) {
        this.mixer.removeEventListener("finished", finishedHandler);
        if (previousAnimation) {
          this.play(previousAnimation, { crossFadeDuration: options.crossFadeDuration });
        }
      }
    };
    this.mixer.addEventListener("finished", finishedHandler);
  }
  /** Stop all animations. */
  stop() {
    this.mixer.stopAllAction();
    this.currentAction = null;
    this._currentAnimation = null;
  }
  /** Advance the animation mixer by `delta` seconds. Call every frame. */
  update(delta) {
    this.mixer.update(delta);
  }
  /** Stop all actions and remove event listeners. */
  dispose() {
    this.mixer.stopAllAction();
    this.currentAction = null;
    this._currentAnimation = null;
  }
};

// src/cameras.ts
import { OrthographicCamera, PerspectiveCamera, MathUtils } from "three";
function createIsometricCamera(opts = {}) {
  const {
    frustumSize = 10,
    aspect = 1,
    pitch = 45,
    yaw = 45,
    distance = 20,
    near = 0.1,
    far = 1e3
  } = opts;
  const halfH = frustumSize / 2;
  const halfW = halfH * aspect;
  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far);
  const pitchRad = MathUtils.degToRad(pitch);
  const yawRad = MathUtils.degToRad(yaw);
  camera.position.set(
    distance * Math.cos(pitchRad) * Math.sin(yawRad),
    distance * Math.sin(pitchRad),
    distance * Math.cos(pitchRad) * Math.cos(yawRad)
  );
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera;
}
function createPresentationCamera(opts = {}) {
  const {
    fov = 45,
    aspect = 1,
    near = 0.1,
    far = 100,
    distance = 3,
    height = 1.5
  } = opts;
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, height, distance);
  camera.lookAt(0, height / 2, 0);
  camera.updateProjectionMatrix();
  return camera;
}
function createOrbitCamera(opts = {}) {
  const {
    fov = 45,
    aspect = 1,
    near = 0.1,
    far = 1e3,
    distance = 5
  } = opts;
  const camera = new PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera;
}

// src/lighting.ts
import {
  AmbientLight,
  DirectionalLight,
  SpotLight,
  Color
} from "three";
function createArenaLighting() {
  const ambient = new AmbientLight(16777215, 0.7);
  const key = new DirectionalLight(16774624, 1.5);
  key.position.set(10, 20, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 100;
  const fill = new DirectionalLight(14741759, 0.4);
  fill.position.set(-10, 5, -10);
  const lights = [ambient, key, fill];
  return {
    lights,
    dispose() {
      lights.length = 0;
    }
  };
}
function createQuizLighting(rimColor = 4482815) {
  const ambient = new AmbientLight(16777215, 0.5);
  const key = new DirectionalLight(16777215, 1);
  key.position.set(5, 10, 5);
  const fill = new DirectionalLight(16777215, 0.3);
  fill.position.set(-5, 5, 5);
  const rim = new DirectionalLight(new Color(rimColor), 0.8);
  rim.position.set(0, 5, -10);
  const lights = [ambient, key, fill, rim];
  return {
    lights,
    dispose() {
      lights.length = 0;
    }
  };
}
function createLobbyLighting() {
  const ambient = new AmbientLight(1118515, 0.8);
  const spot = new SpotLight(16777215, 2);
  spot.position.set(0, 10, 0);
  spot.angle = Math.PI / 6;
  spot.penumbra = 0.3;
  spot.castShadow = true;
  const fill = new DirectionalLight(8952319, 0.3);
  fill.position.set(-5, 3, 5);
  const lights = [ambient, spot, fill];
  return {
    lights,
    dispose() {
      lights.length = 0;
    }
  };
}

// src/characters.ts
import { clone as skeletonClone } from "three/addons/utils/SkeletonUtils.js";
var CharacterManager = class {
  constructor(options = {}) {
    /** Raw model cache: characterId → { url, model } */
    this.modelCache = /* @__PURE__ */ new Map();
    /** All live instances (for batch dispose) */
    this.instances = /* @__PURE__ */ new Set();
    this.loader = new ModelLoader(options.loaderOptions);
  }
  /**
   * Get a new, independent character instance. If the model for `id` has
   * already been loaded the cached geometry is reused; otherwise it is
   * fetched via ModelLoader.
   */
  async getCharacter(id, modelUrl) {
    let cached = this.modelCache.get(id);
    if (!cached || cached.url !== modelUrl) {
      const model = await this.loader.load(modelUrl);
      cached = { url: modelUrl, model };
      this.modelCache.set(id, cached);
    }
    const clonedScene = skeletonClone(cached.model.scene);
    const animController = new AnimationController(clonedScene);
    for (const clip of cached.model.animations) {
      animController.addClip(clip);
    }
    const instance = {
      id,
      mesh: clonedScene,
      mixer: animController.animationMixer,
      playAnimation(name, options) {
        animController.play(name, options);
      },
      stopAnimation() {
        animController.stop();
      },
      update(delta) {
        animController.update(delta);
      },
      dispose() {
        animController.dispose();
      }
    };
    this.instances.add(instance);
    return instance;
  }
  /**
   * Release a single instance, calling its dispose and removing it from
   * the tracked set.
   */
  releaseCharacter(instance) {
    instance.dispose();
    this.instances.delete(instance);
  }
  /**
   * Pre-warm the model cache for a character without creating an instance.
   */
  async preloadCharacter(id, modelUrl) {
    if (!this.modelCache.has(id)) {
      const model = await this.loader.load(modelUrl);
      this.modelCache.set(id, { url: modelUrl, model });
    }
  }
  /**
   * Dispose all live instances and the underlying model loader.
   */
  dispose() {
    for (const instance of this.instances) {
      instance.dispose();
    }
    this.instances.clear();
    this.modelCache.clear();
    this.loader.dispose();
  }
};

// src/viewer.ts
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera as PerspectiveCamera2,
  Clock
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as skeletonClone2 } from "three/addons/utils/SkeletonUtils.js";
function createCharacterViewer(loader) {
  const scene = new Scene();
  const camera = new PerspectiveCamera2(45, 1, 0.1, 100);
  camera.position.set(0, 1.5, 3);
  camera.lookAt(0, 0.75, 0);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio : 1);
  renderer.setClearColor(0, 0);
  const lighting = createQuizLighting();
  for (const light of lighting.lights) {
    scene.add(light);
  }
  let controls = null;
  let animController = null;
  let rafId = null;
  const clock = new Clock();
  let currentMesh = null;
  function startLoop() {
    if (rafId !== null) return;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      controls?.update();
      animController?.update(delta);
      renderer.render(scene, camera);
    };
    animate();
  }
  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  return {
    mount(container) {
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w || 300, h || 300);
      camera.aspect = (w || 300) / (h || 300);
      camera.updateProjectionMatrix();
      container.appendChild(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.5;
      controls.enablePan = false;
      controls.minDistance = 1.5;
      controls.maxDistance = 6;
      controls.target.set(0, 0.75, 0);
      controls.update();
      startLoop();
    },
    async loadCharacter(def) {
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh = null;
      }
      animController?.dispose();
      animController = null;
      const loaded = await loader.load(def.modelUrl);
      const mesh = skeletonClone2(loaded.scene);
      if (def.scale != null) {
        mesh.scale.setScalar(def.scale);
      }
      animController = new AnimationController(mesh);
      for (const clip of loaded.animations) {
        animController.addClip(clip);
      }
      if (def.defaultAnimation) {
        animController.play(def.defaultAnimation);
      }
      scene.add(mesh);
      currentMesh = mesh;
    },
    playAnimation(name) {
      animController?.playOnce(name);
    },
    resize() {
      const canvas = renderer.domElement;
      const container = canvas.parentElement;
      if (!container) return;
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      stopLoop();
      controls?.dispose();
      animController?.dispose();
      lighting.dispose();
      if (currentMesh) {
        scene.remove(currentMesh);
        currentMesh = null;
      }
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
export {
  AnimationController,
  CharacterManager,
  ModelLoader,
  createArenaLighting,
  createCharacterViewer,
  createIsometricCamera,
  createLobbyLighting,
  createOrbitCamera,
  createPresentationCamera,
  createQuizLighting
};
//# sourceMappingURL=index.js.map