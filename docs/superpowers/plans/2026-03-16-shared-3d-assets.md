# Shared 3D Asset System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 2D rendering in Arena (PixiJS sprites) and L2P (emoji/SVG) with shared 3D assets — isometric ARPG gameplay for Arena, animated quiz characters for L2P.

**Architecture:** Shared vanilla-JS Three.js core (`shared-3d`) consumed by Arena (imperative Three.js) and L2P (React Three Fiber). Assetgenerator extended with Mixamo rigging + animation pipeline. Feature-flag migration for Arena renderer.

**Tech Stack:** Three.js ^0.170, React Three Fiber ^9, @react-three/drei ^9, tsup, Playwright (Mixamo automation), gltf-transform CLI

**Spec:** `docs/superpowers/specs/2026-03-16-shared-3d-assets-design.md`

---

## File Structure

### Phase 1: shared-3d Package

```
shared-infrastructure/shared/3d/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── loader.ts          # ModelLoader class
│   ├── animator.ts         # AnimationController class
│   ├── cameras.ts          # Camera factory functions
│   ├── lighting.ts         # Lighting rig factory functions
│   └── characters.ts       # CharacterManager class
└── __tests__/
    ├── loader.test.ts
    ├── animator.test.ts
    ├── cameras.test.ts
    └── characters.test.ts
```

### Phase 2: Assetgenerator Pipeline Extension

```
Assetgenerator/
├── adapters/
│   └── mixamo.js           # NEW: Playwright-based Mixamo automation
├── scripts/
│   ├── auto_rig.py         # NEW: Blender Rigify fallback
│   └── optimize_glb.sh     # NEW: gltf-transform compression
├── config/
│   └── visual-config.json  # MODIFY: add hasRig, hasAnimations, animationClips
└── server.js               # MODIFY: add rig/animate phase routing
```

### Phase 3: Arena 3D Isometric Renderer

```
arena/frontend/
├── package.json             # MODIFY: add three, shared-3d; remove pixi after cutover
├── src/
│   ├── components/
│   │   ├── Game3D.tsx       # NEW: Three.js game component (replaces Game.tsx)
│   │   └── Game.tsx         # KEEP: behind feature flag until cutover
│   ├── services/
│   │   ├── GameRenderer3D.ts    # NEW: Three.js scene manager
│   │   ├── TerrainRenderer.ts   # NEW: isometric tile terrain
│   │   ├── PlayerRenderer.ts    # NEW: 3D character rendering + animation
│   │   ├── ProjectileRenderer.ts # NEW: bullets, grenades, VFX
│   │   ├── CoverRenderer.ts     # NEW: 3D cover objects
│   │   ├── ItemRenderer.ts      # NEW: 3D item rendering
│   │   ├── ZoneRenderer.ts      # NEW: danger zone overlay
│   │   └── LabelRenderer.ts     # NEW: CSS2DRenderer labels
│   └── stores/
│       └── gameStore.ts     # MODIFY: add use3DRenderer flag
```

### Phase 4: L2P 3D Character Scenes

```
l2p/frontend/
├── package.json             # MODIFY: add three, @react-three/fiber, @react-three/drei, shared-3d
├── src/
│   ├── components/
│   │   └── 3d/
│   │       ├── QuizCharacterScene.tsx   # NEW
│   │       ├── LobbyRoomScene.tsx       # NEW
│   │       ├── PodiumScene.tsx          # NEW
│   │       ├── DuelArenaScene.tsx       # NEW
│   │       └── CharacterCanvas.tsx      # NEW: shared canvas wrapper
│   ├── pages/
│   │   ├── GamePage.tsx     # MODIFY: integrate QuizCharacterScene
│   │   ├── LobbyPage.tsx    # MODIFY: integrate LobbyRoomScene
│   │   └── ResultsPage.tsx  # MODIFY: integrate PodiumScene
│   ├── services/
│   │   └── avatarService.ts # MODIFY: add getAvatarModelPath()
│   └── types/
│       └── index.ts         # MODIFY: add modelPath to Character
```

### Phase 5: Shared Character Selector

```
shared-infrastructure/shared/3d/src/
└── viewer.ts                # NEW: CharacterViewerScene (shared R3F component)

arena/frontend/src/components/
└── CharacterPicker3D.tsx    # NEW: replaces CharacterPicker.tsx

l2p/frontend/src/components/
└── CharacterSelector3D.tsx  # NEW: replaces CharacterSelector.tsx
```

---

## Chunk 1: shared-3d Package (Phase 1)

### Task 1: Scaffold shared-3d package

**Files:**
- Create: `shared-infrastructure/shared/3d/package.json`
- Create: `shared-infrastructure/shared/3d/tsconfig.json`
- Create: `shared-infrastructure/shared/3d/tsup.config.ts`
- Create: `shared-infrastructure/shared/3d/src/types.ts`
- Create: `shared-infrastructure/shared/3d/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "shared-3d",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/three": "^0.170.0"
  },
  "peerDependencies": {
    "three": "^0.170.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src"],
  "exclude": ["**/__tests__", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['three'],
});
```

- [ ] **Step 4: Create src/types.ts**

```typescript
import type { Group, AnimationClip, AnimationMixer, Object3D } from 'three';

export interface CharacterInstance {
  mesh: Group;
  mixer: AnimationMixer;
  playAnimation: (name: string, options?: PlayOptions) => void;
  stopAnimation: () => void;
  update: (delta: number) => void;
  dispose: () => void;
}

export interface PlayOptions {
  loop?: boolean;
  crossFadeDuration?: number;
  onComplete?: () => void;
}

export interface CharacterDefinition {
  id: string;
  modelPath: string;
  animations: Record<string, string>;
  color: string;
  variants?: string[];
}

export interface AssetManifest {
  characters: Record<string, CharacterDefinition>;
}

export type CameraPreset = 'isometric' | 'presentation' | 'orbit';

export interface IsometricCameraOptions {
  viewSize: number;
  aspect: number;
  pitch?: number;
  yaw?: number;
}

export interface PresentationCameraOptions {
  fov?: number;
  distance?: number;
  height?: number;
  autoOrbitSpeed?: number;
}

export interface LightingRig {
  lights: Object3D[];
  dispose: () => void;
}
```

- [ ] **Step 5: Create src/index.ts (barrel export)**

```typescript
export * from './types';
export { ModelLoader } from './loader';
export { AnimationController } from './animator';
export { createIsometricCamera, createPresentationCamera, createOrbitCamera } from './cameras';
export { createArenaLighting, createQuizLighting, createLobbyLighting } from './lighting';
export { CharacterManager } from './characters';
```

- [ ] **Step 6: Install dependencies and verify build scaffold**

```bash
cd shared-infrastructure/shared/3d && npm install && npx tsc --noEmit
```

Expected: Install succeeds, typecheck passes (empty modules).

- [ ] **Step 7: Commit**

```bash
git add shared-infrastructure/shared/3d/
git commit -m "feat(shared-3d): scaffold package with types and build config"
```

---

### Task 2: ModelLoader — GLB loading with LRU cache

**Files:**
- Create: `shared-infrastructure/shared/3d/src/loader.ts`
- Create: `shared-infrastructure/shared/3d/__tests__/loader.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/loader.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelLoader } from '../src/loader';

// Mock Three.js GLTFLoader
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    setDRACOLoader: vi.fn(),
    loadAsync: vi.fn().mockResolvedValue({
      scene: { clone: () => ({ type: 'Group' }) },
      animations: [{ name: 'idle', duration: 2 }],
    }),
  })),
}));

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: vi.fn().mockImplementation(() => ({
    setDecoderPath: vi.fn(),
    setDecoderConfig: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('ModelLoader', () => {
  let loader: ModelLoader;

  beforeEach(() => {
    loader = new ModelLoader({ maxCacheSize: 3 });
  });

  it('loads a GLB model and returns scene + animations', async () => {
    const result = await loader.load('/models/warrior.glb');
    expect(result.scene).toBeDefined();
    expect(result.animations).toHaveLength(1);
    expect(result.animations[0].name).toBe('idle');
  });

  it('returns cached model on second load', async () => {
    const result1 = await loader.load('/models/warrior.glb');
    const result2 = await loader.load('/models/warrior.glb');
    // Same reference from cache
    expect(result1).toBe(result2);
  });

  it('evicts LRU entry when cache full', async () => {
    await loader.load('/models/a.glb');
    await loader.load('/models/b.glb');
    await loader.load('/models/c.glb');
    // Access a to make it recently used
    await loader.load('/models/a.glb');
    // Load d — should evict b (least recently used)
    await loader.load('/models/d.glb');
    expect(loader.getCacheSize()).toBe(3);
    expect(loader.isCached('/models/a.glb')).toBe(true);
    expect(loader.isCached('/models/b.glb')).toBe(false);
    expect(loader.isCached('/models/d.glb')).toBe(true);
  });

  it('preloads multiple models', async () => {
    await loader.preload(['/models/a.glb', '/models/b.glb']);
    expect(loader.isCached('/models/a.glb')).toBe(true);
    expect(loader.isCached('/models/b.glb')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/loader.test.ts
```

Expected: FAIL — `ModelLoader` not found.

- [ ] **Step 3: Implement ModelLoader**

```typescript
// src/loader.ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { Group, AnimationClip } from 'three';

export interface LoadResult {
  scene: Group;
  animations: AnimationClip[];
}

interface CacheEntry {
  result: LoadResult;
  lastAccessed: number;
}

export class ModelLoader {
  private gltfLoader: GLTFLoader;
  private cache = new Map<string, CacheEntry>();
  private loading = new Map<string, Promise<LoadResult>>();
  private maxCacheSize: number;

  constructor(options: { maxCacheSize?: number; dracoPath?: string } = {}) {
    this.maxCacheSize = options.maxCacheSize ?? 20;
    this.gltfLoader = new GLTFLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(options.dracoPath ?? 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  async load(url: string): Promise<LoadResult> {
    // Return from cache
    const cached = this.cache.get(url);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.result;
    }

    // Deduplicate concurrent loads
    const existing = this.loading.get(url);
    if (existing) return existing;

    const promise = this.gltfLoader.loadAsync(url).then((gltf) => {
      const result: LoadResult = {
        scene: gltf.scene as Group,
        animations: gltf.animations ?? [],
      };

      this.evictIfNeeded();
      this.cache.set(url, { result, lastAccessed: Date.now() });
      this.loading.delete(url);
      return result;
    });

    this.loading.set(url, promise);
    return promise;
  }

  async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.load(url)));
  }

  isCached(url: string): boolean {
    return this.cache.has(url);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, entry] of this.cache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
  }

  dispose(): void {
    this.cache.clear();
    this.loading.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/loader.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared-infrastructure/shared/3d/src/loader.ts shared-infrastructure/shared/3d/__tests__/loader.test.ts
git commit -m "feat(shared-3d): add ModelLoader with LRU cache and Draco support"
```

---

### Task 3: AnimationController — mixer, clips, emote queue

