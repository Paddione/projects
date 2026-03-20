# Arena 3D VFX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add combat VFX, environmental atmosphere, post-processing, and quality settings to the Arena Three.js 3D renderer.

**Architecture:** A central `VFXManager` coordinates all particle effects, screen shake, and damage numbers. Each effect type is an isolated class that manages its own Three.js objects and lifecycle. A `QualitySettings` singleton controls particle counts, post-processing passes, and render resolution across three tiers (High/Medium/Low). `PostProcessing` wraps Three.js `EffectComposer` and replaces the direct `renderer.render()` call.

**Tech Stack:** Three.js 0.170.0 (already installed), raw `Points`/`Mesh`/`Sprite` for particles (no external library), `EffectComposer` + `UnrealBloomPass` from `three/addons`, CSS2DObject for damage numbers, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-03-20-arena-3d-vfx-upgrade-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `arena/frontend/src/services/VFXManager.ts` | Central effect coordinator — owns `effectGroup`, ticks all active effects, spawns new effects, manages screen shake |
| `arena/frontend/src/services/effects/ImpactEffect.ts` | Bullet hit sparks: 4-12 `Points` particles, 300ms lifetime, yellow emissive |
| `arena/frontend/src/services/effects/ExplosionEffect.ts` | Grenade detonation: expanding torus shockwave + 8-30 debris particles + point light flash, 600ms |
| `arena/frontend/src/services/effects/MuzzleFlashEffect.ts` | Weapon fire: billboard `Sprite` flash + 4-6 spark points, 80-120ms |
| `arena/frontend/src/services/effects/ScreenShake.ts` | Camera displacement: sine decay (hit) or random jitter (explosion), returns `Vector3` offset |
| `arena/frontend/src/services/effects/DeathEffect.ts` | Player death dissolve: material flash + 8-20 rising particles in character color, 600ms |
| `arena/frontend/src/services/effects/AtmosphereEffect.ts` | Dust motes (Points), fog setup (FogExp2), grid floor replacement (LineSegments) |
| `arena/frontend/src/services/effects/DamageNumber.ts` | Floating combat text: CSS2DObject, floats up 1.5 units over 800ms, color-coded |
| `arena/frontend/src/services/PostProcessing.ts` | EffectComposer wrapper: RenderPass + UnrealBloomPass + Vignette + ChromaticAberration |
| `arena/frontend/src/services/QualitySettings.ts` | Singleton with `current` property exposing all tier-dependent values, auto-detection + localStorage |
| `arena/frontend/src/components/SettingsPanel.tsx` | Quality preset dropdown, lobby + in-game gear icon |

### New Test Files

| File | Tests |
|------|-------|
| `arena/frontend/src/services/effects/ImpactEffect.test.ts` | Particle creation, lifecycle, disposal |
| `arena/frontend/src/services/effects/ExplosionEffect.test.ts` | Shockwave + particles + light, lifecycle |
| `arena/frontend/src/services/effects/MuzzleFlashEffect.test.ts` | Billboard + sparks, short lifetime |
| `arena/frontend/src/services/effects/ScreenShake.test.ts` | Displacement values, decay timing |
| `arena/frontend/src/services/effects/DeathEffect.test.ts` | Dissolve phases, color tinting |
| `arena/frontend/src/services/effects/AtmosphereEffect.test.ts` | Dust particles, fog setup |
| `arena/frontend/src/services/effects/DamageNumber.test.ts` | CSS2D creation, float/fade, disposal |
| `arena/frontend/src/services/VFXManager.test.ts` | Effect spawning, update loop, disposal |
| `arena/frontend/src/services/QualitySettings.test.ts` | Tier detection, localStorage, manual override |
| `arena/frontend/src/services/PostProcessing.test.ts` | Pass setup, enable/disable, resize |

### Modified Files

| File | Changes |
|------|---------|
| `arena/frontend/src/services/GameRenderer3D.ts` | Add `effectGroup`, `applyCameraShake()`, FogExp2 (Wave 2), replace `render()` with PostProcessing (Wave 3) |
| `arena/frontend/src/services/ProjectileRenderer.ts` | Accept `onRemoved`/`onCreated` callbacks |
| `arena/frontend/src/services/PlayerRenderer.ts` | Accept `onPlayerDeath` callback |
| `arena/frontend/src/hooks/useGameSockets.ts` | Add `explosion` listener, accept `player-hit` payload, accept VFX callbacks |
| `arena/frontend/src/components/Game3D.tsx` | Instantiate VFXManager, wire callbacks, call `vfxManager.update(delta)` |
| `arena/backend/src/services/GameService.ts` | Add `x, y` to `onPlayerHit` emissions (3 call sites) |
| `arena/backend/src/types/game.ts` | Add `x, y` to `player-hit` type |

---

## Wave 1: Combat Juice

### Task 1: VFXManager Foundation

**Files:**
- Create: `arena/frontend/src/services/VFXManager.ts`
- Create: `arena/frontend/src/services/VFXManager.test.ts`
- Modify: `arena/frontend/src/services/GameRenderer3D.ts:82-99`

- [ ] **Step 1: Write VFXManager test**

```typescript
// arena/frontend/src/services/VFXManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Group, Scene, Vector3 } from 'three';

// Mock Three.js minimally — VFXManager just manages a Group and effect list
vi.mock('three', async () => {
    const actual = await vi.importActual('three');
    return actual;
});

import { VFXManager } from './VFXManager';

describe('VFXManager', () => {
    let scene: Scene;
    let vfx: VFXManager;

    beforeEach(() => {
        scene = new Scene();
        vfx = new VFXManager(scene);
    });

    it('adds effectGroup to scene on construction', () => {
        expect(scene.children).toHaveLength(1);
        expect(scene.children[0]).toBeInstanceOf(Group);
    });

    it('update with no active effects does not throw', () => {
        expect(() => vfx.update(0.016)).not.toThrow();
    });

    it('dispose removes effectGroup from scene', () => {
        vfx.dispose();
        expect(scene.children).toHaveLength(0);
    });

    it('getShakeOffset returns zero vector when no shake active', () => {
        const offset = vfx.getShakeOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
        expect(offset.z).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/services/VFXManager.test.ts`
Expected: FAIL — `Cannot find module './VFXManager'`

- [ ] **Step 3: Write VFXManager implementation**

```typescript
// arena/frontend/src/services/VFXManager.ts
import { Group, Scene, Vector3 } from 'three';

/** Base interface for all VFX effects. */
export interface VFXEffect {
    /** Returns true while effect is alive. */
    update(delta: number): boolean;
    dispose(): void;
}

const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
/** Temporary quality scale — replaced by QualitySettings in Wave 3. */
export const PARTICLE_SCALE = isMobile ? 0.5 : 1.0;

export class VFXManager {
    readonly effectGroup: Group;
    private readonly scene: Scene;
    private readonly effects: Set<VFXEffect> = new Set();
    private readonly shakeOffset = new Vector3();
    private shakeIntensity = 0;
    private shakeDuration = 0;
    private shakeElapsed = 0;
    private shakeType: 'sine' | 'jitter' = 'sine';

    constructor(scene: Scene) {
        this.scene = scene;
        this.effectGroup = new Group();
        this.effectGroup.name = 'vfx-effects';
        this.scene.add(this.effectGroup);
    }

    /** Tick all active effects and screen shake. */
    update(delta: number): void {
        // Update effects, remove dead ones
        for (const effect of this.effects) {
            const alive = effect.update(delta);
            if (!alive) {
                effect.dispose();
                this.effects.delete(effect);
            }
        }

        // Update screen shake
        if (this.shakeElapsed < this.shakeDuration) {
            this.shakeElapsed += delta;
            const t = Math.min(this.shakeElapsed / this.shakeDuration, 1);
            const decay = 1 - t;
            const intensity = this.shakeIntensity * decay;

            if (this.shakeType === 'sine') {
                const freq = 30;
                this.shakeOffset.set(
                    Math.sin(this.shakeElapsed * freq) * intensity,
                    Math.cos(this.shakeElapsed * freq * 0.7) * intensity * 0.5,
                    0,
                );
            } else {
                this.shakeOffset.set(
                    (Math.random() - 0.5) * 2 * intensity,
                    (Math.random() - 0.5) * 2 * intensity * 0.5,
                    (Math.random() - 0.5) * intensity * 0.3,
                );
            }
        } else {
            this.shakeOffset.set(0, 0, 0);
        }
    }

    /** Add an effect to be managed. */
    addEffect(effect: VFXEffect): void {
        this.effects.add(effect);
    }

    /** Get current camera shake offset. */
    getShakeOffset(): Vector3 {
        return this.shakeOffset;
    }

    /** Trigger screen shake. */
    triggerShake(type: 'hit' | 'explosion'): void {
        const mobileScale = isMobile ? 0.5 : 1.0;
        if (type === 'hit') {
            this.shakeIntensity = 0.15 * mobileScale;
            this.shakeDuration = 0.2;
            this.shakeType = 'sine';
        } else {
            this.shakeIntensity = 0.4 * mobileScale;
            this.shakeDuration = 0.4;
            this.shakeType = 'jitter';
        }
        this.shakeElapsed = 0;
    }

    dispose(): void {
        for (const effect of this.effects) {
            effect.dispose();
        }
        this.effects.clear();
        this.scene.remove(this.effectGroup);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/services/VFXManager.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Add effectGroup to GameRenderer3D and expose shake**

Modify `arena/frontend/src/services/GameRenderer3D.ts`:
- Add after line 34 (`readonly zoneGroup: Group;`):
  ```typescript
  readonly effectGroup: Group;
  ```
- Add in constructor after line 89 (`this.zoneGroup = new Group();`):
  ```typescript
  this.effectGroup = new Group();
  ```
- Add `this.effectGroup` to `this.scene.add(...)` call at line 91-99
- Add method after `updateCamera()`:
  ```typescript
  /** Apply camera shake offset (added to camera position each frame). */
  applyCameraShake(offset: { x: number; y: number; z: number }): void {
      this.camera.position.x += offset.x;
      this.camera.position.y += offset.y;
      this.camera.position.z += offset.z;
  }
  ```

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `cd arena/frontend && npx vitest run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
cd arena && git add frontend/src/services/VFXManager.ts frontend/src/services/VFXManager.test.ts frontend/src/services/GameRenderer3D.ts
git commit -m "feat(arena): add VFXManager foundation and effectGroup to GameRenderer3D"
```

---

### Task 2: Screen Shake Effect

**Files:**
- Create: `arena/frontend/src/services/effects/ScreenShake.test.ts`
- Create: `arena/frontend/src/services/effects/ScreenShake.ts`

- [ ] **Step 1: Write ScreenShake test**

```typescript
// arena/frontend/src/services/effects/ScreenShake.test.ts
import { describe, it, expect } from 'vitest';
import { VFXManager } from '../VFXManager';
import { Scene } from 'three';

