# Arena 3D Visual & Performance Upgrade — Design Spec

## Overview

Comprehensive visual upgrade for the Arena 3D renderer (Three.js), adding combat VFX, environmental atmosphere, post-processing, and a quality settings system. Delivered in three waves by priority.

**Renderer target:** Three.js 0.170.0 (3D isometric mode only — PixiJS 2D untouched)
**Player count:** 2-8 players, desktop + mobile with quality tiers
**Visual style:** Cyberpunk/neon — dark background (`0x0a0b1a`), selective bloom on emissive objects, neon particle colors
**Current 3D state:** 85% feature-complete for gameplay, zero VFX/post-processing

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Renderer target | Three.js 3D only | User's chosen direction; 2D is maintenance mode |
| Delivery strategy | Phased rollout (3 waves) | Highest-impact features ship first; each wave independently deployable |
| Visual style | Cyberpunk/neon | Matches existing palette; bloom makes it pop |
| Post-processing | Selective bloom + vignette + triggered chromatic aberration | Bloom is biggest single visual upgrade; chromatic aberration adds damage punch |
| Particle system | Custom (raw Three.js Points/InstancedMesh) | Effect specs use Three.js primitives directly; no library overhead, full control |
| Quality tiers | High / Medium / Low with auto-detection + manual override | Desktop + mobile support requires adaptive quality |

## Wave 1: Combat Juice