**Files:**
- Create: `shared-infrastructure/shared/3d/src/animator.ts`
- Create: `shared-infrastructure/shared/3d/__tests__/animator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/animator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimationController } from '../src/animator';
import {
  AnimationMixer,
  AnimationClip,
  AnimationAction,
  LoopRepeat,
  LoopOnce,
  Object3D,
  NumberKeyframeTrack,
} from 'three';

function makeClip(name: string, duration = 1): AnimationClip {
  const track = new NumberKeyframeTrack('.position[x]', [0, duration], [0, 1]);
  return new AnimationClip(name, duration, [track]);
}

describe('AnimationController', () => {
  let root: Object3D;
  let controller: AnimationController;
  let clips: AnimationClip[];

  beforeEach(() => {
    root = new Object3D();
    clips = [makeClip('idle', 2), makeClip('walk', 0.8), makeClip('victory', 1.5)];
    controller = new AnimationController(root, clips);
  });

  it('plays an animation by name', () => {
    controller.play('idle');
    expect(controller.currentAnimation).toBe('idle');
  });

  it('crossfades between animations', () => {
    controller.play('idle');
    controller.play('walk', { crossFadeDuration: 0.3 });
    expect(controller.currentAnimation).toBe('walk');
  });

  it('plays one-shot animation then returns to previous', () => {
    controller.play('idle', { loop: true });
    controller.playOnce('victory');
    expect(controller.currentAnimation).toBe('victory');
  });

  it('returns available clip names', () => {
    expect(controller.clipNames).toEqual(['idle', 'walk', 'victory']);
  });

  it('adds clips after construction', () => {
    const extra = makeClip('death', 1.2);
    controller.addClip(extra);
    expect(controller.clipNames).toContain('death');
  });

  it('disposes mixer', () => {
    controller.dispose();
    expect(controller.currentAnimation).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/animator.test.ts
```

Expected: FAIL — `AnimationController` not found.

- [ ] **Step 3: Implement AnimationController**

```typescript
// src/animator.ts
import {
  AnimationMixer,
  AnimationClip,
  AnimationAction,
  LoopRepeat,
  LoopOnce,
  Object3D,
} from 'three';
import type { PlayOptions } from './types';

export class AnimationController {
  private mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private clips = new Map<string, AnimationClip>();
  private _currentAnimation: string | null = null;
  private _previousAnimation: string | null = null;
  private disposed = false;

  constructor(root: Object3D, clips: AnimationClip[] = []) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) {
      this.addClip(clip);
    }
  }

  get currentAnimation(): string | null {
    return this._currentAnimation;
  }

  get clipNames(): string[] {
    return Array.from(this.clips.keys());
  }

  addClip(clip: AnimationClip): void {
    this.clips.set(clip.name, clip);
    const action = this.mixer.clipAction(clip);
    this.actions.set(clip.name, action);
  }

  play(name: string, options: PlayOptions = {}): void {
    if (this.disposed) return;
    const action = this.actions.get(name);
    if (!action) return;

    const { loop = true, crossFadeDuration = 0.2 } = options;

    const currentAction = this._currentAnimation
      ? this.actions.get(this._currentAnimation)
      : null;

    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.reset().play();

    if (currentAction && currentAction !== action) {
      action.crossFadeFrom(currentAction, crossFadeDuration, true);
    }

    this._previousAnimation = this._currentAnimation;
    this._currentAnimation = name;
  }

  playOnce(name: string, options: Omit<PlayOptions, 'loop'> = {}): void {
    const returnTo = this._currentAnimation;

    this.play(name, { ...options, loop: false });

    // Listen for completion to return to previous animation
    const action = this.actions.get(name);
    if (action && returnTo) {
      const onFinished = (e: { action: AnimationAction }) => {
        if (e.action === action) {
          this.mixer.removeEventListener('finished', onFinished);
          if (this._currentAnimation === name) {
            this.play(returnTo, { loop: true });
          }
          options.onComplete?.();
        }
      };
      this.mixer.addEventListener('finished', onFinished);
    }
  }

  stop(): void {
    this.mixer.stopAllAction();
    this._currentAnimation = null;
  }

  update(delta: number): void {
    if (!this.disposed) {
      this.mixer.update(delta);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.actions.clear();
    this.clips.clear();
    this._currentAnimation = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/animator.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared-infrastructure/shared/3d/src/animator.ts shared-infrastructure/shared/3d/__tests__/animator.test.ts
git commit -m "feat(shared-3d): add AnimationController with crossfade and one-shot support"
```

---

### Task 4: Camera and Lighting factories

**Files:**
- Create: `shared-infrastructure/shared/3d/src/cameras.ts`
- Create: `shared-infrastructure/shared/3d/src/lighting.ts`
- Create: `shared-infrastructure/shared/3d/__tests__/cameras.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/cameras.test.ts
import { describe, it, expect } from 'vitest';
import { createIsometricCamera, createPresentationCamera, createOrbitCamera } from '../src/cameras';
import { OrthographicCamera, PerspectiveCamera } from 'three';

describe('Camera factories', () => {
  it('creates an orthographic isometric camera', () => {
    const cam = createIsometricCamera({ viewSize: 22, aspect: 16 / 9 });
    expect(cam).toBeInstanceOf(OrthographicCamera);
    // 45° pitch, 45° yaw: camera should be offset equally on x, y, z
    expect(cam.position.x).toBeGreaterThan(0);
    expect(cam.position.y).toBeGreaterThan(0);
    expect(cam.position.z).toBeGreaterThan(0);
    expect(Math.abs(cam.position.x - cam.position.z)).toBeLessThan(0.01);
  });

  it('creates a perspective presentation camera', () => {
    const cam = createPresentationCamera({ distance: 3, height: 1.2 });
    expect(cam).toBeInstanceOf(PerspectiveCamera);
    expect(cam.position.z).toBeCloseTo(3, 0);
    expect(cam.position.y).toBeCloseTo(1.2, 0);
  });

  it('creates an orbit camera (perspective)', () => {
    const cam = createOrbitCamera({ fov: 45 });
    expect(cam).toBeInstanceOf(PerspectiveCamera);
    expect(cam.fov).toBe(45);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/cameras.test.ts
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement cameras.ts**

```typescript
// src/cameras.ts
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import type { IsometricCameraOptions, PresentationCameraOptions } from './types';

export function createIsometricCamera(options: IsometricCameraOptions): OrthographicCamera {
  const { viewSize, aspect, pitch = 45, yaw = 45 } = options;
  const halfH = viewSize / 2;
  const halfW = halfH * aspect;

  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 1000);

  // Position camera at 45° pitch and yaw
  const distance = viewSize;
  const pitchRad = (pitch * Math.PI) / 180;
  const yawRad = (yaw * Math.PI) / 180;

  camera.position.set(
    distance * Math.cos(pitchRad) * Math.sin(yawRad),
    distance * Math.sin(pitchRad),
    distance * Math.cos(pitchRad) * Math.cos(yawRad)
  );
  camera.lookAt(0, 0, 0);

  return camera;
}

export function createPresentationCamera(
  options: PresentationCameraOptions = {}
): PerspectiveCamera {
  const { fov = 40, distance = 3, height = 1.2, autoOrbitSpeed: _ } = options;
  const camera = new PerspectiveCamera(fov, 1, 0.01, 100);
  camera.position.set(0, height, distance);
  camera.lookAt(0, height * 0.5, 0);
  return camera;
}

export function createOrbitCamera(
  options: { fov?: number; near?: number; far?: number } = {}
): PerspectiveCamera {
  const { fov = 50, near = 0.1, far = 100 } = options;
  return new PerspectiveCamera(fov, 1, near, far);
}
```

- [ ] **Step 4: Implement lighting.ts**

```typescript
// src/lighting.ts
import { AmbientLight, DirectionalLight, PointLight, Object3D, Color } from 'three';
import type { LightingRig } from './types';

export function createArenaLighting(): LightingRig {
  const ambient = new AmbientLight(0xffffff, 0.3);

  const key = new DirectionalLight(0xfff0e0, 1.0);
  key.position.set(10, 15, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 50;
  key.shadow.camera.left = -20;
  key.shadow.camera.right = 20;
  key.shadow.camera.top = 20;
  key.shadow.camera.bottom = -20;

  const fill = new DirectionalLight(0xe0f0ff, 0.4);
  fill.position.set(-8, 10, -8);

  const lights: Object3D[] = [ambient, key, fill];

  return {
    lights,
    dispose: () => {
      key.shadow.map?.dispose();
    },
  };
}

export function createQuizLighting(characterColor = '#00f2ff'): LightingRig {
  const ambient = new AmbientLight(0xffffff, 0.4);

  const key = new DirectionalLight(0xfff0e0, 1.2);
  key.position.set(2, 3, 4);

  const fill = new DirectionalLight(0xe0f0ff, 0.6);
  fill.position.set(-3, 2, -1);

  const rim = new DirectionalLight(new Color(characterColor), 0.3);
  rim.position.set(0, 2, -3);

  return { lights: [ambient, key, fill, rim], dispose: () => {} };
}

export function createLobbyLighting(): LightingRig {
  const ambient = new AmbientLight(0xffffff, 0.5);

  const spot = new PointLight(0xffd700, 1, 10);
  spot.position.set(0, 4, 0);

  const fill = new DirectionalLight(0xe0e8ff, 0.3);
  fill.position.set(-5, 3, 5);

  return { lights: [ambient, spot, fill], dispose: () => {} };
}
```

- [ ] **Step 5: Run tests**

```bash
cd shared-infrastructure/shared/3d && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared-infrastructure/shared/3d/src/cameras.ts shared-infrastructure/shared/3d/src/lighting.ts shared-infrastructure/shared/3d/__tests__/cameras.test.ts
git commit -m "feat(shared-3d): add camera presets (isometric, presentation, orbit) and lighting rigs"
```

---

### Task 5: CharacterManager — load, clone, dispose

**Files:**
- Create: `shared-infrastructure/shared/3d/src/characters.ts`
- Create: `shared-infrastructure/shared/3d/__tests__/characters.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/characters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterManager } from '../src/characters';
import { ModelLoader } from '../src/loader';
import { Object3D, Group, AnimationClip, NumberKeyframeTrack } from 'three';

// Mock SkeletonUtils
vi.mock('three/addons/utils/SkeletonUtils.js', () => ({
  SkeletonUtils: {
    clone: vi.fn((obj: Object3D) => {
      const cloned = new Group();
      cloned.name = obj.name + '_clone';
      return cloned;
    }),
  },
}));

function makeClip(name: string): AnimationClip {
  return new AnimationClip(name, 1, [
    new NumberKeyframeTrack('.position[x]', [0, 1], [0, 1]),
  ]);
}