describe('ScreenShake (via VFXManager)', () => {
    it('produces non-zero offset after triggerShake("hit")', () => {
        const vfx = new VFXManager(new Scene());
        vfx.triggerShake('hit');
        vfx.update(0.05); // 50ms into 200ms shake
        const offset = vfx.getShakeOffset();
        expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
    });

    it('returns to zero after shake duration expires', () => {
        const vfx = new VFXManager(new Scene());
        vfx.triggerShake('hit');
        vfx.update(0.3); // 300ms > 200ms duration
        const offset = vfx.getShakeOffset();
        expect(offset.x).toBe(0);
        expect(offset.y).toBe(0);
    });

    it('explosion shake is stronger than hit shake', () => {
        const scene1 = new Scene();
        const vfx1 = new VFXManager(scene1);
        vfx1.triggerShake('hit');
        vfx1.update(0.01);
        const hitMag = Math.abs(vfx1.getShakeOffset().x);

        const scene2 = new Scene();
        const vfx2 = new VFXManager(scene2);
        vfx2.triggerShake('explosion');
        vfx2.update(0.01);
        const explMag = Math.abs(vfx2.getShakeOffset().x);

        // Explosion uses jitter (random), so just check intensity param is higher
        // Both at t=0.01, decay is ~0.95 for both
        // hit: 0.15 * 0.95 = 0.1425, explosion: 0.4 * 0.95 = 0.38
        // Since jitter is random, we use a statistical check
        expect(vfx2['shakeIntensity']).toBeGreaterThan(vfx1['shakeIntensity']);
    });
});
```

Note: Screen shake is built into VFXManager (no separate file needed — it's just state + math). The `ScreenShake.ts` file from the spec is folded into VFXManager to avoid a single-method class.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/services/effects/ScreenShake.test.ts`
Expected: PASS (3 tests) — shake logic already implemented in VFXManager

- [ ] **Step 3: Commit**

```bash
cd arena && git add frontend/src/services/effects/ScreenShake.test.ts
git commit -m "test(arena): add screen shake tests"
```

---

### Task 3: Impact Effect (Bullet Hit Sparks)

**Files:**
- Create: `arena/frontend/src/services/effects/ImpactEffect.ts`
- Create: `arena/frontend/src/services/effects/ImpactEffect.test.ts`

- [ ] **Step 1: Write ImpactEffect test**

```typescript
// arena/frontend/src/services/effects/ImpactEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group, Scene } from 'three';
import { ImpactEffect } from './ImpactEffect';

describe('ImpactEffect', () => {
    it('creates Points mesh and adds to parent group', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 1, y: 0.3, z: 2 });
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('returns true (alive) before lifetime expires', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        expect(effect.update(0.1)).toBe(true); // 100ms < 300ms lifetime
        effect.dispose();
    });

    it('returns false (dead) after lifetime expires', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        expect(effect.update(0.35)).toBe(false); // 350ms > 300ms lifetime
        effect.dispose();
    });

    it('dispose removes mesh from parent', () => {
        const group = new Group();
        const effect = new ImpactEffect(group, { x: 0, y: 0.3, z: 0 });
        const childCount = group.children.length;
        effect.dispose();
        expect(group.children.length).toBe(childCount - 1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/services/effects/ImpactEffect.test.ts`
Expected: FAIL — `Cannot find module './ImpactEffect'`

- [ ] **Step 3: Write ImpactEffect implementation**

```typescript
// arena/frontend/src/services/effects/ImpactEffect.ts
import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { PARTICLE_SCALE } from '../VFXManager';

const LIFETIME = 0.3; // 300ms
const BASE_COUNT = 12;
const SPEED_MIN = 2;
const SPEED_MAX = 4;
const SIZE = 0.05;

export class ImpactEffect implements VFXEffect {
    private readonly mesh: Points;
    private readonly parent: Group;
    private readonly velocities: Vector3[];
    private elapsed = 0;
    private readonly positions: Float32Array;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }) {
        this.parent = parent;
        const count = Math.round(BASE_COUNT * PARTICLE_SCALE);
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x;
            this.positions[i * 3 + 1] = worldPos.y;
            this.positions[i * 3 + 2] = worldPos.z;

            // Random hemisphere spread
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5; // hemisphere (upward bias)
            const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
            this.velocities.push(new Vector3(
                Math.cos(theta) * Math.sin(phi) * speed,
                Math.cos(phi) * speed, // upward
                Math.sin(theta) * Math.sin(phi) * speed,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

        const mat = new PointsMaterial({
            color: 0xffee66,
            size: SIZE,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });

        this.mesh = new Points(geo, mat);
        this.parent.add(this.mesh);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;
        const posAttr = this.mesh.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < this.velocities.length; i++) {
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] += this.velocities[i].y * delta;
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        // Fade out over last 100ms (last third of lifetime)
        const fadeStart = 0.66;
        const opacity = t > fadeStart ? 1 - (t - fadeStart) / (1 - fadeStart) : 1;
        (this.mesh.material as PointsMaterial).opacity = opacity;

        // Shrink particles
        (this.mesh.material as PointsMaterial).size = SIZE * (1 - t);

        return true;
    }

    dispose(): void {
        this.parent.remove(this.mesh);
        this.mesh.geometry.dispose();
        (this.mesh.material as PointsMaterial).dispose();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/services/effects/ImpactEffect.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd arena && git add frontend/src/services/effects/ImpactEffect.ts frontend/src/services/effects/ImpactEffect.test.ts
git commit -m "feat(arena): add bullet impact particle effect"
```

---

### Task 4: Explosion Effect (Grenade Detonation)

**Files:**
- Create: `arena/frontend/src/services/effects/ExplosionEffect.ts`
- Create: `arena/frontend/src/services/effects/ExplosionEffect.test.ts`

- [ ] **Step 1: Write ExplosionEffect test**

```typescript
// arena/frontend/src/services/effects/ExplosionEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { ExplosionEffect } from './ExplosionEffect';

describe('ExplosionEffect', () => {
    it('creates multiple children (shockwave + particles + light)', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 1, y: 0, z: 2 }, 2);
        // Shockwave mesh + Points + PointLight = at least 3 children
        expect(group.children.length).toBeGreaterThanOrEqual(3);
        effect.dispose();
    });

    it('stays alive during 600ms lifetime', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        expect(effect.update(0.3)).toBe(true); // 300ms < 600ms
        effect.dispose();
    });

    it('dies after lifetime', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        expect(effect.update(0.7)).toBe(false); // 700ms > 600ms
        effect.dispose();
    });

    it('dispose cleans up all children', () => {
        const group = new Group();
        const effect = new ExplosionEffect(group, { x: 0, y: 0, z: 0 }, 2);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/services/effects/ExplosionEffect.test.ts`
Expected: FAIL

- [ ] **Step 3: Write ExplosionEffect implementation**