**Goal:** Make every shot, explosion, and hit feel impactful.
**Features:** Hit/impact VFX, explosion VFX, muzzle flash, screen shake.
**Backend changes:** Wire `explosion` socket event listener (event already exists but isn't consumed by frontend).

### Architecture

New `VFXManager` service coordinates all effects:

```
Game3D.tsx (animation loop)
  │
  ├─ vfxManager.update(delta)          ← ticks all active effects
  │
  ├─ ProjectileRenderer.ts
  │    └─ onProjectileRemoved(pos, type) → vfxManager.spawnImpact(pos, type)
  │    └─ onProjectileCreated(pos, angle) → vfxManager.spawnMuzzleFlash(pos, angle)
  │
  └─ useGameSockets.ts
       └─ socket.on('explosion')       → vfxManager.spawnExplosion(pos, radius)
       └─ socket.on('player-hit')      → vfxManager.triggerScreenShake('hit')
```

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/services/VFXManager.ts` | Central effect coordinator — owns effect group, update loop, quality guards |
| `frontend/src/services/effects/ImpactEffect.ts` | Bullet hit sparks |
| `frontend/src/services/effects/ExplosionEffect.ts` | Grenade detonation with shockwave |
| `frontend/src/services/effects/MuzzleFlashEffect.ts` | Weapon fire flash |
| `frontend/src/services/effects/ScreenShake.ts` | Camera displacement on hits/explosions |

### Effect Specifications

#### Bullet Impact (on projectile removal from state)
- 8-12 `Points` particles burst outward from hit position
- Color: `0xffee66` (matching bullet material) with emissive glow
- Velocity: Random hemisphere spread, 2-4 world units/sec
- Lifetime: 300ms with fade-out over last 100ms
- Size: 0.05 world units, shrinking to 0

#### Grenade Explosion (on `explosion` socket event)
- Expanding torus ring (shockwave): starts at 0 radius, expands to `explosion.radius` over 400ms
- 20-30 debris particles: warm orange/red (`0xff6600` → `0xff2200`), scattered radially
- Point light flash: white, intensity 3→0 over 200ms, range = explosion radius
- Screen shake triggered simultaneously
- Total lifetime: 600ms

#### Muzzle Flash (on bullet projectile creation)
- Billboard sprite: white-yellow flash, 0.3 world units, oriented at fire angle
- 4-6 tiny spark points ejected forward in cone
- Lifetime: 80-120ms (1-2 frames at 60fps)

#### Screen Shake
- On hit taken: 0.15 world unit displacement, 200ms sine decay
- On nearby explosion: 0.4 world unit displacement, 400ms random jitter decay
- Applied as offset to camera position in `GameRenderer3D.updateCamera()`
- Mobile: reduced by 50%

### Integration Changes (Existing Files)

- **`GameRenderer3D.ts`**: Add `effectGroup: Group` to scene, expose `applyCameraShake(offset: Vector3)` method
- **`ProjectileRenderer.ts`**: Accept `onRemoved(pos, type)` and `onCreated(pos, angle)` callbacks, invoke during `update()`
- **`Game3D.tsx`**: Instantiate `VFXManager`, call `vfxManager.update(delta)` in animation loop
- **`useGameSockets.ts`**: Add `socket.on('explosion', ...)` listener, pass VFX callback props

### Temporary Quality Guard (Replaced in Wave 3)

```typescript
const isMobile = 'ontouchstart' in window;
const PARTICLE_SCALE = isMobile ? 0.5 : 1.0;
```

### Dependencies

- No new dependencies — all effects use raw Three.js primitives (`Points`, `PointsMaterial`, `Mesh`, `ShaderMaterial`, billboard `Sprite`). This keeps the bundle lean and avoids abstraction mismatch.

---

## Wave 2: Polish

**Goal:** Make the world feel alive between combat moments.
**Features:** Death effects, environmental atmosphere, damage numbers.
**Backend changes:** The `player-hit` event already emits `{ targetId, attackerId, damage, remainingHp, hasArmor }` from the backend — the frontend currently ignores this payload. Wave 2 needs two changes: (1) **frontend**: accept the existing payload in `useGameSockets.ts` (change `socket.on('player-hit', () => ...)` to `socket.on('player-hit', (data) => ...)`), (2) **backend**: add `x` and `y` coordinates to the existing `player-hit` emission so damage numbers can be positioned in world space.

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/services/effects/DeathEffect.ts` | Dissolve + rising particles on player death |
| `frontend/src/services/effects/AtmosphereEffect.ts` | Dust motes, fog, grid floor glow |
| `frontend/src/services/effects/DamageNumber.ts` | Floating combat text via CSS2DRenderer |

### Effect Specifications

#### Death Effect — Cyberpunk Dissolve (on player death in PlayerRenderer)

| Phase | Time | What Happens |
|-------|------|-------------|
| Flash | 0-100ms | Capsule/model material `emissive` → `0xff2200` |
| Dissolve | 100-400ms | Opacity fades to 0, 15-20 particles rise upward in character color (from `CHAR_COLORS`) |
| Fade | 400-600ms | Remaining particles drift up and fade out |

- Uses character color from `CHAR_COLORS` for particle tint (each character's death looks unique)
- Mobile: 8 particles instead of 20

#### Environmental Atmosphere (one-time setup in GameRenderer3D constructor)

- **Dust motes**: Single `Points` geometry, 30-50 vertices, slow random drift (0.1-0.3 units/sec), faint white/cyan, opacity 0.1-0.2
- **Ground fog**: `THREE.FogExp2`, density 0.015, color `0x0a0b1a` (matches background)
- **Grid floor glow**: Replace current green `PlaneGeometry` floor with `LineSegments` grid, emissive cyan at 0.05 intensity — synthwave aesthetic
- Mobile: 15 dust particles, no fog

#### Damage Numbers (floating combat text)

- Uses `CSS2DObject` (same as player name labels in `LabelRenderer.ts`)
- **Scene parenting:** Each `DamageNumber` creates a `CSS2DObject` and adds it directly to `scene` for organizational clarity, separate from WebGL effect geometry in `effectGroup` (CSS2DObjects work in child Groups too, as `LabelRenderer` demonstrates, but keeping them at scene level avoids coupling to the effect lifecycle)
- **Lifecycle:** `DamageNumber` tracks its own elapsed time. `VFXManager.update(delta)` calls `damageNumber.update(delta)` each frame. When lifetime expires, `DamageNumber.dispose()` removes the `CSS2DObject` from the scene and the DOM element from its parent
- Float upward 1.5 world units over 800ms, fade out over last 300ms
- Color coding: Red (`#ff4d6d`) for damage, cyan (`#38bdf8`) for armor-absorbed, green (`#3eff8b`) for heals
- Font size scales with damage amount: 15hp = small, 45hp = large bold
- Always on (cheap — just CSS2D elements)

### Integration Changes (Existing Files)

- **`PlayerRenderer.ts`**: Call `vfxManager.spawnDeath(position, characterColor)` in `!livePlayers.has(id)` block before removing player
- **`GameRenderer3D.ts`**: Add `FogExp2` in constructor, replace floor `PlaneGeometry` with `LineSegments` grid
- **`useGameSockets.ts`**: Accept existing `player-hit` payload `(data) => ...` instead of `() => ...`, pass `data.damage`, `data.targetId` to VFX callbacks
- **Backend (`arena-backend`)**: Add `x: number, y: number` to existing `player-hit` emission (all other fields — `targetId`, `attackerId`, `damage`, `remainingHp`, `hasArmor` — already sent)

---

## Wave 3: Rendering Infrastructure

**Goal:** Post-processing that makes neon glow, plus a quality settings system for all devices.
**Features:** EffectComposer pipeline, quality presets (High/Medium/Low), auto-detection + FPS probe.

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/services/PostProcessing.ts` | EffectComposer setup, pass management, dynamic enable/disable |
| `frontend/src/services/QualitySettings.ts` | Singleton quality tier manager with auto-detection + localStorage persistence |
| `frontend/src/components/SettingsPanel.tsx` | UI for quality preset selection — renders as a dropdown in the lobby screen (alongside existing character select). In-game, accessible via a gear icon in GameHUD. |

### Post-Processing Pipeline

Replaces `renderer.render(scene, camera)` inside `GameRenderer3D.render()` (called from the animation loop in `Game3D.tsx`):

| Order | Pass | Purpose | Tiers |
|-------|------|---------|-------|
| 1 | `RenderPass` | Scene → framebuffer | All (required) |
| 2 | `UnrealBloomPass` | Selective neon glow on emissive materials | High (strength 0.8) + Medium (strength 0.4) |
| 3 | Vignette `ShaderPass` | Darkened edges for cinematic focus | High + Medium |
| 4 | Chromatic Aberration `ShaderPass` | RGB channel split on damage (triggered, not always-on) | High only |

Bloom parameters: `strength: 0.8, radius: 0.4, threshold: 0.6` — only emissive objects glow.

`labelRenderer.render()` stays AFTER EffectComposer so CSS2D labels (names, damage numbers) are not bloomed.

### Quality Tiers

| Feature | High (Desktop) | Medium (Tablet) | Low (Mobile) |
|---------|---------------|-----------------|-------------|
| Bloom | strength 0.8 | strength 0.4 | Off |
| Vignette | On | On | Off |
| Chromatic aberration | On damage | Off | Off |
| Impact particles | 12 | 8 | 4 |
| Explosion particles | 30 + shockwave | 15 + shockwave | 8, no shockwave |
| Death dissolve particles | 20 + flash | 10 + flash | Flash only |
| Dust motes | 50 | 20 | Off |
| Fog | FogExp2 (0.015) | FogExp2 (0.008) | Off |
| Screen shake | 100% | 50% | 25% |
| Damage numbers | On | On | On |
| Render resolution | 1× DPR | 1× DPR | 0.75× DPR |

### Auto-Detection Flow

1. **Device heuristic** (first load): Touch device → Medium. Mobile viewport (≤768px) → Low. Otherwise → High.
2. **FPS probe** (first 60 frames of gameplay): If avg FPS < 45 → downgrade one tier. If < 30 on Medium → downgrade to Low.
3. **Manual override**: Player selects tier in `SettingsPanel`, persisted to `localStorage('arena_quality')`. Overrides auto-detection permanently.

### Retroactive Integration

All hardcoded particle counts and `isMobile` guards from Wave 1+2 are replaced with `QualitySettings.current.*` reads:

```typescript
// Before (Wave 1 temporary):
const count = isMobile ? 6 : 12;

// After (Wave 3):
const count = QualitySettings.current.impactParticleCount;
```

### Integration Changes (Existing Files)

- **`GameRenderer3D.ts`**: Replace `renderer.render()` with `postProcessing.render()`, add resize hook for EffectComposer
- **All effect files** (Wave 1+2): Replace hardcoded constants with `QualitySettings.current.*`
- **`Game3D.tsx`**: Initialize `PostProcessing`, run FPS probe during first 60 frames
- **`VFXManager.ts`**: Add `setChromatic(intensity: number)` for damage-triggered aberration

---

## Full File Inventory

### New Files (11 total)

| Wave | File | Lines (est.) |
|------|------|-------------|
| 1 | `frontend/src/services/VFXManager.ts` | ~120 |
| 1 | `frontend/src/services/effects/ImpactEffect.ts` | ~80 |
| 1 | `frontend/src/services/effects/ExplosionEffect.ts` | ~100 |
| 1 | `frontend/src/services/effects/MuzzleFlashEffect.ts` | ~60 |
| 1 | `frontend/src/services/effects/ScreenShake.ts` | ~50 |
| 2 | `frontend/src/services/effects/DeathEffect.ts` | ~90 |
| 2 | `frontend/src/services/effects/AtmosphereEffect.ts` | ~80 |
| 2 | `frontend/src/services/effects/DamageNumber.ts` | ~70 |
| 3 | `frontend/src/services/PostProcessing.ts` | ~100 |
| 3 | `frontend/src/services/QualitySettings.ts` | ~80 |
| 3 | `frontend/src/components/SettingsPanel.tsx` | ~60 |

### Modified Files (per wave)

**Wave 1:**
- `frontend/src/services/GameRenderer3D.ts` — add effectGroup, applyCameraShake()
- `frontend/src/services/ProjectileRenderer.ts` — add onRemoved/onCreated callbacks
- `frontend/src/components/Game3D.tsx` — instantiate VFXManager, call update(delta)
- `frontend/src/hooks/useGameSockets.ts` — add explosion listener, pass VFX callbacks

**Wave 2:**
- `frontend/src/services/PlayerRenderer.ts` — call vfxManager.spawnDeath() on player death
- `frontend/src/services/GameRenderer3D.ts` — add FogExp2, replace floor with grid lines
- `frontend/src/hooks/useGameSockets.ts` — expand player-hit handler with damage data
- Backend: enrich player-hit event payload

**Wave 3:**
- `frontend/src/services/GameRenderer3D.ts` — replace renderer.render() with postProcessing.render()
- All effect files from Wave 1+2 — replace hardcoded constants with QualitySettings reads
- `frontend/src/components/Game3D.tsx` — initialize PostProcessing, FPS probe
- `frontend/src/services/VFXManager.ts` — add setChromatic() method

## Color Palette Reference

| Element | Hex | Usage |
|---------|-----|-------|
| Background | `0x0a0b1a` | Scene clear, fog color |
| Bullet | `0xffee66` | Impact particles, muzzle flash |
| Explosion core | `0xff6600` | Grenade debris |
| Explosion edge | `0xff2200` | Outer debris, death flash |
| Cyan (student) | `0x00f2ff` | Grid glow, dust tint, default character |
| Green (researcher) | `0x3eff8b` | Heal numbers |
| Purple (professor) | `0xbc13fe` | Character death tint |
| Gold (dean) | `0xffd700` | Character death tint |
| Pink (librarian) | `0xff6b9d` | Character death tint |
| Damage text | `#ff4d6d` | Floating damage numbers |
| Armor text | `#38bdf8` | Armor-absorbed numbers |
| Shockwave ring | `0x00f2ff` | Explosion shockwave (cyan) |

## Non-Goals

- PixiJS 2D renderer upgrades (out of scope)
- New gameplay mechanics or weapons
- Backend game logic changes (except adding `x, y` to existing `player-hit` emission)
- Audio changes (existing SFX sufficient)
- Minimap or zoom controls (separate feature)