describe('CharacterManager', () => {
  let manager: CharacterManager;
  let mockLoader: ModelLoader;

  beforeEach(() => {
    mockLoader = {
      load: vi.fn().mockResolvedValue({
        scene: Object.assign(new Group(), { name: 'warrior' }),
        animations: [makeClip('idle'), makeClip('walk')],
      }),
      preload: vi.fn(),
      isCached: vi.fn().mockReturnValue(true),
    } as unknown as ModelLoader;

    manager = new CharacterManager(mockLoader);
  });

  it('creates a character instance with mesh and animation', async () => {
    const instance = await manager.getCharacter('warrior', '/models/warrior.glb');
    expect(instance.mesh).toBeDefined();
    expect(instance.playAnimation).toBeInstanceOf(Function);
    expect(instance.dispose).toBeInstanceOf(Function);
  });

  it('clones model for second instance of same character', async () => {
    const inst1 = await manager.getCharacter('warrior', '/models/warrior.glb');
    const inst2 = await manager.getCharacter('warrior', '/models/warrior.glb');
    // Different mesh instances
    expect(inst1.mesh).not.toBe(inst2.mesh);
    // But only one loader.load call (cached)
    expect(mockLoader.load).toHaveBeenCalledTimes(1);
  });

  it('releases character and disposes mixer', async () => {
    const instance = await manager.getCharacter('warrior', '/models/warrior.glb');
    manager.releaseCharacter(instance);
    // Should not throw
    expect(() => instance.update(0.016)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd shared-infrastructure/shared/3d && npx vitest run __tests__/characters.test.ts
```

Expected: FAIL — `CharacterManager` not found.

- [ ] **Step 3: Implement CharacterManager**

```typescript
// src/characters.ts
import { Group, AnimationClip } from 'three';
import { SkeletonUtils } from 'three/addons/utils/SkeletonUtils.js';
import { ModelLoader, type LoadResult } from './loader';
import { AnimationController } from './animator';
import type { CharacterInstance, PlayOptions } from './types';

export class CharacterManager {
  private loader: ModelLoader;
  private modelCache = new Map<string, LoadResult>();
  private instances = new Set<CharacterInstance>();

  constructor(loader: ModelLoader) {
    this.loader = loader;
  }

  async getCharacter(id: string, modelUrl: string): Promise<CharacterInstance> {
    // Load or get cached model
    let model = this.modelCache.get(id);
    if (!model) {
      model = await this.loader.load(modelUrl);
      this.modelCache.set(id, model);
    }

    // Clone mesh with independent skeleton
    const mesh = SkeletonUtils.clone(model.scene) as Group;

    // Create independent animation controller
    const controller = new AnimationController(mesh, model.animations);

    const instance: CharacterInstance = {
      mesh,
      mixer: (controller as any).mixer, // expose for external delta updates
      playAnimation: (name: string, options?: PlayOptions) => controller.play(name, options),
      stopAnimation: () => controller.stop(),
      update: (delta: number) => controller.update(delta),
      dispose: () => {
        controller.dispose();
        this.instances.delete(instance);
      },
    };

    this.instances.add(instance);
    return instance;
  }

  releaseCharacter(instance: CharacterInstance): void {
    instance.dispose();
  }

  async preloadCharacter(id: string, modelUrl: string): Promise<void> {
    if (!this.modelCache.has(id)) {
      const model = await this.loader.load(modelUrl);
      this.modelCache.set(id, model);
    }
  }

  dispose(): void {
    for (const instance of this.instances) {
      instance.dispose();
    }
    this.instances.clear();
    this.modelCache.clear();
  }
}
```

- [ ] **Step 4: Run all tests**

```bash
cd shared-infrastructure/shared/3d && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Build the package**

```bash
cd shared-infrastructure/shared/3d && npm run build
```

Expected: `dist/` created with `index.js`, `index.d.ts`.

- [ ] **Step 6: Commit**

```bash
git add shared-infrastructure/shared/3d/src/characters.ts shared-infrastructure/shared/3d/__tests__/characters.test.ts
git commit -m "feat(shared-3d): add CharacterManager with SkeletonUtils cloning"
```

---

## Chunk 2: Assetgenerator Pipeline Extension (Phase 2)

### Task 6: Update visual-config.json with rig/animate fields

**Files:**
- Modify: `Assetgenerator/config/visual-config.json`

- [ ] **Step 1: Add new fields to characters category (edit, not replace)**

In `Assetgenerator/config/visual-config.json`, add three new fields after the existing `"has3D": true` line in the `characters` category. Use the Edit tool — do NOT replace the entire file:

```diff
      "has3D": true
+     "hasRig": true,
+     "hasAnimations": true,
+     "animationClips": [
+       "idle", "walk", "run", "shoot", "melee", "throw",
+       "hit_react", "death", "victory", "defeat",
+       "thinking", "celebrate", "wave", "clap", "thumbsup"
+     ]
```

All other categories and fields remain unchanged.

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/config/visual-config.json
git commit -m "feat(assetgen): add rig/animate config fields to visual-config.json"
```

---

### Task 7: Blender Rigify fallback script

**Files:**
- Create: `Assetgenerator/scripts/auto_rig.py`

- [ ] **Step 1: Create auto_rig.py**

This script runs in Blender's Python environment (`blender --background --python`). It adds a Rigify humanoid armature to a static mesh and auto-weights it.

```python
#!/usr/bin/env python3
"""Auto-rig a static GLB mesh using Blender's Rigify addon.

Usage:
    blender --background --python auto_rig.py -- --input model.glb --output model_rigged.glb

Requires: Blender 3.6+ with Rigify addon enabled.
"""
import bpy
import sys
import argparse


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Input GLB path")
    parser.add_argument("--output", required=True, help="Output rigged GLB path")
    return parser.parse_args(argv)


def main():
    args = parse_args()

    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import GLB
    bpy.ops.import_scene.gltf(filepath=args.input)

    # Find mesh object
    mesh_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            mesh_obj = obj
            break

    if not mesh_obj:
        print("ERROR: No mesh found in GLB")
        sys.exit(1)

    # Enable Rigify addon
    bpy.ops.preferences.addon_enable(module="rigify")

    # Add basic human metarig
    bpy.ops.object.armature_human_metarig_add()
    metarig = bpy.context.active_object

    # Scale metarig to match mesh bounding box
    mesh_height = mesh_obj.dimensions.z
    metarig_height = metarig.dimensions.z
    if metarig_height > 0:
        scale_factor = mesh_height / metarig_height
        metarig.scale = (scale_factor, scale_factor, scale_factor)
        bpy.ops.object.transform_apply(scale=True)

    # Center metarig at mesh origin
    metarig.location = mesh_obj.location

    # Generate Rigify rig
    bpy.context.view_layer.objects.active = metarig
    bpy.ops.pose.rigify_generate()

    # Find the generated rig
    rig = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE' and obj != metarig:
            rig = obj
            break

    if not rig:
        print("ERROR: Rigify generation failed")
        sys.exit(1)

    # Parent mesh to rig with automatic weights
    mesh_obj.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # Delete metarig
    bpy.data.objects.remove(metarig, do_unlink=True)

    # Select only rig and mesh for export
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    mesh_obj.select_set(True)

    # Export as GLB
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format='GLB',
        use_selection=True,
        export_animations=False,
    )

    print(f"SUCCESS: Rigged model saved to {args.output}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/scripts/auto_rig.py
git commit -m "feat(assetgen): add Blender Rigify auto-rig fallback script"
```

---

### Task 8: GLB optimization script

**Files:**
- Create: `Assetgenerator/scripts/optimize_glb.sh`

- [ ] **Step 1: Create optimize_glb.sh**

```bash
#!/usr/bin/env bash
# Optimize a GLB file with Draco compression and animation quantization.
# Requires: @gltf-transform/cli (npx gltf-transform)
#
# Usage: ./optimize_glb.sh input.glb output.glb

set -euo pipefail

INPUT="$1"
OUTPUT="$2"

if [ ! -f "$INPUT" ]; then
  echo "ERROR: Input file not found: $INPUT" >&2
  exit 1
fi

npx --yes @gltf-transform/cli optimize \
  "$INPUT" \
  "$OUTPUT" \
  --compress draco \
  --texture-compress webp

echo "SUCCESS: Optimized $INPUT -> $OUTPUT ($(stat -c%s "$OUTPUT") bytes)"
```

- [ ] **Step 2: Make executable and commit**

```bash
chmod +x Assetgenerator/scripts/optimize_glb.sh
git add Assetgenerator/scripts/optimize_glb.sh
git commit -m "feat(assetgen): add GLB optimization script with Draco compression"
```

---

### Task 9: Mixamo adapter

**Files:**
- Create: `Assetgenerator/adapters/mixamo.js`

- [ ] **Step 1: Create mixamo.js adapter**

This adapter follows the existing pattern (see `triposr.js`). It uses Playwright to automate the Mixamo web UI for rigging, and falls back to the Blender Rigify script.

```javascript
// adapters/mixamo.js
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { enqueueJob } from '../worker-manager.js';

const PROJECT_ROOT = new URL('..', import.meta.url).pathname;
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

/**
 * Rig a static GLB model using Blender Rigify (fallback).
 * Mixamo Playwright automation can be added as primary path later.
 */
export async function generate({ id, asset, config, libraryRoot, onProgress }) {
  const phase = asset._currentPhase || 'rig';
  const category = asset.category || 'characters';
  const catConfig = config.categories?.[category] || {};

  if (phase === 'rig') {
    return rigModel({ id, category, libraryRoot, onProgress });
  } else if (phase === 'animate') {
    return animateModel({ id, category, libraryRoot, catConfig, onProgress });
  }

  throw new Error(`Unknown mixamo phase: ${phase}`);
}

async function rigModel({ id, category, libraryRoot, onProgress }) {
  const inputPath = join(libraryRoot, 'models', category, `${id}.glb`);
  const outputDir = join(libraryRoot, 'rigged', category);
  const outputPath = join(outputDir, `${id}.glb`);

  await mkdir(outputDir, { recursive: true });

  if (!existsSync(inputPath)) {
    throw new Error(`Model not found: ${inputPath}`);
  }

  onProgress?.(`Rigging ${id} with Blender Rigify...`);

  const result = await enqueueJob({
    cmd: 'blender',
    args: [
      '--background',
      '--python', join(SCRIPTS_DIR, 'auto_rig.py'),
      '--',
      '--input', inputPath,
      '--output', outputPath,
    ],
    cwd: PROJECT_ROOT,
    env: {},
  });

  if (result.code !== 0) {
    throw new Error(`Rig failed for ${id}: ${result.stderr}`);
  }

  // Optimize with Draco
  const optimizedPath = outputPath.replace('.glb', '_opt.glb');
  await enqueueJob({
    cmd: 'bash',
    args: [join(SCRIPTS_DIR, 'optimize_glb.sh'), outputPath, optimizedPath],
    cwd: PROJECT_ROOT,
    env: {},
  });

  return {
    status: 'done',
    path: `rigged/${category}/${id}.glb`,
    backend: 'mixamo',
  };
}

async function animateModel({ id, category, libraryRoot, catConfig, onProgress }) {
  const riggedPath = join(libraryRoot, 'rigged', category, `${id}.glb`);
  const outputDir = join(libraryRoot, 'animations', category, id);

  await mkdir(outputDir, { recursive: true });

  if (!existsSync(riggedPath)) {
    throw new Error(`Rigged model not found: ${riggedPath}. Run rig phase first.`);
  }

  const clips = catConfig.animationClips || ['idle', 'walk'];
  let completed = 0;

  // Mixamo animation IDs (well-known IDs from Mixamo's library)
  const MIXAMO_CLIP_MAP = {
    idle: '102416070', walk: '102554254', run: '102554232',
    shoot: '102416096', melee: '102416048', throw: '102554244',
    hit_react: '102416024', death: '102554196', victory: '102554268',
    defeat: '102554204', thinking: '102416072', celebrate: '102554188',
    wave: '102554260', clap: '102554192', thumbsup: '102554248',
  };

  for (const clipName of clips) {
    onProgress?.(`Animating ${id}: ${clipName} (${completed + 1}/${clips.length})`);

    const outputPath = join(outputDir, `${clipName}.glb`);

    // Use Blender to bake a basic animation onto the rigged skeleton.
    // This produces a simple procedural animation as a starting point.
    // Mixamo Playwright automation (future enhancement) will replace with higher-quality clips.
    const result = await enqueueJob({
      cmd: 'blender',
      args: [
        '--background',
        '--python', join(SCRIPTS_DIR, 'bake_animation.py'),
        '--',
        '--input', riggedPath,
        '--output', outputPath,
        '--clip', clipName,
      ],
      cwd: PROJECT_ROOT,
      env: {},
    });

    if (result.code !== 0) {
      console.warn(`Animation ${clipName} failed for ${id}: ${result.stderr}`);
    }

    completed++;
  }

  return {
    status: 'done',
    path: `animations/${category}/${id}/`,
    clipCount: clips.length,
    backend: 'mixamo',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/adapters/mixamo.js
git commit -m "feat(assetgen): add mixamo adapter with Rigify rigging and animation scaffold"
```

---

### Task 10: Add rig/animate routes to server.js

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Locate the phase routing in server.js**

Find the `POST /api/visual-library/:id/generate/:phase` handler. The route parameter is `:phase` (accessed as `req.params.phase`). The existing code assigns it to a variable `p`:

```javascript
const p = req.params.phase;  // 'concept' | 'model' | 'render' | 'pack' — currently
```

Then it looks up the adapter:

```javascript
const defaultAdapterMap = { concept: 'comfyui', model: 'triposr', render: 'blender', pack: 'packer' };
const adapterName = (p === 'concept' && asset.conceptBackend) ? asset.conceptBackend : defaultAdapterMap[p];
```

- [ ] **Step 2: Add rig and animate phases to the adapter map**

Modify the `defaultAdapterMap` to include the new phases:

```javascript
const defaultAdapterMap = {
  concept: 'comfyui',
  model: 'triposr',
  rig: 'mixamo',       // NEW
  animate: 'mixamo',   // NEW
  render: 'blender',
  pack: 'packer',
};
```

Then, where the adapter's `generate()` is called (look for `adapter.generate({`), add `_currentPhase: p` to the asset object so the mixamo adapter knows which phase to run:

```javascript
const result = await adapter.generate({
  id: asset.id,
  asset: { ...asset, _currentPhase: p },  // p comes from req.params.phase
  config: vConfig,
  libraryRoot: vConfig.libraryRoot,
  onProgress: (msg) => res.write(`data: ${JSON.stringify({ progress: msg })}\n\n`),
});
```

This is safe because existing adapters (triposr, blender, etc.) ignore the `_currentPhase` field.

- [ ] **Step 3: Test manually**

```bash
# Start Assetgenerator
cd Assetgenerator && node server.js &

# Test rig endpoint (will fail without GPU worker, but should return proper error)
curl -X POST http://localhost:5200/api/visual-library/warrior/generate/rig
```

Expected: SSE stream with error about worker not connected (since no GPU worker running).

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgen): route rig/animate phases to mixamo adapter"
```

---

## Chunk 3: Arena 3D Isometric Renderer (Phase 3)

### Task 11: Add Three.js and shared-3d dependencies to Arena

**Files:**
- Modify: `arena/frontend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd arena/frontend && npm install three@^0.170.0 @types/three@^0.170.0
npm install shared-3d@file:../../shared-infrastructure/shared/3d
```

- [ ] **Step 2: Add prebuild script**

In `arena/frontend/package.json`, add to `scripts`:

```json
"prebuild": "npm --prefix ../../shared-infrastructure/shared/3d run build"
```

- [ ] **Step 3: Verify types resolve**

```bash
cd arena/frontend && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add arena/frontend/package.json arena/frontend/package-lock.json
git commit -m "feat(arena): add three.js and shared-3d dependencies"
```

---

### Task 12: Feature flag in gameStore

**Files:**
- Modify: `arena/frontend/src/stores/gameStore.ts`

- [ ] **Step 1: Add use3DRenderer flag**

In `gameStore.ts`, add to the state interface and initial state:

```typescript
// In interface
use3DRenderer: boolean;
setUse3DRenderer: (value: boolean) => void;

// In create()
use3DRenderer: localStorage.getItem('arena_use3d') === 'true',
setUse3DRenderer: (value) => {
  localStorage.setItem('arena_use3d', value ? 'true' : 'false');
  set({ use3DRenderer: value });
},
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/stores/gameStore.ts
git commit -m "feat(arena): add use3DRenderer feature flag to gameStore"
```

---

### Task 13: GameRenderer3D — core scene manager

**Files:**
- Create: `arena/frontend/src/services/GameRenderer3D.ts`

- [ ] **Step 1: Create GameRenderer3D**

This is the main orchestrator that creates the Three.js scene, camera, renderer, and delegates to sub-renderers.

```typescript
// services/GameRenderer3D.ts
import {
  Scene,
  WebGLRenderer,
  Clock,
  Group,
  PCFSoftShadowMap,
} from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  createIsometricCamera,
  createArenaLighting,
  ModelLoader,
  CharacterManager,
} from 'shared-3d';

const WORLD_SCALE = 1 / 32;

export class GameRenderer3D {
  scene: Scene;
  camera: ReturnType<typeof createIsometricCamera>;
  renderer: WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  clock: Clock;
  loader: ModelLoader;
  characters: CharacterManager;

  // Layer groups
  terrainGroup = new Group();
  coverGroup = new Group();
  itemGroup = new Group();
  projectileGroup = new Group();
  playerGroup = new Group();
  npcGroup = new Group();
  zoneGroup = new Group();

  private container: HTMLElement;
  private animFrameId = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    this.scene = new Scene();

    // Camera
    this.camera = createIsometricCamera({
      viewSize: 22,
      aspect: width / height,
    });

    // WebGL Renderer
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x0a0b1a);
    container.appendChild(this.renderer.domElement);

    // CSS2D Renderer (labels)
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(this.labelRenderer.domElement);

    // Clock
    this.clock = new Clock();

    // Asset loaders
    this.loader = new ModelLoader({ maxCacheSize: 20 });
    this.characters = new CharacterManager(this.loader);

    // Lighting
    const lighting = createArenaLighting();
    for (const light of lighting.lights) {
      this.scene.add(light);
    }

    // Add layer groups
    this.scene.add(this.terrainGroup);
    this.scene.add(this.coverGroup);
    this.scene.add(this.itemGroup);
    this.scene.add(this.projectileGroup);
    this.scene.add(this.playerGroup);
    this.scene.add(this.npcGroup);
    this.scene.add(this.zoneGroup);
  }

  /** Convert server 2D coords to Three.js 3D position */
  static toWorld(x: number, y: number): [number, number, number] {
    return [x * WORLD_SCALE, 0, y * WORLD_SCALE];
  }

  /** Center camera on player */
  updateCamera(playerX: number, playerY: number): void {
    const [wx, , wz] = GameRenderer3D.toWorld(playerX, playerY);
    const d = 22; // view distance
    this.camera.position.set(wx + d, d, wz + d);
    this.camera.lookAt(wx, 0, wz);
    this.camera.updateProjectionMatrix();
  }

  resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    const halfH = 11;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
  }

  render(): void {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    this.characters.dispose();
    this.loader.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
    this.container.removeChild(this.labelRenderer.domElement);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/services/GameRenderer3D.ts
git commit -m "feat(arena): add GameRenderer3D core scene manager"
```

---

### Task 14: TerrainRenderer — isometric tile terrain

**Files:**
- Create: `arena/frontend/src/services/TerrainRenderer.ts`

- [ ] **Step 1: Create TerrainRenderer**

```typescript
// services/TerrainRenderer.ts
import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  BoxGeometry,
  InstancedMesh,
  Matrix4,
  Color,
} from 'three';

const TILE_COLORS = {
  floor: [0x1a3a1a, 0x1e3e1e, 0x1c3c1c, 0x183818],
  wall: 0x2a2a4a,
  path: 0x3a3020,
};

export class TerrainRenderer {
  private group: Group;
  private wallMesh: InstancedMesh | null = null;

  constructor(group: Group) {
    this.group = group;
  }

  build(tiles: number[][], mapW: number, mapH: number): void {
    this.clear();

    // Floor plane
    const floorGeo = new PlaneGeometry(mapW, mapH);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new MeshStandardMaterial({
      color: 0x1a3a1a,
      roughness: 0.9,
    });
    const floor = new Mesh(floorGeo, floorMat);
    floor.position.set(mapW / 2, -0.01, mapH / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls as instanced mesh
    const wallPositions: Matrix4[] = [];
    const wallGeo = new BoxGeometry(1, 1.5, 1);
    const wallMat = new MeshStandardMaterial({
      color: TILE_COLORS.wall,
      roughness: 0.7,
    });

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const tileType = tiles[ty]?.[tx] ?? 0;
        if (tileType === 1) {
          const mat = new Matrix4();
          mat.setPosition(tx + 0.5, 0.75, ty + 0.5);
          wallPositions.push(mat);
        }
      }
    }

    if (wallPositions.length > 0) {
      this.wallMesh = new InstancedMesh(wallGeo, wallMat, wallPositions.length);
      wallPositions.forEach((mat, i) => this.wallMesh!.setMatrixAt(i, mat));
      this.wallMesh.castShadow = true;
      this.wallMesh.receiveShadow = true;
      this.group.add(this.wallMesh);
    }
  }

  clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.wallMesh = null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/services/TerrainRenderer.ts
git commit -m "feat(arena): add TerrainRenderer with instanced walls"
```

---

### Task 15: PlayerRenderer — 3D characters with animation

**Files:**
- Create: `arena/frontend/src/services/PlayerRenderer.ts`

- [ ] **Step 1: Create PlayerRenderer**

```typescript
// services/PlayerRenderer.ts
import { Group, Color, Mesh, TorusGeometry, MeshBasicMaterial } from 'three';
import type { CharacterManager, CharacterInstance } from 'shared-3d';
import { GameRenderer3D } from './GameRenderer3D';

interface PlayerState {
  id: string;
  x: number;
  y: number;
  rotation: number;
  character: string;
  hp: number;
  hasArmor: boolean;
  isAlive: boolean;
  lastMoveDirection?: { dx: number; dy: number };
}

const MODEL_BASE_URL = '/assets/3d/characters/';

export class PlayerRenderer {
  private group: Group;
  private characters: CharacterManager;
  private instances = new Map<string, CharacterInstance>();
  private armorRings = new Map<string, Mesh>();
  private currentAnimations = new Map<string, string>();

  constructor(group: Group, characters: CharacterManager) {
    this.group = group;
    this.characters = characters;
  }

  async update(players: PlayerState[], delta: number): Promise<void> {
    const activeIds = new Set(players.map((p) => p.id));

    // Remove players that left
    for (const [id, instance] of this.instances) {
      if (!activeIds.has(id)) {
        this.group.remove(instance.mesh);
        this.characters.releaseCharacter(instance);
        this.instances.delete(id);

        const ring = this.armorRings.get(id);
        if (ring) {
          this.group.remove(ring);
          this.armorRings.delete(id);
        }
      }
    }

    for (const player of players) {
      if (!player.isAlive) continue;

      let instance = this.instances.get(player.id);

      // Load model if new player
      if (!instance) {
        const charId = player.character || 'warrior';
        const modelUrl = `${MODEL_BASE_URL}${charId}.glb`;
        try {
          instance = await this.characters.getCharacter(charId, modelUrl);
          instance.mesh.scale.setScalar(0.025); // ~0.8 units tall
          this.group.add(instance.mesh);
          this.instances.set(player.id, instance);
          instance.playAnimation('idle', { loop: true });
        } catch {
          continue; // Skip if model unavailable
        }
      }

      // Update position
      const [wx, , wz] = GameRenderer3D.toWorld(player.x, player.y);
      instance.mesh.position.set(wx, 0, wz);

      // Update rotation (Y-axis rotation from server's aim angle)
      instance.mesh.rotation.y = -player.rotation + Math.PI / 2;

      // Update animation state — only switch when animation changes
      const isMoving =
        player.lastMoveDirection &&
        (player.lastMoveDirection.dx !== 0 || player.lastMoveDirection.dy !== 0);
      const targetAnim = isMoving ? 'walk' : 'idle';
      const currentAnim = this.currentAnimations.get(player.id);

      if (targetAnim !== currentAnim) {
        instance.playAnimation(targetAnim, { loop: true, crossFadeDuration: 0.15 });
        this.currentAnimations.set(player.id, targetAnim);
      }

      // Update animation mixer
      instance.update(delta);

      // Armor ring
      if (player.hasArmor && !this.armorRings.has(player.id)) {
        const ringGeo = new TorusGeometry(0.5, 0.05, 8, 32);
        const ringMat = new MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
        const ring = new Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        this.group.add(ring);
        this.armorRings.set(player.id, ring);
      }

      const ring = this.armorRings.get(player.id);
      if (ring) {
        ring.position.set(wx, 0.1, wz);
        ring.visible = player.hasArmor;
      }
    }
  }

  dispose(): void {
    for (const [, instance] of this.instances) {
      this.characters.releaseCharacter(instance);
    }
    this.instances.clear();
    this.armorRings.clear();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/services/PlayerRenderer.ts
git commit -m "feat(arena): add PlayerRenderer with 3D character models and animation"
```

---

### Task 16: Game3D component — wiring it all together

**Files:**
- Create: `arena/frontend/src/components/Game3D.tsx`

- [ ] **Step 1: Create Game3D.tsx**

This component mirrors `Game.tsx` but renders with Three.js. It reuses the same socket events, input handling, and HUD overlay.

```tsx
// components/Game3D.tsx
import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameRenderer3D } from '../services/GameRenderer3D';
import { TerrainRenderer } from '../services/TerrainRenderer';
import { PlayerRenderer } from '../services/PlayerRenderer';
import { useGameStore } from '../stores/gameStore';
import { getSocket } from '../services/apiService';

export default function Game3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer3D | null>(null);
  const terrainRef = useRef<TerrainRenderer | null>(null);
  const playerRendererRef = useRef<PlayerRenderer | null>(null);
  const gameStateRef = useRef<any>(null);
  const navigate = useNavigate();

  const { matchId, playerId } = useGameStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize renderer
    const renderer = new GameRenderer3D(containerRef.current);
    rendererRef.current = renderer;

    const terrain = new TerrainRenderer(renderer.terrainGroup);
    terrainRef.current = terrain;

    const playerRenderer = new PlayerRenderer(renderer.playerGroup, renderer.characters);
    playerRendererRef.current = playerRenderer;

    // Socket listener
    const socket = getSocket();
    let terrainBuilt = false;

    const onGameState = (state: any) => {
      gameStateRef.current = state;

      // Build terrain once
      if (!terrainBuilt && state.map?.tiles) {
        terrain.build(state.map.tiles, state.map.width, state.map.height);
        terrainBuilt = true;
      }
    };

    socket.on('game-state', onGameState);

    // Render loop
    let running = true;
    const animate = () => {
      if (!running) return;
      requestAnimationFrame(animate);

      const delta = renderer.clock.getDelta();
      const state = gameStateRef.current;

      if (state) {
        // Find current player
        const me = state.players?.find((p: any) => p.id === playerId);
        if (me) {
          renderer.updateCamera(me.x, me.y);
        }

        // Update players
        if (state.players && playerRendererRef.current) {
          playerRendererRef.current.update(state.players, delta);
        }
      }

      renderer.render();
    };
    animate();

    // Resize handler
    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);

    // Match end handler
    const onMatchEnd = (data: any) => {
      navigate('/results', { state: data });
    };
    socket.on('match-end', onMatchEnd);

    return () => {
      running = false;
      socket.off('game-state', onGameState);
      socket.off('match-end', onMatchEnd);
      window.removeEventListener('resize', onResize);
      playerRenderer.dispose();
      renderer.dispose();
    };
  }, [matchId, playerId, navigate]);

  // Input handling — identical to Game.tsx (keyboard + touch → socket emit)
  // Reuse the same input loop from Game.tsx lines 118-233
  // This will be extracted to a shared useGameInput() hook during implementation

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* HUD overlay renders on top of Three.js canvas */}
      {/* Reuse existing HUD components (HP, score, minimap, killfeed) */}
    </div>
  );
}
```

- [ ] **Step 2: Wire feature flag in App.tsx**

In `arena/frontend/src/App.tsx`, import both `Game` and `Game3D` and switch based on the feature flag:

```tsx
import Game from './components/Game';
import Game3D from './components/Game3D';
import { useGameStore } from './stores/gameStore';

// In the route for the game:
const GameWrapper = () => {
  const use3D = useGameStore((s) => s.use3DRenderer);
  return use3D ? <Game3D /> : <Game />;
};
```

- [ ] **Step 3: Run existing Arena tests**

```bash
cd arena/frontend && npm run test
```

Expected: All 91 tests still pass (Game3D is new, doesn't break existing Game.tsx).

- [ ] **Step 4: Commit**

```bash
git add arena/frontend/src/components/Game3D.tsx arena/frontend/src/App.tsx
git commit -m "feat(arena): add Game3D component with feature flag toggle"
```

---

### Task 17: Remaining Arena sub-renderers (ProjectileRenderer, CoverRenderer, ItemRenderer, ZoneRenderer, LabelRenderer)

**Files:**
- Create: `arena/frontend/src/services/ProjectileRenderer.ts`
- Create: `arena/frontend/src/services/CoverRenderer.ts`
- Create: `arena/frontend/src/services/ItemRenderer.ts`
- Create: `arena/frontend/src/services/ZoneRenderer.ts`
- Create: `arena/frontend/src/services/LabelRenderer.ts`

These follow the same pattern as PlayerRenderer and TerrainRenderer. Each:
1. Takes a `Group` in the constructor (the appropriate layer group from GameRenderer3D)
2. Has an `update(state, delta)` method called per frame
3. Uses `GameRenderer3D.toWorld()` for coordinate conversion
4. Has a `dispose()` method for cleanup

- [ ] **Step 1: Create ProjectileRenderer.ts**

Each sub-renderer follows the same class pattern: constructor takes a Group, `update(state, delta)` called per frame, `dispose()` for cleanup. The agent implements the full class. Minimum interface:

```typescript
// services/ProjectileRenderer.ts
import { Group, BufferGeometry, LineBasicMaterial, Line, SphereGeometry, MeshBasicMaterial, Mesh } from 'three';
import { GameRenderer3D } from './GameRenderer3D';

interface Projectile { x: number; y: number; velocityX: number; velocityY: number; type?: string; explosionRadius?: number; }

export class ProjectileRenderer {
  private group: Group;
  private meshes: Mesh[] = [];

  constructor(group: Group) { this.group = group; }

  update(projectiles: Projectile[], _delta: number): void {
    // Clear previous frame
    while (this.group.children.length > 0) this.group.remove(this.group.children[0]);

    for (const proj of projectiles) {
      const [wx, , wz] = GameRenderer3D.toWorld(proj.x, proj.y);
      const isGrenade = proj.type === 'grenade' || (proj.explosionRadius && proj.explosionRadius > 0);

      if (isGrenade) {
        const geo = new SphereGeometry(0.15, 8, 8);
        const mat = new MeshBasicMaterial({ color: 0xff8800 });
        const mesh = new Mesh(geo, mat);
        mesh.position.set(wx, 0.3, wz); // slight arc height
        this.group.add(mesh);
      } else {
        // Bullet as short line in direction of velocity
        const angle = Math.atan2(proj.velocityY, proj.velocityX);
        const len = 0.3;
        const geo = new BufferGeometry().setFromPoints([
          new (await import('three')).Vector3(0, 0, 0),
          new (await import('three')).Vector3(Math.cos(angle) * len, 0, Math.sin(angle) * len),
        ]);
        const mat = new LineBasicMaterial({ color: 0xffff00 });
        const line = new Line(geo, mat);
        line.position.set(wx, 0.2, wz);
        this.group.add(line);
      }
    }
  }

  dispose(): void { this.group.clear(); }
}
```

Note: The agent should use proper Vector3 imports (not dynamic). This is a skeleton — refine per the rendering quality needed.

- [ ] **Step 2: Create CoverRenderer.ts**

```typescript
// services/CoverRenderer.ts
import { Group, BoxGeometry, MeshStandardMaterial, Mesh, InstancedMesh, Matrix4 } from 'three';
import { GameRenderer3D } from './GameRenderer3D';

interface CoverObject { x: number; y: number; width: number; height: number; type: string; hp?: number; }

const COVER_COLORS: Record<string, number> = {
  building: 0x4a4a6a, bench: 0x6a5030, fountain: 0x2a4a6a, hedge: 0x2a5a2a, pond: 0x1a2a5a,
};

export class CoverRenderer {
  private group: Group;

  constructor(group: Group) { this.group = group; }

  build(covers: CoverObject[]): void {
    this.group.clear();
    for (const cover of covers) {
      const [wx, , wz] = GameRenderer3D.toWorld(cover.x, cover.y);
      const w = cover.width / 32;
      const h = cover.height / 32;
      const geo = new BoxGeometry(w, 0.8, h);
      const mat = new MeshStandardMaterial({ color: COVER_COLORS[cover.type] || 0x666666, roughness: 0.8 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(wx + w / 2, 0.4, wz + h / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  dispose(): void { this.group.clear(); }
}
```

- [ ] **Step 3: Create ItemRenderer.ts**

```typescript
// services/ItemRenderer.ts
import { Group, BoxGeometry, MeshStandardMaterial, Mesh, Clock } from 'three';
import { GameRenderer3D } from './GameRenderer3D';

interface GameItem { x: number; y: number; type: string; collected?: boolean; }

const ITEM_COLORS: Record<string, number> = {
  health_pack: 0xff4444, armor_plate: 0x4488ff, machine_gun: 0xffcc00, grenade_launcher: 0xff8800,
};

export class ItemRenderer {
  private group: Group;
  private clock = new Clock();

  constructor(group: Group) { this.group = group; }

  update(items: GameItem[]): void {
    this.group.clear();
    const elapsed = this.clock.getElapsedTime();

    for (const item of items) {
      if (item.collected) continue;
      const [wx, , wz] = GameRenderer3D.toWorld(item.x, item.y);
      const bobY = 0.3 + Math.sin(elapsed * 2 + item.x * 0.1) * 0.1;
      const scale = 1 + Math.sin(elapsed * 1.5 + item.y * 0.07) * 0.08;

      const geo = new BoxGeometry(0.3 * scale, 0.3 * scale, 0.3 * scale);
      const mat = new MeshStandardMaterial({
        color: ITEM_COLORS[item.type] || 0xffffff,
        emissive: ITEM_COLORS[item.type] || 0xffffff,
        emissiveIntensity: 0.3 + Math.sin(elapsed * 3) * 0.2,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(wx, bobY, wz);
      this.group.add(mesh);
    }
  }

  dispose(): void { this.group.clear(); }
}
```

- [ ] **Step 4: Create ZoneRenderer.ts**

```typescript
// services/ZoneRenderer.ts
import { Group, Mesh, RingGeometry, MeshBasicMaterial, PlaneGeometry, Clock } from 'three';
import { GameRenderer3D } from './GameRenderer3D';

interface ZoneState { centerX: number; centerY: number; currentRadius: number; isActive: boolean; }

export class ZoneRenderer {
  private group: Group;
  private dangerPlane: Mesh | null = null;
  private borderRing: Mesh | null = null;
  private clock = new Clock();

  constructor(group: Group) { this.group = group; }

  update(zone: ZoneState | undefined, mapW: number, mapH: number): void {
    this.group.clear();
    if (!zone || !zone.isActive) return;

    const [cx, , cz] = GameRenderer3D.toWorld(zone.centerX, zone.centerY);
    const radius = zone.currentRadius / 32;
    const elapsed = this.clock.getElapsedTime();

    // Red overlay outside zone (simplified: large red plane with alpha)
    const planeGeo = new PlaneGeometry(mapW, mapH);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.1 });
    this.dangerPlane = new Mesh(planeGeo, planeMat);
    this.dangerPlane.position.set(mapW / 2, 0.02, mapH / 2);
    this.group.add(this.dangerPlane);

    // Pulsing border ring
    const pulse = 0.6 + Math.sin(elapsed * 3) * 0.2;
    const ringGeo = new RingGeometry(radius - 0.1, radius + 0.1, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: pulse });
    this.borderRing = new Mesh(ringGeo, ringMat);
    this.borderRing.position.set(cx, 0.03, cz);
    this.group.add(this.borderRing);
  }

  dispose(): void { this.group.clear(); }
}
```

- [ ] **Step 5: Create LabelRenderer.ts**

```typescript
// services/LabelRenderer.ts
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Group } from 'three';
import { GameRenderer3D } from './GameRenderer3D';

interface PlayerLabel { id: string; x: number; y: number; username: string; hp: number; isMe: boolean; }

export class LabelRenderer {
  private group: Group;
  private labels = new Map<string, CSS2DObject>();

  constructor(group: Group) { this.group = group; }

  update(players: PlayerLabel[]): void {
    const activeIds = new Set(players.map((p) => p.id));

    // Remove stale labels
    for (const [id, label] of this.labels) {
      if (!activeIds.has(id)) {
        this.group.remove(label);
        this.labels.delete(id);
      }
    }

    for (const player of players) {
      let label = this.labels.get(player.id);

      if (!label) {
        const div = document.createElement('div');
        div.style.cssText = 'color:white;font-size:10px;text-align:center;pointer-events:none;text-shadow:0 0 3px black;';
        label = new CSS2DObject(div);
        this.group.add(label);
        this.labels.set(player.id, label);
      }

      const [wx, , wz] = GameRenderer3D.toWorld(player.x, player.y);
      label.position.set(wx, 1.2, wz); // above character head

      const div = label.element;
      div.style.color = player.isMe ? '#818cf8' : '#ffffff';
      div.textContent = `${player.username}${player.hp > 0 ? ` (${'❤'.repeat(player.hp)})` : ''}`;
    }
  }

  dispose(): void {
    for (const [, label] of this.labels) this.group.remove(label);
    this.labels.clear();
  }
}
```

- [ ] **Step 6: Wire all sub-renderers into Game3D.tsx and add input handling**

In Game3D.tsx's `useEffect`, initialize all sub-renderers and wire the game input loop. The input handling is extracted verbatim from Game.tsx lines 118-233 (keyboard + touch → socket emit pattern):

```tsx
// After initializing renderer, terrain, playerRenderer:
const coverRenderer = new CoverRenderer(renderer.coverGroup);
const itemRenderer = new ItemRenderer(renderer.itemGroup);
const projectileRenderer = new ProjectileRenderer(renderer.projectileGroup);
const zoneRenderer = new ZoneRenderer(renderer.zoneGroup);
const labelRenderer = new LabelRenderer(renderer.scene); // labels added to scene root for CSS2D

// In the animate loop, after playerRenderer.update():
if (state.items) itemRenderer.update(state.items);
if (state.projectiles) projectileRenderer.update(state.projectiles, delta);
if (state.zone) zoneRenderer.update(state.zone, state.map?.width || 28, state.map?.height || 22);
if (state.players) labelRenderer.update(state.players.map((p: any) => ({ ...p, isMe: p.id === playerId })));

// Cover is built once (like terrain):
if (!coverBuilt && state.map?.coverObjects) {
  coverRenderer.build(state.map.coverObjects);
  coverBuilt = true;
}
```

For input handling, copy the `inputLoop` interval from Game.tsx (lines 118-233) into the Game3D `useEffect`. This is the same code — keyboard event listeners, touch joystick handlers, and the 50ms `setInterval` that emits `player-input` via socket. No changes needed since input is screen-space and independent of the renderer.

For the HUD overlay, render existing React HUD components as a positioned div over the canvas:

```tsx
return (
  <div ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'relative' }}>
    {/* Three.js canvas is appended by GameRenderer3D */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none', zIndex: 10 }}>
      {/* Reuse: killfeed, round indicator, HP display, weapon display from Game.tsx */}
      {/* These are pure React components reading from gameStore — no renderer dependency */}
    </div>
  </div>
);
```

- [ ] **Step 7: Run tests**

```bash
cd arena/frontend && npm run test && npm run typecheck
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add arena/frontend/src/services/
git commit -m "feat(arena): add projectile, cover, item, zone, and label sub-renderers"
```

---

## Chunk 4: L2P 3D Character Scenes (Phase 4)

### Task 18: Add Three.js + R3F dependencies to L2P

**Files:**
- Modify: `l2p/frontend/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd l2p/frontend && npm install three@^0.170.0 @react-three/fiber@^9 @react-three/drei@^9 @types/three@^0.170.0
npm install shared-3d@file:../../shared-infrastructure/shared/3d
```

- [ ] **Step 2: Add prebuild script**

In `l2p/frontend/package.json`, add to `scripts`:

```json
"prebuild": "npm --prefix ../../shared-infrastructure/shared/3d run build"
```

- [ ] **Step 3: Verify types resolve**

```bash
cd l2p/frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add l2p/frontend/package.json l2p/frontend/package-lock.json
git commit -m "feat(l2p): add three.js, react-three-fiber, and shared-3d dependencies"
```

---

### Task 19: CharacterCanvas — shared canvas wrapper

**Files:**
- Create: `l2p/frontend/src/components/3d/CharacterCanvas.tsx`

- [ ] **Step 1: Create CharacterCanvas.tsx**

Shared canvas wrapper used by all L2P 3D scenes. Handles mobile detection and fallback.

```tsx
// components/3d/CharacterCanvas.tsx
import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';

interface CharacterCanvasProps {
  children: ReactNode;
  width?: number | string;
  height?: number | string;
  fallback?: ReactNode;
}

export function CharacterCanvas({
  children,
  width = 200,
  height = 250,
  fallback,
}: CharacterCanvasProps) {
  // Disable 3D on very small screens
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
  if (isMobile && fallback) return <>{fallback}</>;

  const canvasWidth = isMobile ? 150 : width;
  const canvasHeight = isMobile ? 200 : height;

  return (
    <div style={{ width: canvasWidth, height: canvasHeight }}>
      <Canvas
        shadows={!isMobile}
        dpr={Math.min(window.devicePixelRatio, 2)}
        gl={{ antialias: true, alpha: true }}
        frameloop="always"
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add l2p/frontend/src/components/3d/CharacterCanvas.tsx
git commit -m "feat(l2p): add CharacterCanvas wrapper with mobile fallback"
```

---

### Task 20: QuizCharacterScene — character reacts to answers

**Files:**
- Create: `l2p/frontend/src/components/3d/QuizCharacterScene.tsx`
- Modify: `l2p/frontend/src/pages/GamePage.tsx`

- [ ] **Step 1: Create QuizCharacterScene.tsx**

```tsx
// components/3d/QuizCharacterScene.tsx
import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, LoopRepeat, LoopOnce, type Group } from 'three';
import { createQuizLighting } from 'shared-3d';

interface QuizCharacterSceneProps {
  characterId: string;
  animation?: 'idle' | 'thinking' | 'victory' | 'hit_react' | 'celebrate';
  characterColor?: string;
}

const MODEL_BASE = '/assets/3d/characters/';

export function QuizCharacterScene({
  characterId,
  animation = 'idle',
  characterColor = '#00f2ff',
}: QuizCharacterSceneProps) {
  const gltf = useLoader(GLTFLoader, `${MODEL_BASE}${characterId}.glb`);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const modelRef = useRef<Group>(null);

  // Setup animation mixer
  useEffect(() => {
    if (!gltf.scene) return;
    const mixer = new AnimationMixer(gltf.scene);
    mixerRef.current = mixer;

    // Play initial animation
    const clip = gltf.animations.find((c) => c.name === animation);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.setLoop(animation === 'idle' || animation === 'thinking' ? LoopRepeat : LoopOnce, Infinity);
      action.play();
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [gltf, animation]);

  // Update mixer each frame
  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  // Lighting
  const lighting = useMemo(() => createQuizLighting(characterColor), [characterColor]);

  return (
    <>
      {lighting.lights.map((light, i) => (
        <primitive key={i} object={light} />
      ))}
      <primitive
        ref={modelRef}
        object={gltf.scene}
        scale={1.5}
        position={[0, -1, 0]}
        rotation={[0, Math.PI * 0.1, 0]}
      />
    </>
  );
}
```

- [ ] **Step 2: Integrate into GamePage.tsx**

In `l2p/frontend/src/pages/GamePage.tsx`, add the quiz character scene alongside the question card.

Find the left pane JSX (where the question card renders) and add:

```tsx
import { CharacterCanvas } from '../components/3d/CharacterCanvas';
import { QuizCharacterScene } from '../components/3d/QuizCharacterScene';
import { CharacterDisplay } from '../components/CharacterDisplay';

// Inside the left pane, after the question card:
<CharacterCanvas
  width={200}
  height={250}
  fallback={<CharacterDisplay character={currentCharacter} size="medium" />}
>
  <QuizCharacterScene
    characterId={currentCharacter?.id || 'student'}
    animation={answerFlash === 'correct' ? 'victory' : answerFlash === 'wrong' ? 'hit_react' : 'idle'}
    characterColor={currentCharacter?.color}
  />
</CharacterCanvas>
```

- [ ] **Step 3: Run L2P frontend tests**

```bash
cd l2p/frontend && npm run test
```

Expected: Existing tests pass (new components don't break existing).

- [ ] **Step 4: Commit**

```bash
git add l2p/frontend/src/components/3d/QuizCharacterScene.tsx l2p/frontend/src/pages/GamePage.tsx
git commit -m "feat(l2p): add QuizCharacterScene with answer reaction animations"
```

---

### Task 21: LobbyRoomScene — players in a virtual room

**Files:**
- Create: `l2p/frontend/src/components/3d/LobbyRoomScene.tsx`
- Modify: `l2p/frontend/src/pages/LobbyPage.tsx`

- [ ] **Step 1: Create LobbyRoomScene.tsx**

Arranges player characters in a semicircle. Host gets center position with spotlight.

```tsx
// components/3d/LobbyRoomScene.tsx
import { useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, LoopRepeat, type Group } from 'three';
import { createLobbyLighting } from 'shared-3d';
import type { Player } from '@/types';

const MODEL_BASE = '/assets/3d/characters/';

interface LobbyRoomSceneProps {
  players: Player[];
  hostId: string;
}

function LobbyCharacter({
  player,
  position,
  isHost,
}: {
  player: Player;
  position: [number, number, number];
  isHost: boolean;
}) {
  const charId = player.character || 'student';
  const gltf = useLoader(GLTFLoader, `${MODEL_BASE}${charId}.glb`);

  // Clone with SkeletonUtils for independent skeleton per player
  const clonedScene = useMemo(() => {
    const { SkeletonUtils } = require('three/addons/utils/SkeletonUtils.js');
    return SkeletonUtils.clone(gltf.scene);
  }, [gltf]);

  const mixer = useMemo(() => {
    const m = new AnimationMixer(clonedScene);
    const idle = gltf.animations.find((c) => c.name === 'idle');
    if (idle) {
      m.clipAction(idle).setLoop(LoopRepeat, Infinity).play();
    }
    return m;
  }, [clonedScene, gltf.animations]);

  useFrame((_, delta) => mixer.update(delta));

  return (
    <group position={position}>
      <primitive object={clonedScene} scale={1.2} />
      {isHost && <pointLight position={[0, 3, 0]} intensity={1} color="#ffd700" distance={5} />}
    </group>
  );
}

export function LobbyRoomScene({ players, hostId }: LobbyRoomSceneProps) {
  const lighting = useMemo(() => createLobbyLighting(), []);

  // Arrange in semicircle
  const positions = useMemo(() => {
    const radius = 3;
    return players.map((_, i) => {
      const angle = Math.PI * (0.2 + (0.6 * i) / Math.max(players.length - 1, 1));
      return [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ] as [number, number, number];
    });
  }, [players.length]);

  return (
    <>
      {lighting.lights.map((light, i) => (
        <primitive key={`light-${i}`} object={light} />
      ))}
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial color="#1a1e3a" />
      </mesh>
      {/* Characters */}
      {players.map((player, i) => (
        <LobbyCharacter
          key={player.id}
          player={player}
          position={positions[i]}
          isHost={player.id === hostId}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Integrate into LobbyPage.tsx**

Add the 3D lobby room above or instead of the current PlayerGrid in `LobbyPage.tsx`.

- [ ] **Step 3: Commit**

```bash
git add l2p/frontend/src/components/3d/LobbyRoomScene.tsx l2p/frontend/src/pages/LobbyPage.tsx
git commit -m "feat(l2p): add LobbyRoomScene with semicircle arrangement and host spotlight"
```

---

### Task 22: PodiumScene — results podium with victory animations

**Files:**
- Create: `l2p/frontend/src/components/3d/PodiumScene.tsx`
- Modify: `l2p/frontend/src/pages/ResultsPage.tsx`

- [ ] **Step 1: Create PodiumScene.tsx**

Classic 3-tier podium with winner celebration.

```tsx
// components/3d/PodiumScene.tsx
import { useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three';
import type { Player } from '@/types';

const MODEL_BASE = '/assets/3d/characters/';

const PODIUM_POSITIONS: [number, number, number][] = [
  [0, 1.5, 0],     // 1st place (center, tallest)
  [-1.8, 1.0, 0],  // 2nd place (left)
  [1.8, 0.6, 0],   // 3rd place (right)
];

const PODIUM_HEIGHTS = [1.5, 1.0, 0.6];
const PODIUM_COLORS = [0xffd700, 0xc0c0c0, 0xcd7f32]; // gold, silver, bronze

function PodiumCharacter({ characterId, position, animation }: {
  characterId: string;
  position: [number, number, number];
  animation: string;
}) {
  const gltf = useLoader(GLTFLoader, `${MODEL_BASE}${characterId}.glb`);
  const clonedScene = useMemo(() => {
    // Use SkeletonUtils for proper skinned mesh cloning
    const { SkeletonUtils } = require('three/addons/utils/SkeletonUtils.js');
    return SkeletonUtils.clone(gltf.scene);
  }, [gltf]);

  const mixer = useMemo(() => {
    const m = new AnimationMixer(clonedScene);
    const clip = gltf.animations.find((c: any) => c.name === animation);
    if (clip) m.clipAction(clip).setLoop(animation === 'victory' ? LoopRepeat : LoopOnce, Infinity).play();
    return m;
  }, [clonedScene, animation, gltf.animations]);

  useFrame((_, delta) => mixer.update(delta));

  return <primitive object={clonedScene} position={position} scale={1.2} />;
}

interface PodiumSceneProps {
  winners: Player[];
}

function PodiumBlock({ position, height, color }: { position: [number, number, number]; height: number; color: number }) {
  return (
    <mesh position={[position[0], height / 2, position[2]]} castShadow receiveShadow>
      <boxGeometry args={[1.2, height, 1.2]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
    </mesh>
  );
}

export function PodiumScene({ winners }: PodiumSceneProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 5, -3]} intensity={0.4} color="#e0f0ff" />

      {/* Podium blocks */}
      {PODIUM_POSITIONS.map((pos, i) => (
        <PodiumBlock key={i} position={pos} height={PODIUM_HEIGHTS[i]} color={PODIUM_COLORS[i]} />
      ))}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#0a0e27" />
      </mesh>

      {/* Winner characters on podiums */}
      {winners.slice(0, 3).map((player, i) => {
        const charId = player.character || 'student';
        const anims = ['victory', 'clap', 'wave'];
        return (
          <PodiumCharacter
            key={player.id}
            characterId={charId}
            position={[PODIUM_POSITIONS[i][0], PODIUM_HEIGHTS[i], PODIUM_POSITIONS[i][2]]}
            animation={anims[i]}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Integrate into ResultsPage.tsx**

Replace the WinnerAnnouncement section with the podium scene.

- [ ] **Step 3: Commit**

```bash
git add l2p/frontend/src/components/3d/PodiumScene.tsx l2p/frontend/src/pages/ResultsPage.tsx
git commit -m "feat(l2p): add PodiumScene with 3-tier victory podium"
```

---

### Task 23: DuelArenaScene — 1v1 face-off

**Files:**
- Create: `l2p/frontend/src/components/3d/DuelArenaScene.tsx`
- Modify: `l2p/frontend/src/components/DuelView.tsx`

- [ ] **Step 1: Create DuelArenaScene.tsx**

Two characters facing each other with dramatic lighting.

```tsx
// components/3d/DuelArenaScene.tsx
import { useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationMixer, LoopRepeat } from 'three';
import type { Player } from '@/types';

const MODEL_BASE = '/assets/3d/characters/';

interface DuelArenaSceneProps {
  player1: Player;
  player2: Player;
  winner?: string | null;
}

function DuelCharacter({ characterId, position, rotation, animation }: {
  characterId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  animation: string;
}) {
  const gltf = useLoader(GLTFLoader, `${MODEL_BASE}${characterId}.glb`);
  const clonedScene = useMemo(() => {
    const { SkeletonUtils } = require('three/addons/utils/SkeletonUtils.js');
    return SkeletonUtils.clone(gltf.scene);
  }, [gltf]);

  const mixer = useMemo(() => {
    const m = new AnimationMixer(clonedScene);
    const clip = gltf.animations.find((c: any) => c.name === animation);
    if (clip) m.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
    return m;
  }, [clonedScene, animation, gltf.animations]);

  useFrame((_, delta) => mixer.update(delta));

  return <primitive object={clonedScene} position={position} rotation={rotation} scale={1.2} />;
}

export function DuelArenaScene({ player1, player2, winner }: DuelArenaSceneProps) {
  return (
    <>
      <ambientLight intensity={0.3} />
      {/* Spotlight on player 1 */}
      <spotLight
        position={[-2, 4, 2]}
        angle={0.5}
        penumbra={0.5}
        intensity={winner === player1.id ? 2 : 0.8}
        color={winner === player1.id ? '#ffd700' : '#ffffff'}
      />
      {/* Spotlight on player 2 */}
      <spotLight
        position={[2, 4, 2]}
        angle={0.5}
        penumbra={0.5}
        intensity={winner === player2.id ? 2 : 0.8}
        color={winner === player2.id ? '#ffd700' : '#ffffff'}
      />

      {/* Arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#1a1e3a" />
      </mesh>

      {/* Player 1 — left side, facing right */}
      <DuelCharacter
        characterId={player1.character || 'student'}
        position={[-1.5, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        animation={winner === player1.id ? 'victory' : winner ? 'defeat' : 'idle'}
      />
      {/* Player 2 — right side, facing left */}
      <DuelCharacter
        characterId={player2.character || 'student'}
        position={[1.5, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        animation={winner === player2.id ? 'victory' : winner ? 'defeat' : 'idle'}
      />
    </>
  );
}
```

- [ ] **Step 2: Integrate into DuelView.tsx**

Replace the VS text divider in `l2p/frontend/src/components/DuelView.tsx` with the 3D arena scene.

- [ ] **Step 3: Commit**

```bash
git add l2p/frontend/src/components/3d/DuelArenaScene.tsx l2p/frontend/src/components/DuelView.tsx
git commit -m "feat(l2p): add DuelArenaScene with face-off spotlight"
```

---

## Chunk 5: Shared Character Selector (Phase 5)

### Task 24: Update avatarService with model paths

**Files:**
- Modify: `l2p/frontend/src/services/avatarService.ts`
- Modify: `l2p/frontend/src/types/index.ts`

- [ ] **Step 1: Add modelPath to Character type**

In `l2p/frontend/src/types/index.ts`, add to the `Character` interface:

```typescript
export interface Character {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockLevel: number;
  modelPath?: string;  // NEW: path to GLB model
}
```

- [ ] **Step 2: Add getAvatarModelPath() to avatarService**

In `l2p/frontend/src/services/avatarService.ts`, add:

```typescript
getAvatarModelPath(userCharacter?: string): string | null {
  const charId = userCharacter || this.activeCharacterId;
  if (!charId) return null;
  return `/assets/3d/characters/${charId}.glb`;
}
```

- [ ] **Step 3: Commit**

```bash
git add l2p/frontend/src/types/index.ts l2p/frontend/src/services/avatarService.ts
git commit -m "feat(l2p): add modelPath to Character type and avatarService"
```

---

### Task 25: CharacterViewer shared component

**Files:**
- Create: `shared-infrastructure/shared/3d/src/viewer.ts`

- [ ] **Step 1: Create viewer.ts**

Exports a factory function for creating a character viewer scene (orbit controls, emote buttons, skin switching). This is vanilla Three.js so both Arena and L2P can use it.

```typescript
// src/viewer.ts
import { Scene, PerspectiveCamera, WebGLRenderer, Clock, Color } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ModelLoader } from './loader';
import { AnimationController } from './animator';
import { createQuizLighting } from './lighting';
import type { CharacterDefinition } from './types';

export interface CharacterViewer {
  mount: (container: HTMLElement) => void;
  loadCharacter: (definition: CharacterDefinition) => Promise<void>;
  playAnimation: (name: string) => void;
  resize: () => void;
  dispose: () => void;
}

export function createCharacterViewer(loader: ModelLoader): CharacterViewer {
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.set(0, 1.2, 3);

  let renderer: WebGLRenderer | null = null;
  let controls: OrbitControls | null = null;
  let controller: AnimationController | null = null;
  let container: HTMLElement | null = null;
  const clock = new Clock();
  let animFrameId = 0;

  const lighting = createQuizLighting();

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controller?.update(delta);
    controls?.update();
    renderer?.render(scene, camera);
  }

  return {
    mount(el: HTMLElement) {
      container = el;
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1;
      controls.target.set(0, 0.8, 0);

      for (const light of lighting.lights) scene.add(light);

      animate();
    },

    async loadCharacter(def: CharacterDefinition) {
      // Remove old model
      const old = scene.getObjectByName('character');
      if (old) scene.remove(old);
      controller?.dispose();

      const result = await loader.load(def.modelPath);
      const model = result.scene.clone();
      model.name = 'character';
      scene.add(model);

      controller = new AnimationController(model, result.animations);
      controller.play('idle', { loop: true });
    },

    playAnimation(name: string) {
      controller?.playOnce(name);
    },

    resize() {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },

    dispose() {
      cancelAnimationFrame(animFrameId);
      controller?.dispose();
      controls?.dispose();
      renderer?.dispose();
      if (container && renderer) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
```

- [ ] **Step 2: Export from index.ts**

Add to `shared-infrastructure/shared/3d/src/index.ts`:

```typescript
export { createCharacterViewer, type CharacterViewer } from './viewer';
```

- [ ] **Step 3: Build shared-3d**

```bash
cd shared-infrastructure/shared/3d && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add shared-infrastructure/shared/3d/src/viewer.ts shared-infrastructure/shared/3d/src/index.ts
git commit -m "feat(shared-3d): add CharacterViewer with orbit controls and animation preview"
```

---

### Task 26: Arena CharacterPicker3D

**Files:**
- Create: `arena/frontend/src/components/CharacterPicker3D.tsx`

- [ ] **Step 1: Create CharacterPicker3D.tsx**

Wraps the shared `createCharacterViewer` in a React component for the Arena lobby.

```tsx
// components/CharacterPicker3D.tsx
import { useEffect, useRef, useCallback } from 'react';
import { createCharacterViewer, ModelLoader, type CharacterViewer } from 'shared-3d';

// Arena characters (different from L2P's academic characters)
const CHARACTERS = [
  { id: 'warrior', name: 'Warrior', color: '#00f2ff' },
  { id: 'rogue', name: 'Rogue', color: '#3eff8b' },
  { id: 'mage', name: 'Mage', color: '#bc13fe' },
  { id: 'tank', name: 'Tank', color: '#ffd700' },
];

interface CharacterPicker3DProps {
  selected: string;
  onSelect: (characterId: string) => void;
}

export function CharacterPicker3D({ selected, onSelect }: CharacterPicker3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CharacterViewer | null>(null);
  const loaderRef = useRef(new ModelLoader({ maxCacheSize: 10 }));

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = createCharacterViewer(loaderRef.current);
    viewer.mount(containerRef.current);
    viewerRef.current = viewer;

    return () => viewer.dispose();
  }, []);

  useEffect(() => {
    viewerRef.current?.loadCharacter({
      id: selected,
      modelPath: `/assets/3d/characters/${selected}.glb`,
      animations: {},
      color: CHARACTERS.find((c) => c.id === selected)?.color || '#00f2ff',
    });
  }, [selected]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width: 300, height: 350, borderRadius: 12, overflow: 'hidden' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
        {CHARACTERS.map((char) => (
          <button
            key={char.id}
            onClick={() => onSelect(char.id)}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: selected === char.id ? `3px solid ${char.color}` : '2px solid #333',
              background: char.color + '33',
              cursor: 'pointer',
            }}
            title={char.name}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add arena/frontend/src/components/CharacterPicker3D.tsx
git commit -m "feat(arena): add CharacterPicker3D with shared viewer"
```

---

### Task 27: L2P CharacterSelector3D

**Files:**
- Create: `l2p/frontend/src/components/CharacterSelector3D.tsx`

- [ ] **Step 1: Create CharacterSelector3D.tsx**

R3F-based character selector for the L2P profile page. Uses the shared viewer pattern with React wrapper.

```tsx
// components/CharacterSelector3D.tsx
import { useEffect, useRef } from 'react';
import { createCharacterViewer, ModelLoader, type CharacterViewer } from 'shared-3d';
import { useCharacterStore } from '@/stores/characterStore';

export function CharacterSelector3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CharacterViewer | null>(null);
  const loaderRef = useRef(new ModelLoader({ maxCacheSize: 10 }));
  const { currentCharacter, availableCharacters, updateCharacter } = useCharacterStore();

  useEffect(() => {
    if (!containerRef.current) return;
    const viewer = createCharacterViewer(loaderRef.current);
    viewer.mount(containerRef.current);
    viewerRef.current = viewer;

    return () => viewer.dispose();
  }, []);

  useEffect(() => {
    if (!currentCharacter) return;
    viewerRef.current?.loadCharacter({
      id: currentCharacter.id,
      modelPath: `/assets/3d/characters/${currentCharacter.id}.glb`,
      animations: {},
      color: '#00f2ff',
    });
  }, [currentCharacter]);

  const handleSelect = async (charId: string) => {
    await updateCharacter(charId);
  };

  return (
    <div>
      <div
        ref={containerRef}
        style={{ width: 300, height: 350, borderRadius: 12, overflow: 'hidden', margin: '0 auto' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
        {availableCharacters.map((char) => (
          <button
            key={char.id}
            onClick={() => handleSelect(char.id)}
            style={{
              padding: '8px',
              border: currentCharacter?.id === char.id ? '2px solid #00f2ff' : '1px solid #333',
              borderRadius: 8,
              background: currentCharacter?.id === char.id ? 'rgba(0,242,255,0.1)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {char.emoji} {char.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add l2p/frontend/src/components/CharacterSelector3D.tsx
git commit -m "feat(l2p): add CharacterSelector3D with shared viewer"
```

---

### Task 28: Asset delivery — Vite proxy and nginx config

**Files:**
- Modify: `arena/frontend/vite.config.ts`
- Modify: `l2p/frontend/vite.config.ts`

- [ ] **Step 1: Add /assets/3d proxy to Arena vite.config.ts**

Use a Vite proxy to the Assetgenerator (which already serves GLBs at `/api/visual-library/:id/model`):

```typescript
// In the server.proxy section of vite.config.ts, add:
'/assets/3d': {
  target: 'http://localhost:5200',
  rewrite: (path) => {
    // /assets/3d/characters/warrior.glb → /api/visual-library/warrior/model
    const match = path.match(/\/assets\/3d\/\w+\/(\w+)\.glb/);
    return match ? `/api/visual-library/${match[1]}/model` : path;
  },
}
```

- [ ] **Step 2: Add same proxy to L2P vite.config.ts**

Add identical proxy configuration to `l2p/frontend/vite.config.ts` in its server.proxy section.

- [ ] **Step 3: Add nginx config for production**

Create a `location` block for the Arena and L2P nginx configs (in their respective Dockerfiles or nginx.conf). Both frontends serve GLBs from the same NAS mount:

```nginx
# Add to arena/frontend/nginx.conf and l2p/frontend/nginx.conf:
location /assets/3d/ {
    alias /mnt/pve3a/visual-library/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin *;
}
```

The k8s deployment needs a SMB-CSI volume mount for `/mnt/pve3a/visual-library/` in the frontend pods (same pattern as the Assetgenerator pod).

- [ ] **Step 3: Commit**

```bash
git add arena/frontend/vite.config.ts l2p/frontend/vite.config.ts
git commit -m "feat: add /assets/3d proxy for 3D model serving in dev"
```

---

### Task 29: Final integration test

- [ ] **Step 1: Run all test suites**

```bash
# shared-3d
cd shared-infrastructure/shared/3d && npm run test

# Arena
cd arena/frontend && npm run test && npm run typecheck

# L2P
cd l2p/frontend && npm run test && npm run typecheck
```

Expected: All pass.

- [ ] **Step 2: Verify shared-3d builds**

```bash
cd shared-infrastructure/shared/3d && npm run build && ls dist/
```

Expected: `index.js`, `index.d.ts` present.

- [ ] **Step 3: Commit any remaining changes**

```bash
# Stage only the specific files that changed during integration testing
git status
# Add only relevant files by name (no git add -A)
git commit -m "chore: verify all test suites pass with 3D integration"
```