```typescript
// arena/frontend/src/services/effects/ExplosionEffect.ts
import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    TorusGeometry,
    MeshBasicMaterial,
    Mesh,
    PointLight,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { PARTICLE_SCALE } from '../VFXManager';

const LIFETIME = 0.6;
const SHOCKWAVE_DURATION = 0.4;
const LIGHT_DURATION = 0.2;
const BASE_PARTICLE_COUNT = 30;

export class ExplosionEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly shockwave: Mesh;
    private readonly particles: Points;
    private readonly light: PointLight;
    private readonly velocities: Vector3[];
    private readonly positions: Float32Array;
    private readonly targetRadius: number;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, radiusWorld: number) {
        this.parent = parent;
        this.targetRadius = radiusWorld;

        // Shockwave ring (torus)
        const shockGeo = new TorusGeometry(0.01, 0.03, 8, 32);
        const shockMat = new MeshBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.8,
        });
        this.shockwave = new Mesh(shockGeo, shockMat);
        this.shockwave.position.set(worldPos.x, 0.05, worldPos.z);
        this.shockwave.rotation.x = -Math.PI / 2;
        parent.add(this.shockwave);

        // Debris particles
        const count = Math.round(BASE_PARTICLE_COUNT * PARTICLE_SCALE);
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x;
            this.positions[i * 3 + 1] = 0.3;
            this.positions[i * 3 + 2] = worldPos.z;

            const theta = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.velocities.push(new Vector3(
                Math.cos(theta) * speed,
                1 + Math.random() * 2, // upward
                Math.sin(theta) * speed,
            ));
        }

        const particleGeo = new BufferGeometry();
        particleGeo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        const particleMat = new PointsMaterial({
            color: 0xff6600,
            size: 0.08,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });
        this.particles = new Points(particleGeo, particleMat);
        parent.add(this.particles);

        // Point light flash
        this.light = new PointLight(0xffffff, 3, radiusWorld * 2);
        this.light.position.set(worldPos.x, 1, worldPos.z);
        parent.add(this.light);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Shockwave expansion
        if (this.elapsed < SHOCKWAVE_DURATION) {
            const st = this.elapsed / SHOCKWAVE_DURATION;
            const scale = st * this.targetRadius;
            this.shockwave.scale.set(scale, scale, 1);
            (this.shockwave.material as MeshBasicMaterial).opacity = 0.8 * (1 - st);
        } else {
            this.shockwave.visible = false;
        }

        // Light decay
        if (this.elapsed < LIGHT_DURATION) {
            this.light.intensity = 3 * (1 - this.elapsed / LIGHT_DURATION);
        } else {
            this.light.intensity = 0;
        }

        // Particle movement + gravity
        const posAttr = this.particles.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.velocities.length; i++) {
            this.velocities[i].y -= 5 * delta; // gravity
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] = Math.max(0, arr[i * 3 + 1] + this.velocities[i].y * delta);
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        // Color shift orange → red
        const r = 1;
        const g = 0.4 * (1 - t);
        (this.particles.material as PointsMaterial).color.setRGB(r, g, 0);
        (this.particles.material as PointsMaterial).opacity = 1 - t;

        return true;
    }

    dispose(): void {
        this.parent.remove(this.shockwave);
        this.parent.remove(this.particles);
        this.parent.remove(this.light);
        (this.shockwave.geometry as TorusGeometry).dispose();
        (this.shockwave.material as MeshBasicMaterial).dispose();
        this.particles.geometry.dispose();
        (this.particles.material as PointsMaterial).dispose();
        this.light.dispose();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/services/effects/ExplosionEffect.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
cd arena && git add frontend/src/services/effects/ExplosionEffect.ts frontend/src/services/effects/ExplosionEffect.test.ts
git commit -m "feat(arena): add grenade explosion effect with shockwave and debris"
```

---

### Task 5: Muzzle Flash Effect

**Files:**
- Create: `arena/frontend/src/services/effects/MuzzleFlashEffect.ts`
- Create: `arena/frontend/src/services/effects/MuzzleFlashEffect.test.ts`

- [ ] **Step 1: Write MuzzleFlashEffect test**

```typescript
// arena/frontend/src/services/effects/MuzzleFlashEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { MuzzleFlashEffect } from './MuzzleFlashEffect';

describe('MuzzleFlashEffect', () => {
    it('creates children (sprite + spark points)', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 1, y: 0.3, z: 2 }, 0);
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('has very short lifetime (~100ms)', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 0, y: 0.3, z: 0 }, 0);
        expect(effect.update(0.05)).toBe(true); // 50ms alive
        expect(effect.update(0.1)).toBe(false); // 150ms total > ~100ms
        effect.dispose();
    });

    it('dispose cleans up', () => {
        const group = new Group();
        const effect = new MuzzleFlashEffect(group, { x: 0, y: 0.3, z: 0 }, 0);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd arena/frontend && npx vitest run src/services/effects/MuzzleFlashEffect.test.ts`
Expected: FAIL

- [ ] **Step 3: Write MuzzleFlashEffect implementation**

```typescript
// arena/frontend/src/services/effects/MuzzleFlashEffect.ts
import {
    Sprite,
    SpriteMaterial,
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { PARTICLE_SCALE } from '../VFXManager';

const LIFETIME = 0.1; // 100ms
const FLASH_SIZE = 0.3;
const SPARK_COUNT = 6;

export class MuzzleFlashEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly flash: Sprite;
    private readonly sparks: Points;
    private readonly sparkVelocities: Vector3[];
    private readonly sparkPositions: Float32Array;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, angle: number) {
        this.parent = parent;

        // Billboard flash sprite
        const flashMat = new SpriteMaterial({
            color: 0xffffcc,
            transparent: true,
            opacity: 1,
        });
        this.flash = new Sprite(flashMat);
        this.flash.scale.set(FLASH_SIZE, FLASH_SIZE, 1);
        this.flash.position.set(worldPos.x, worldPos.y, worldPos.z);
        parent.add(this.flash);

        // Spark points ejected in cone
        const count = Math.round(SPARK_COUNT * PARTICLE_SCALE);
        this.sparkPositions = new Float32Array(count * 3);
        this.sparkVelocities = [];

        for (let i = 0; i < count; i++) {
            this.sparkPositions[i * 3] = worldPos.x;
            this.sparkPositions[i * 3 + 1] = worldPos.y;
            this.sparkPositions[i * 3 + 2] = worldPos.z;

            // Forward cone: angle ± 0.3 radians
            const spread = (Math.random() - 0.5) * 0.6;
            const a = angle + spread;
            const speed = 3 + Math.random() * 2;
            this.sparkVelocities.push(new Vector3(
                Math.cos(a) * speed,
                (Math.random() - 0.3) * speed * 0.3,
                Math.sin(a) * speed,
            ));
        }

        const sparkGeo = new BufferGeometry();
        sparkGeo.setAttribute('position', new Float32BufferAttribute(this.sparkPositions, 3));
        const sparkMat = new PointsMaterial({
            color: 0xffee66,
            size: 0.03,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });
        this.sparks = new Points(sparkGeo, sparkMat);
        parent.add(this.sparks);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Flash fades
        (this.flash.material as SpriteMaterial).opacity = 1 - t;
        this.flash.scale.setScalar(FLASH_SIZE * (1 + t * 0.5)); // slight growth

        // Sparks move
        const posAttr = this.sparks.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.sparkVelocities.length; i++) {
            arr[i * 3] += this.sparkVelocities[i].x * delta;
            arr[i * 3 + 1] += this.sparkVelocities[i].y * delta;
            arr[i * 3 + 2] += this.sparkVelocities[i].z * delta;
        }
        posAttr.needsUpdate = true;
        (this.sparks.material as PointsMaterial).opacity = 1 - t;

        return true;
    }

    dispose(): void {
        this.parent.remove(this.flash);
        this.parent.remove(this.sparks);
        (this.flash.material as SpriteMaterial).dispose();
        this.sparks.geometry.dispose();
        (this.sparks.material as PointsMaterial).dispose();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd arena/frontend && npx vitest run src/services/effects/MuzzleFlashEffect.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
cd arena && git add frontend/src/services/effects/MuzzleFlashEffect.ts frontend/src/services/effects/MuzzleFlashEffect.test.ts
git commit -m "feat(arena): add muzzle flash effect with billboard sprite and sparks"
```

---

### Task 6: Wire VFX into ProjectileRenderer

**Files:**
- Modify: `arena/frontend/src/services/ProjectileRenderer.ts`

- [ ] **Step 1: Add callbacks to ProjectileRenderer constructor and update()**

Modify `arena/frontend/src/services/ProjectileRenderer.ts`:

Add callback type and constructor parameter:
```typescript
export interface ProjectileCallbacks {
    onRemoved?: (worldPos: { x: number; y: number; z: number }, type: string) => void;
    onCreated?: (worldPos: { x: number; y: number; z: number }, angle: number) => void;
}
```

Update class:
- Add `private readonly callbacks: ProjectileCallbacks;` field
- Change constructor to `constructor(group: Group, callbacks: ProjectileCallbacks = {})`
- In the removal block (lines 46-49), before `this.objects.delete(id)`:
  ```typescript
  const pos = obj.position;
  this.callbacks.onRemoved?.({ x: pos.x, y: pos.y, z: pos.z }, obj.userData.type ?? 'bullet');
  ```
- When creating a new bullet mesh (line 73), after `this.group.add(mesh)`:
  ```typescript
  mesh.userData.type = proj.type ?? 'bullet';
  this.callbacks.onCreated?.({ x: wx, y: 0.3, z: wz }, proj.angle);
  ```
- When creating a new grenade mesh (line 63), set `mesh.userData.type = 'grenade';`

- [ ] **Step 2: Run existing tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All tests pass (ProjectileRenderer constructor change is backwards-compatible with default `{}`)

- [ ] **Step 3: Commit**

```bash
cd arena && git add frontend/src/services/ProjectileRenderer.ts
git commit -m "feat(arena): add VFX callbacks to ProjectileRenderer for impact/muzzle effects"
```

---

### Task 7: Wire VFX into Game3D.tsx and useGameSockets

**Files:**
- Modify: `arena/frontend/src/hooks/useGameSockets.ts`
- Modify: `arena/frontend/src/components/Game3D.tsx`

- [ ] **Step 1: Add explosion listener and VFX callbacks to useGameSockets**

Modify `arena/frontend/src/hooks/useGameSockets.ts`:

Add to interface:
```typescript
interface UseGameSocketsOptions {
    // ... existing fields ...
    onExplosion?: (data: { x: number; y: number; radius: number }) => void;
    onPlayerHit?: () => void;
}
```

Add after existing `socket.on('player-hit', ...)` block (line 58-60):
```typescript
socket.on('explosion', (data: { x: number; y: number; radius: number }) => {
    onExplosion?.(data);
});
```

Update `player-hit` handler to also call the callback:
```typescript
socket.on('player-hit', () => {
    SoundService.playSFX('player_hit');
    onPlayerHit?.();
});
```

Add cleanup in return:
```typescript
socket.off('explosion');
```

- [ ] **Step 2: Wire VFXManager into Game3D.tsx**

Modify `arena/frontend/src/components/Game3D.tsx`:

Add imports:
```typescript
import { VFXManager } from '../services/VFXManager';
import { ImpactEffect } from '../services/effects/ImpactEffect';
import { ExplosionEffect } from '../services/effects/ExplosionEffect';
import { MuzzleFlashEffect } from '../services/effects/MuzzleFlashEffect';
import { GameRenderer3D, WORLD_SCALE } from '../services/GameRenderer3D';
```

Add ref in Game3DInner (after line 66):
```typescript
const vfxRef = useRef<VFXManager | null>(null);
```

Add VFX callbacks for useGameSockets call (modify line 88):
```typescript
useGameSockets({
    playerId, navigate, gameStateRef, activeEmotesRef,
    onExplosion: (data) => {
        const vfx = vfxRef.current;
        const r = rendererRef.current;
        if (!vfx || !r) return;
        const { wx, wz } = GameRenderer3D.toWorld(data.x, data.y);
        vfx.addEffect(new ExplosionEffect(vfx.effectGroup, { x: wx, y: 0, z: wz }, data.radius * WORLD_SCALE));
        vfx.triggerShake('explosion');
    },
    onPlayerHit: () => {
        vfxRef.current?.triggerShake('hit');
    },
});
```

In setup useEffect, after `projectileRef.current = new ProjectileRenderer(r.projectileGroup)` (line 108), change to:
```typescript
const vfx = new VFXManager(r.scene);
vfxRef.current = vfx;

projectileRef.current = new ProjectileRenderer(r.projectileGroup, {
    onRemoved: (pos, type) => {
        if (type !== 'grenade') {
            vfx.addEffect(new ImpactEffect(vfx.effectGroup, pos));
        }
    },
    onCreated: (pos, angle) => {
        vfx.addEffect(new MuzzleFlashEffect(vfx.effectGroup, pos, angle));
    },
});
```

In the animation loop (after `labelRef.current?.update(players);` at line 163), add:
```typescript
vfxRef.current?.update(delta);

// Apply screen shake
const shakeOffset = vfxRef.current?.getShakeOffset();
if (shakeOffset) r.applyCameraShake(shakeOffset);
```

In cleanup (before `r.dispose()` at line 180), add:
```typescript
vfxRef.current?.dispose();
```

- [ ] **Step 3: Update useGameSockets test for new explosion event**

Modify `arena/frontend/src/__tests__/useGameSockets.test.ts`:

Update the event count test to check for `explosion`:
```typescript
expect(registeredEvents).toContain('explosion');
```

Update cleanup test:
```typescript
expect(removedEvents).toContain('explosion');
```

- [ ] **Step 4: Run all tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd arena && git add frontend/src/hooks/useGameSockets.ts frontend/src/components/Game3D.tsx frontend/src/__tests__/useGameSockets.test.ts
git commit -m "feat(arena): wire VFX effects into Game3D and socket events"
```

---

## Wave 2: Polish

### Task 8: Death Effect

**Files:**
- Create: `arena/frontend/src/services/effects/DeathEffect.ts`
- Create: `arena/frontend/src/services/effects/DeathEffect.test.ts`
- Modify: `arena/frontend/src/services/PlayerRenderer.ts`

- [ ] **Step 1: Write DeathEffect test**

```typescript
// arena/frontend/src/services/effects/DeathEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { DeathEffect } from './DeathEffect';

describe('DeathEffect', () => {
    it('creates particles in parent group', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 1, y: 0.5, z: 2 }, 0x00f2ff);
        expect(group.children.length).toBeGreaterThan(0);
        effect.dispose();
    });

    it('survives through 600ms lifetime', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0xff6b9d);
        expect(effect.update(0.3)).toBe(true);
        expect(effect.update(0.2)).toBe(true); // 500ms total
        effect.dispose();
    });

    it('dies after 600ms', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0x3eff8b);
        expect(effect.update(0.65)).toBe(false);
        effect.dispose();
    });

    it('dispose cleans up', () => {
        const group = new Group();
        const effect = new DeathEffect(group, { x: 0, y: 0.5, z: 0 }, 0xbc13fe);
        effect.dispose();
        expect(group.children.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run test, verify failure, then implement**

Run: `cd arena/frontend && npx vitest run src/services/effects/DeathEffect.test.ts`

Then implement `DeathEffect.ts` — 600ms lifetime, rising particles tinted with character color, flash phase at 0-100ms.

```typescript
// arena/frontend/src/services/effects/DeathEffect.ts
import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Color,
    Group,
    Vector3,
} from 'three';
import type { VFXEffect } from '../VFXManager';
import { PARTICLE_SCALE } from '../VFXManager';

const LIFETIME = 0.6;
const BASE_COUNT = 20;

export class DeathEffect implements VFXEffect {
    private readonly parent: Group;
    private readonly particles: Points;
    private readonly velocities: Vector3[];
    private readonly positions: Float32Array;
    private elapsed = 0;

    constructor(parent: Group, worldPos: { x: number; y: number; z: number }, charColor: number) {
        this.parent = parent;
        const count = Math.round(BASE_COUNT * PARTICLE_SCALE);
        this.positions = new Float32Array(count * 3);
        this.velocities = [];

        for (let i = 0; i < count; i++) {
            this.positions[i * 3] = worldPos.x + (Math.random() - 0.5) * 0.3;
            this.positions[i * 3 + 1] = worldPos.y + Math.random() * 0.5;
            this.positions[i * 3 + 2] = worldPos.z + (Math.random() - 0.5) * 0.3;

            this.velocities.push(new Vector3(
                (Math.random() - 0.5) * 0.5,
                0.5 + Math.random() * 1.5, // rise upward
                (Math.random() - 0.5) * 0.5,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));

        const mat = new PointsMaterial({
            color: new Color(charColor),
            size: 0.06,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
        });

        this.particles = new Points(geo, mat);
        parent.add(this.particles);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Flash red in first 100ms
        if (this.elapsed < 0.1) {
            const flashT = this.elapsed / 0.1;
            const mat = this.particles.material as PointsMaterial;
            const base = mat.color.clone();
            mat.color.lerpColors(base, new Color(0xff2200), flashT * 0.5);
        }

        // Move particles upward
        const posAttr = this.particles.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < this.velocities.length; i++) {
            arr[i * 3] += this.velocities[i].x * delta;
            arr[i * 3 + 1] += this.velocities[i].y * delta;
            arr[i * 3 + 2] += this.velocities[i].z * delta;
        }
        posAttr.needsUpdate = true;

        // Fade out
        (this.particles.material as PointsMaterial).opacity = 1 - t;
        (this.particles.material as PointsMaterial).size = 0.06 * (1 - t * 0.5);

        return true;
    }

    dispose(): void {
        this.parent.remove(this.particles);
        this.particles.geometry.dispose();
        (this.particles.material as PointsMaterial).dispose();
    }
}
```

- [ ] **Step 3: Run test, verify pass**

Run: `cd arena/frontend && npx vitest run src/services/effects/DeathEffect.test.ts`
Expected: PASS

- [ ] **Step 4: Wire death callback into PlayerRenderer**

Modify `arena/frontend/src/services/PlayerRenderer.ts`:

Add callback to constructor:
```typescript
export interface PlayerRendererCallbacks {
    onPlayerDeath?: (worldPos: { x: number; y: number; z: number }, charColor: number) => void;
}
```

Update constructor signature:
```typescript
private readonly callbacks: PlayerRendererCallbacks;

constructor(
    playerGroup: Group,
    characterManager: import('shared-3d').CharacterManager,
    callbacks: PlayerRendererCallbacks = {},
) {
    this.playerGroup = playerGroup;
    this.characterManager = characterManager;
    this.callbacks = callbacks;
}
```

First, add `charId: string` to the `TrackedPlayer` interface (line 36):
```typescript
interface TrackedPlayer {
    container: Object3D;
    instance: CharacterInstance | null;
    capsule: Mesh;
    marker: Mesh;
    armorRing: Mesh;
    currentAnim: string;
    charId: string;  // ← add this
}
```

Set it during player creation (around line 125, where `tracked` is assigned):
```typescript
tracked = { container, instance: null, capsule, marker, armorRing, currentAnim: '', charId };
```

Then in the death removal block (lines 72-79), add before `this.playerGroup.remove(tracked.container)`:
```typescript
const charColor = CHAR_COLORS[tracked.charId] ?? DEFAULT_CHAR_COLOR;
const pos = tracked.container.position;
this.callbacks.onPlayerDeath?.({ x: pos.x, y: pos.y + 0.5, z: pos.z }, charColor);
```

- [ ] **Step 5: Wire in Game3D.tsx**

In Game3D.tsx setup useEffect, update PlayerRenderer construction:
```typescript
playerRef.current = new PlayerRenderer(r.playerGroup, r.characterManager, {
    onPlayerDeath: (pos, color) => {
        const { DeathEffect } = await import('../services/effects/DeathEffect');
        vfxRef.current?.addEffect(new DeathEffect(vfxRef.current.effectGroup, pos, color));
    },
});
```

Note: Use static import instead of dynamic import for simplicity:
```typescript
import { DeathEffect } from '../services/effects/DeathEffect';
// ...
playerRef.current = new PlayerRenderer(r.playerGroup, r.characterManager, {
    onPlayerDeath: (pos, color) => {
        vfx.addEffect(new DeathEffect(vfx.effectGroup, pos, color));
    },
});
```

- [ ] **Step 6: Run all tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
cd arena && git add frontend/src/services/effects/DeathEffect.ts frontend/src/services/effects/DeathEffect.test.ts frontend/src/services/PlayerRenderer.ts frontend/src/components/Game3D.tsx
git commit -m "feat(arena): add cyberpunk death dissolve effect with character-colored particles"
```

---

### Task 9: Atmosphere Effect

**Files:**
- Create: `arena/frontend/src/services/effects/AtmosphereEffect.ts`
- Create: `arena/frontend/src/services/effects/AtmosphereEffect.test.ts`
- Modify: `arena/frontend/src/services/GameRenderer3D.ts`

- [ ] **Step 1: Write AtmosphereEffect test**

```typescript
// arena/frontend/src/services/effects/AtmosphereEffect.test.ts
import { describe, it, expect } from 'vitest';
import { Scene, FogExp2, Group } from 'three';
import { AtmosphereEffect } from './AtmosphereEffect';

describe('AtmosphereEffect', () => {
    it('adds dust particles to scene', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        // Should have added a Points object for dust
        const dustChild = scene.children.find(c => c.type === 'Points');
        expect(dustChild).toBeDefined();
        atmo.dispose();
    });

    it('sets FogExp2 on scene', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        expect(scene.fog).toBeInstanceOf(FogExp2);
        atmo.dispose();
    });

    it('update does not throw', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        expect(() => atmo.update(0.016)).not.toThrow();
        atmo.dispose();
    });

    it('dispose removes particles and fog', () => {
        const scene = new Scene();
        const atmo = new AtmosphereEffect(scene);
        atmo.dispose();
        expect(scene.fog).toBeNull();
    });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

Implement `AtmosphereEffect.ts`:

```typescript
// arena/frontend/src/services/effects/AtmosphereEffect.ts
import {
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    FogExp2,
    Scene,
    Vector3,
} from 'three';
import { PARTICLE_SCALE } from '../VFXManager';

const BASE_DUST_COUNT = 50;
const DRIFT_SPEED = 0.2;
const AREA_SIZE = 15; // world units radius around camera

const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export class AtmosphereEffect {
    private readonly scene: Scene;
    private readonly dustMesh: Points;
    private readonly dustVelocities: Vector3[];
    private readonly dustPositions: Float32Array;

    constructor(scene: Scene) {
        this.scene = scene;

        // Fog
        if (!isMobile) {
            scene.fog = new FogExp2(0x0a0b1a, 0.015);
        }

        // Dust motes
        const count = Math.round(BASE_DUST_COUNT * PARTICLE_SCALE);
        this.dustPositions = new Float32Array(count * 3);
        this.dustVelocities = [];

        for (let i = 0; i < count; i++) {
            this.dustPositions[i * 3] = (Math.random() - 0.5) * AREA_SIZE * 2;
            this.dustPositions[i * 3 + 1] = Math.random() * 3; // 0-3 units height
            this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * AREA_SIZE * 2;

            this.dustVelocities.push(new Vector3(
                (Math.random() - 0.5) * DRIFT_SPEED,
                (Math.random() - 0.5) * DRIFT_SPEED * 0.3,
                (Math.random() - 0.5) * DRIFT_SPEED,
            ));
        }

        const geo = new BufferGeometry();
        geo.setAttribute('position', new Float32BufferAttribute(this.dustPositions, 3));

        const mat = new PointsMaterial({
            color: 0x00f2ff,
            size: 0.02,
            transparent: true,
            opacity: 0.15,
            sizeAttenuation: true,
        });

        this.dustMesh = new Points(geo, mat);
        scene.add(this.dustMesh);
    }

    /** Move dust particles with slow drift. */
    update(delta: number): void {
        const posAttr = this.dustMesh.geometry.getAttribute('position');
        const arr = posAttr.array as Float32Array;

        for (let i = 0; i < this.dustVelocities.length; i++) {
            arr[i * 3] += this.dustVelocities[i].x * delta;
            arr[i * 3 + 1] += this.dustVelocities[i].y * delta;
            arr[i * 3 + 2] += this.dustVelocities[i].z * delta;

            // Wrap around if too far from origin
            if (Math.abs(arr[i * 3]) > AREA_SIZE) arr[i * 3] *= -0.9;
            if (arr[i * 3 + 1] > 3 || arr[i * 3 + 1] < 0) this.dustVelocities[i].y *= -1;
            if (Math.abs(arr[i * 3 + 2]) > AREA_SIZE) arr[i * 3 + 2] *= -0.9;
        }
        posAttr.needsUpdate = true;
    }

    dispose(): void {
        this.scene.remove(this.dustMesh);
        this.dustMesh.geometry.dispose();
        (this.dustMesh.material as PointsMaterial).dispose();
        this.scene.fog = null;
    }
}
```

- [ ] **Step 3: Run test, verify pass**

Run: `cd arena/frontend && npx vitest run src/services/effects/AtmosphereEffect.test.ts`
Expected: PASS

- [ ] **Step 4: Wire atmosphere into Game3D.tsx**

In Game3D.tsx setup useEffect, after VFXManager creation, add:
```typescript
import { AtmosphereEffect } from '../services/effects/AtmosphereEffect';
// ...
const atmosphere = new AtmosphereEffect(r.scene);
```

In animation loop, add after `vfxRef.current?.update(delta)`:
```typescript
atmosphereRef.current?.update(delta);
```

Add ref: `const atmosphereRef = useRef<AtmosphereEffect | null>(null);`
Set in setup: `atmosphereRef.current = atmosphere;`
Dispose in cleanup: `atmosphereRef.current?.dispose();`

- [ ] **Step 5: Replace green floor with neon grid in TerrainRenderer**

Modify `arena/frontend/src/services/TerrainRenderer.ts`:

Replace the floor plane + GridHelper (lines 40-59) with a single emissive cyan grid:
```typescript
// Replace lines 40-59 (floor plane + GridHelper) with:
// Neon grid floor — emissive cyan LineSegments
const gridLines: number[] = [];
for (let x = 0; x <= mapW; x++) {
    gridLines.push(x * TILE, 0, 0, x * TILE, 0, h);
}
for (let z = 0; z <= mapH; z++) {
    gridLines.push(0, 0, z * TILE, w, 0, z * TILE);
}
const gridGeo = new BufferGeometry();
gridGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(gridLines), 3));
const gridMat = new LineBasicMaterial({
    color: 0x00f2ff,
    transparent: true,
    opacity: 0.05,
});
const gridFloor = new LineSegments(gridGeo, gridMat);
gridFloor.position.y = 0.005;
this.group.add(gridFloor);
this.meshes.push(gridFloor as any);

// Dark floor underneath (so grid lines show against black, not void)
const floorGeo = new PlaneGeometry(w, h);
const floorMat = new MeshBasicMaterial({ color: 0x050510 });
const floor = new Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(w / 2, -0.01, h / 2);
this.group.add(floor);
this.meshes.push(floor);
```

Add `BufferGeometry` and `Float32BufferAttribute` to existing Three.js imports at top of file.

Remove the old `GridHelper` creation (lines 49-59) and the `FLOOR_COLOR` constant. Keep `WALL_COLOR`, `PATH_COLOR`, `BOUNDARY_COLOR`.

Update `clear()` — remove the `gridHelper` cleanup block (lines 139-142) since we no longer use GridHelper. Remove the `private gridHelper` field (line 27).

- [ ] **Step 6: Run all tests, commit**

Run: `cd arena/frontend && npx vitest run`

```bash
cd arena && git add frontend/src/services/effects/AtmosphereEffect.ts frontend/src/services/effects/AtmosphereEffect.test.ts frontend/src/components/Game3D.tsx frontend/src/services/TerrainRenderer.ts
git commit -m "feat(arena): add atmosphere (dust, fog) and neon grid floor"
```

---

### Task 10: Damage Numbers

**Files:**
- Create: `arena/frontend/src/services/effects/DamageNumber.ts`
- Create: `arena/frontend/src/services/effects/DamageNumber.test.ts`
- Modify: `arena/frontend/src/hooks/useGameSockets.ts`
- Modify: `arena/backend/src/services/GameService.ts`
- Modify: `arena/backend/src/types/game.ts`

- [ ] **Step 1: Write DamageNumber test**

```typescript
// arena/frontend/src/services/effects/DamageNumber.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Scene } from 'three';

// Mock CSS2DObject since jsdom doesn't support it
vi.mock('three/addons/renderers/CSS2DRenderer.js', () => ({
    CSS2DObject: class MockCSS2DObject {
        element: HTMLElement;
        position = { set: vi.fn(), x: 0, y: 0, z: 0 };
        removeFromParent = vi.fn();
        constructor(element: HTMLElement) { this.element = element; }
    },
}));

import { DamageNumber } from './DamageNumber';

describe('DamageNumber', () => {
    it('creates with correct color for damage', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 15, 'damage');
        expect(dn).toBeDefined();
        dn.dispose();
    });

    it('stays alive during 800ms lifetime', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 10, 'damage');
        expect(dn.update(0.4)).toBe(true);
        dn.dispose();
    });

    it('dies after 800ms', () => {
        const scene = new Scene();
        const dn = new DamageNumber(scene, { x: 0, y: 1, z: 0 }, 10, 'damage');
        expect(dn.update(0.9)).toBe(false);
        dn.dispose();
    });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

```typescript
// arena/frontend/src/services/effects/DamageNumber.ts
import { Scene } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { VFXEffect } from '../VFXManager';

const LIFETIME = 0.8;
const FLOAT_DISTANCE = 1.5; // world units upward

const COLORS = {
    damage: '#ff4d6d',
    armor: '#38bdf8',
    heal: '#3eff8b',
} as const;

export class DamageNumber implements VFXEffect {
    private readonly scene: Scene;
    private readonly label: CSS2DObject;
    private readonly startY: number;
    private elapsed = 0;

    constructor(
        scene: Scene,
        worldPos: { x: number; y: number; z: number },
        amount: number,
        type: 'damage' | 'armor' | 'heal',
    ) {
        this.scene = scene;
        this.startY = worldPos.y;

        const div = document.createElement('div');
        div.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
        div.style.cssText = `
            font-family: monospace;
            font-weight: 900;
            color: ${COLORS[type]};
            text-shadow: 0 0 8px ${COLORS[type]}80;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
        `;

        // Scale font size with damage amount
        const fontSize = Math.min(14 + amount * 0.4, 28);
        div.style.fontSize = `${fontSize}px`;

        this.label = new CSS2DObject(div);
        this.label.position.set(worldPos.x, worldPos.y, worldPos.z);
        scene.add(this.label);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= LIFETIME) return false;

        const t = this.elapsed / LIFETIME;

        // Float upward
        this.label.position.y = this.startY + t * FLOAT_DISTANCE;

        // Fade out over last 300ms (last 37.5% of lifetime)
        const fadeStart = 0.625;
        if (t > fadeStart) {
            const fadeT = (t - fadeStart) / (1 - fadeStart);
            this.label.element.style.opacity = String(1 - fadeT);
        }

        return true;
    }

    dispose(): void {
        this.label.removeFromParent();
        if (this.label.element.parentElement) {
            this.label.element.parentElement.removeChild(this.label.element);
        }
    }
}
```

- [ ] **Step 3: Run test, verify pass**

Run: `cd arena/frontend && npx vitest run src/services/effects/DamageNumber.test.ts`
Expected: PASS

- [ ] **Step 4: Add x, y to backend player-hit event**

Modify `arena/backend/src/types/game.ts` line 242:
```typescript
'player-hit': (data: { targetId: string; attackerId: string; damage: number; remainingHp: number; hasArmor: boolean; x: number; y: number }) => void;
```

Modify `arena/backend/src/services/GameService.ts` — all 3 `onPlayerHit` call sites:

**Line 388 (explosion damage to players):** Add `x: target.x, y: target.y` — variable is `target` from `game.players.get()`
**Line 525 (bullet damage to players):** Add `x: target.x, y: target.y` — variable is `target` from `game.players` iteration

```typescript
// Lines 388 and 525 — same pattern:
this.onPlayerHit?.(game.matchId, {
    targetId,
    attackerId: projectile.ownerId,
    damage: projectile.damage,
    remainingHp: result.remainingHp,
    hasArmor: result.hasArmor,
    x: target.x,
    y: target.y,
});
```

**Line 991 (NPC contact damage):** Add `x: player.x, y: player.y` — NOTE: variable is `player` (not `target`) at this call site:
```typescript
this.onPlayerHit?.(game.matchId, {
    targetId: playerId,
    attackerId: npc.id,
    damage: NPC_CONST.DAMAGE,
    remainingHp: result.remainingHp,
    hasArmor: result.hasArmor,
    x: player.x,
    y: player.y,
});
```

Also update the `onPlayerHit` callback type at line 37 and 59 to include `x: number; y: number`.

- [ ] **Step 5: Wire damage numbers in useGameSockets and Game3D**

Modify `useGameSockets.ts` — update `player-hit` handler to accept payload:
```typescript
socket.on('player-hit', (data: { targetId: string; damage: number; x: number; y: number; hasArmor: boolean }) => {
    SoundService.playSFX('player_hit');
    onPlayerHit?.(data);
});
```

Update callback type in interface:
```typescript
onPlayerHit?: (data: { targetId: string; damage: number; x: number; y: number; hasArmor: boolean }) => void;
```

In Game3D.tsx, update the `onPlayerHit` callback:
```typescript
onPlayerHit: (data) => {
    const vfx = vfxRef.current;
    const r = rendererRef.current;
    if (!vfx || !r) return;
    vfx.triggerShake('hit');
    const { wx, wz } = GameRenderer3D.toWorld(data.x, data.y);
    const type = data.hasArmor ? 'armor' : 'damage';
    vfx.addEffect(new DamageNumber(r.scene, { x: wx, y: 1.8, z: wz }, data.damage, type));
},
```

Add import: `import { DamageNumber } from '../services/effects/DamageNumber';`

- [ ] **Step 6: Run all frontend + backend tests**

Run: `cd arena/frontend && npx vitest run`
Run: `cd arena/backend && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
cd arena && git add frontend/src/services/effects/DamageNumber.ts frontend/src/services/effects/DamageNumber.test.ts frontend/src/hooks/useGameSockets.ts frontend/src/components/Game3D.tsx frontend/src/__tests__/useGameSockets.test.ts backend/src/services/GameService.ts backend/src/types/game.ts
git commit -m "feat(arena): add floating damage numbers with backend x,y coordinates"
```

---

## Wave 3: Rendering Infrastructure

### Task 11: Quality Settings

**Files:**
- Create: `arena/frontend/src/services/QualitySettings.ts`
- Create: `arena/frontend/src/services/QualitySettings.test.ts`

- [ ] **Step 1: Write QualitySettings test**

```typescript
// arena/frontend/src/services/QualitySettings.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QualitySettings, QualityTier } from './QualitySettings';

describe('QualitySettings', () => {
    beforeEach(() => {
        localStorage.clear();
        QualitySettings.reset();
    });

    it('defaults to high on desktop', () => {
        expect(QualitySettings.current.tier).toBe('high');
    });

    it('provides correct particle counts for high tier', () => {
        QualitySettings.setTier('high');
        expect(QualitySettings.current.impactParticleCount).toBe(12);
        expect(QualitySettings.current.explosionParticleCount).toBe(30);
        expect(QualitySettings.current.deathParticleCount).toBe(20);
    });

    it('provides reduced counts for medium tier', () => {
        QualitySettings.setTier('medium');
        expect(QualitySettings.current.impactParticleCount).toBe(8);
        expect(QualitySettings.current.explosionParticleCount).toBe(15);
    });

    it('provides minimal counts for low tier', () => {
        QualitySettings.setTier('low');
        expect(QualitySettings.current.impactParticleCount).toBe(4);
        expect(QualitySettings.current.explosionParticleCount).toBe(8);
        expect(QualitySettings.current.showShockwave).toBe(false);
    });

    it('persists to localStorage', () => {
        QualitySettings.setTier('low');
        expect(localStorage.getItem('arena_quality')).toBe('low');
    });

    it('reads from localStorage on init', () => {
        localStorage.setItem('arena_quality', 'medium');
        QualitySettings.reset();
        expect(QualitySettings.current.tier).toBe('medium');
    });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

```typescript
// arena/frontend/src/services/QualitySettings.ts
export type QualityTier = 'high' | 'medium' | 'low';

interface QualityConfig {
    tier: QualityTier;
    // Particles
    impactParticleCount: number;
    explosionParticleCount: number;
    deathParticleCount: number;
    dustParticleCount: number;
    muzzleSparkCount: number;
    showShockwave: boolean;
    // Post-processing
    bloomEnabled: boolean;
    bloomStrength: number;
    vignetteEnabled: boolean;
    chromaticEnabled: boolean;
    // Environment
    fogEnabled: boolean;
    fogDensity: number;
    // Shake
    shakeScale: number;
    // Render
    resolutionScale: number;
}

const TIERS: Record<QualityTier, QualityConfig> = {
    high: {
        tier: 'high',
        impactParticleCount: 12,
        explosionParticleCount: 30,
        deathParticleCount: 20,
        dustParticleCount: 50,
        muzzleSparkCount: 6,
        showShockwave: true,
        bloomEnabled: true,
        bloomStrength: 0.8,
        vignetteEnabled: true,
        chromaticEnabled: true,
        fogEnabled: true,
        fogDensity: 0.015,
        shakeScale: 1.0,
        resolutionScale: 1.0,
    },
    medium: {
        tier: 'medium',
        impactParticleCount: 8,
        explosionParticleCount: 15,
        deathParticleCount: 10,
        dustParticleCount: 20,
        muzzleSparkCount: 4,
        showShockwave: true,
        bloomEnabled: true,
        bloomStrength: 0.4,
        vignetteEnabled: true,
        chromaticEnabled: false,
        fogEnabled: true,
        fogDensity: 0.008,
        shakeScale: 0.5,
        resolutionScale: 1.0,
    },
    low: {
        tier: 'low',
        impactParticleCount: 4,
        explosionParticleCount: 8,
        deathParticleCount: 0, // flash only
        dustParticleCount: 0,
        muzzleSparkCount: 2,
        showShockwave: false,
        bloomEnabled: false,
        bloomStrength: 0,
        vignetteEnabled: false,
        chromaticEnabled: false,
        fogEnabled: false,
        fogDensity: 0,
        shakeScale: 0.25,
        resolutionScale: 0.75,
    },
};

const STORAGE_KEY = 'arena_quality';

function detectTier(): QualityTier {
    if (typeof window === 'undefined') return 'high';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in TIERS) return saved as QualityTier;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmall = window.innerWidth <= 768;
    if (isSmall) return 'low';
    if (isTouch) return 'medium';
    return 'high';
}

export const QualitySettings = {
    current: { ...TIERS[detectTier()] },

    setTier(tier: QualityTier): void {
        Object.assign(this.current, TIERS[tier]);
        localStorage.setItem(STORAGE_KEY, tier);
    },

    reset(): void {
        Object.assign(this.current, TIERS[detectTier()]);
    },
};
```

- [ ] **Step 3: Run test, verify pass**

Run: `cd arena/frontend && npx vitest run src/services/QualitySettings.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd arena && git add frontend/src/services/QualitySettings.ts frontend/src/services/QualitySettings.test.ts
git commit -m "feat(arena): add quality settings system with three tiers and auto-detection"
```

---

### Task 12: Post-Processing Pipeline

**Files:**
- Create: `arena/frontend/src/services/PostProcessing.ts`
- Create: `arena/frontend/src/services/PostProcessing.test.ts`
- Modify: `arena/frontend/src/services/GameRenderer3D.ts`

- [ ] **Step 1: Write PostProcessing test**

```typescript
// arena/frontend/src/services/PostProcessing.test.ts
import { describe, it, expect, vi } from 'vitest';

// Mock Three.js post-processing addons (jsdom has no WebGL)
vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
    EffectComposer: class {
        addPass = vi.fn();
        setSize = vi.fn();
        render = vi.fn();
        dispose = vi.fn();
        passes: any[] = [];
    },
}));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({
    RenderPass: class { enabled = true; },
}));
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
    UnrealBloomPass: class {
        enabled = true;
        strength = 0;
        constructor(_res: any, s: number) { this.strength = s; }
    },
}));
vi.mock('three/addons/postprocessing/ShaderPass.js', () => ({
    ShaderPass: class {
        enabled = true;
        uniforms: Record<string, any> = {};
    },
}));

import { PostProcessing } from './PostProcessing';
import { Scene, WebGLRenderer, OrthographicCamera } from 'three';
import { QualitySettings } from './QualitySettings';

describe('PostProcessing', () => {
    it('creates without throwing', () => {
        QualitySettings.setTier('high');
        const renderer = new WebGLRenderer();
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        const pp = new PostProcessing(renderer, scene, camera);
        expect(pp).toBeDefined();
        pp.dispose();
        renderer.dispose();
    });

    it('render calls effectComposer.render', () => {
        const renderer = new WebGLRenderer();
        const scene = new Scene();
        const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        const pp = new PostProcessing(renderer, scene, camera);
        pp.render();
        // The composer's render was called
        expect(pp['composer'].render).toHaveBeenCalled();
        pp.dispose();
        renderer.dispose();
    });
});
```

- [ ] **Step 2: Run test, verify failure, implement**

```typescript
// arena/frontend/src/services/PostProcessing.ts
import { WebGLRenderer, Scene, Vector2 } from 'three';
import type { OrthographicCamera } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { QualitySettings } from './QualitySettings';

// Simple vignette shader
const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.0 },
        darkness: { value: 1.2 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            gl_FragColor = vec4(mix(texel.rgb, vec3(1.0 - darkness), dot(uv, uv)), texel.a);
        }
    `,
};

// Chromatic aberration shader
const ChromaticShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.0 },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        void main() {
            float r = texture2D(tDiffuse, vUv + vec2(amount, 0.0)).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - vec2(amount, 0.0)).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `,
};

export class PostProcessing {
    private readonly composer: EffectComposer;
    private readonly bloomPass: UnrealBloomPass;
    private readonly vignettePass: ShaderPass;
    private readonly chromaticPass: ShaderPass;

    constructor(renderer: WebGLRenderer, scene: Scene, camera: OrthographicCamera) {
        const q = QualitySettings.current;
        const size = renderer.getSize(new Vector2());

        this.composer = new EffectComposer(renderer);
        this.composer.addPass(new RenderPass(scene, camera));

        this.bloomPass = new UnrealBloomPass(size, q.bloomStrength, 0.4, 0.6);
        this.bloomPass.enabled = q.bloomEnabled;
        this.composer.addPass(this.bloomPass);

        this.vignettePass = new ShaderPass(VignetteShader);
        this.vignettePass.enabled = q.vignetteEnabled;
        this.composer.addPass(this.vignettePass);

        this.chromaticPass = new ShaderPass(ChromaticShader);
        this.chromaticPass.enabled = false; // triggered only on damage
        this.composer.addPass(this.chromaticPass);
    }

    render(): void {
        this.composer.render();
    }

    /** Trigger chromatic aberration (called by VFXManager on damage). */
    setChromatic(amount: number): void {
        if (!QualitySettings.current.chromaticEnabled) return;
        this.chromaticPass.enabled = amount > 0;
        this.chromaticPass.uniforms['amount'].value = amount;
    }

    /** Update pass states when quality tier changes. */
    applyQuality(): void {
        const q = QualitySettings.current;
        this.bloomPass.enabled = q.bloomEnabled;
        this.bloomPass.strength = q.bloomStrength;
        this.vignettePass.enabled = q.vignetteEnabled;
    }

    resize(width: number, height: number): void {
        this.composer.setSize(width, height);
    }

    dispose(): void {
        this.composer.dispose();
    }
}
```

- [ ] **Step 3: Run test, verify pass**

Run: `cd arena/frontend && npx vitest run src/services/PostProcessing.test.ts`
Expected: PASS

- [ ] **Step 4: Integrate into GameRenderer3D**

Modify `arena/frontend/src/services/GameRenderer3D.ts`:

Add field: `private postProcessing: PostProcessing | null = null;`

Add method:
```typescript
/** Initialize post-processing pipeline. */
initPostProcessing(): PostProcessing {
    const pp = new PostProcessing(this.renderer, this.scene, this.camera);
    this.postProcessing = pp;
    return pp;
}
```

Update `render()`:
```typescript
render(): void {
    if (this.postProcessing) {
        this.postProcessing.render();
    } else {
        this.renderer.render(this.scene, this.camera);
    }
    this.labelRenderer.render(this.scene, this.camera);
}
```

Update `resize()` — add after `this.labelRenderer.setSize(w, h)`:
```typescript
this.postProcessing?.resize(w, h);
```

Update `dispose()` — add before `this.renderer.dispose()`:
```typescript
this.postProcessing?.dispose();
```

- [ ] **Step 5: Initialize PostProcessing in Game3D.tsx**

In the setup useEffect, after `rendererRef.current = r`:
```typescript
const pp = r.initPostProcessing();
```

- [ ] **Step 6: Run all tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
cd arena && git add frontend/src/services/PostProcessing.ts frontend/src/services/PostProcessing.test.ts frontend/src/services/GameRenderer3D.ts frontend/src/components/Game3D.tsx
git commit -m "feat(arena): add post-processing pipeline with bloom, vignette, and chromatic aberration"
```

---

### Task 13: Replace Temporary Quality Guards with QualitySettings

**Files:**
- Modify: `arena/frontend/src/services/VFXManager.ts`
- Modify: `arena/frontend/src/services/effects/ImpactEffect.ts`
- Modify: `arena/frontend/src/services/effects/ExplosionEffect.ts`
- Modify: `arena/frontend/src/services/effects/MuzzleFlashEffect.ts`
- Modify: `arena/frontend/src/services/effects/DeathEffect.ts`
- Modify: `arena/frontend/src/services/effects/AtmosphereEffect.ts`

- [ ] **Step 1: Replace PARTICLE_SCALE with QualitySettings reads**

In each effect file, replace:
```typescript
import { PARTICLE_SCALE } from '../VFXManager';
// ...
const count = Math.round(BASE_COUNT * PARTICLE_SCALE);
```

With:
```typescript
import { QualitySettings } from '../QualitySettings';
// ...
// Use the specific count from QualitySettings:
const count = QualitySettings.current.impactParticleCount; // in ImpactEffect
const count = QualitySettings.current.explosionParticleCount; // in ExplosionEffect
const count = QualitySettings.current.muzzleSparkCount; // in MuzzleFlashEffect
const count = QualitySettings.current.deathParticleCount; // in DeathEffect
const count = QualitySettings.current.dustParticleCount; // in AtmosphereEffect
```

In VFXManager.ts, replace `isMobile` shake scale with:
```typescript
import { QualitySettings } from './QualitySettings';
// In triggerShake:
const scale = QualitySettings.current.shakeScale;
```

Remove `PARTICLE_SCALE` export from VFXManager.ts.

In AtmosphereEffect.ts, replace `isMobile` fog check with:
```typescript
if (QualitySettings.current.fogEnabled) {
    scene.fog = new FogExp2(0x0a0b1a, QualitySettings.current.fogDensity);
}
```

In ExplosionEffect.ts, conditionally skip shockwave:
```typescript
if (QualitySettings.current.showShockwave) {
    // create shockwave mesh
}
```

- [ ] **Step 2: Run all tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd arena && git add frontend/src/services/VFXManager.ts frontend/src/services/effects/ImpactEffect.ts frontend/src/services/effects/ExplosionEffect.ts frontend/src/services/effects/MuzzleFlashEffect.ts frontend/src/services/effects/DeathEffect.ts frontend/src/services/effects/AtmosphereEffect.ts
git commit -m "refactor(arena): replace temporary mobile guards with QualitySettings tier system"
```

---

### Task 14: Settings Panel UI

**Files:**
- Create: `arena/frontend/src/components/SettingsPanel.tsx`

- [ ] **Step 1: Create SettingsPanel component**

```typescript
// arena/frontend/src/components/SettingsPanel.tsx
import { useState } from 'react';
import { QualitySettings, type QualityTier } from '../services/QualitySettings';

const LABELS: Record<QualityTier, string> = {
    high: '🖥️ High',
    medium: '📱 Medium',
    low: '🔋 Low',
};

export function SettingsPanel({ onClose }: { onClose?: () => void }) {
    const [tier, setTier] = useState<QualityTier>(QualitySettings.current.tier);

    const handleChange = (newTier: QualityTier) => {
        QualitySettings.setTier(newTier);
        setTier(newTier);
    };

    return (
        <div style={{
            background: 'rgba(10, 11, 26, 0.95)',
            border: '1px solid rgba(0, 242, 255, 0.3)',
            borderRadius: 8,
            padding: 16,
            minWidth: 200,
        }}>
            <div style={{ color: '#00f2ff', fontWeight: 600, marginBottom: 8 }}>
                Graphics Quality
            </div>
            {(['high', 'medium', 'low'] as const).map((t) => (
                <label key={t} style={{
                    display: 'block',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    color: tier === t ? '#00f2ff' : '#888',
                    background: tier === t ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
                    borderRadius: 4,
                    marginBottom: 2,
                }}>
                    <input
                        type="radio"
                        name="quality"
                        checked={tier === t}
                        onChange={() => handleChange(t)}
                        style={{ marginRight: 8 }}
                    />
                    {LABELS[t]}
                </label>
            ))}
            {onClose && (
                <button
                    onClick={onClose}
                    style={{
                        marginTop: 8,
                        background: 'rgba(0, 242, 255, 0.15)',
                        border: '1px solid rgba(0, 242, 255, 0.3)',
                        color: '#00f2ff',
                        borderRadius: 4,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        width: '100%',
                    }}
                >
                    Close
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Wire into GameHUD as gear icon**

This is a UI integration task — add a gear icon button to GameHUD that toggles SettingsPanel visibility. The exact integration depends on GameHUD's current structure. Read `arena/frontend/src/components/GameHUD.tsx` and add a `useState<boolean>` toggle for showing the panel, positioned in the top-right corner.

- [ ] **Step 3: Run all tests, commit**

Run: `cd arena/frontend && npx vitest run`

```bash
cd arena && git add frontend/src/components/SettingsPanel.tsx frontend/src/components/GameHUD.tsx
git commit -m "feat(arena): add quality settings panel with gear icon in HUD"
```

---

### Task 15: FPS Probe Auto-Downgrade

**Files:**
- Modify: `arena/frontend/src/components/Game3D.tsx`

- [ ] **Step 1: Add FPS probe in animation loop**

In Game3D.tsx, inside the setup useEffect, add before the `animate` function:

```typescript
let frameCount = 0;
let fpsAccum = 0;
let probeComplete = false;
```

In the animation loop, after `const delta = clockRef.current.getDelta()`:
```typescript
if (!probeComplete && delta > 0) {
    frameCount++;
    fpsAccum += 1 / delta;
    if (frameCount >= 60) {
        const avgFps = fpsAccum / frameCount;
        const currentTier = QualitySettings.current.tier;
        if (avgFps < 30 && currentTier !== 'low') {
            QualitySettings.setTier('low');
            pp.applyQuality();
        } else if (avgFps < 45 && currentTier === 'high') {
            QualitySettings.setTier('medium');
            pp.applyQuality();
        }
        probeComplete = true;
    }
}
```

- [ ] **Step 2: Run all tests, commit**

Run: `cd arena/frontend && npx vitest run`

```bash
cd arena && git add frontend/src/components/Game3D.tsx
git commit -m "feat(arena): add FPS probe auto-downgrade in first 60 frames"
```

---

### Task 16: Final Integration Test

- [ ] **Step 1: Run full test suite**

Run: `cd arena/frontend && npx vitest run`
Run: `cd arena/backend && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Build check**

Run: `cd arena && npm run build:all`
Expected: Build succeeds without TypeScript errors

- [ ] **Step 3: Typecheck**

Run: `cd arena && npm run typecheck`
Expected: No type errors

- [ ] **Step 4: Commit any fixups**

If any issues found, fix and commit.

- [ ] **Step 5: Final commit summarizing Wave 1-3 completion**

Only if there are remaining uncommitted fixes:
```bash
cd arena && git add -A && git commit -m "fix(arena): resolve integration issues from VFX upgrade"
```
