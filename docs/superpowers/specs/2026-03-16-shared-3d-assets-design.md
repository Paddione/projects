# Shared 3D Asset System — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Scope:** Cross-project 3D rendering for Arena (isometric ARPG) and L2P (animated quiz characters)

## Problem Statement

Arena and L2P both use flat 2D representations for characters (PixiJS sprites and emoji/SVG respectively). The user wants:

1. **Shared 3D assets** — characters, items, and cover objects served from a common library, consumed by both projects
2. **Arena: Isometric ARPG gameplay** — Diablo-style 3D world with angled camera, 3D terrain, animated character models
3. **L2P: Animated 3D quiz characters** — characters react to answers, perform emotes, and appear in lobby/results/duel scenes

## Current State

| System | Rendering | Character Assets | Animation |
|--------|-----------|-----------------|-----------|
| **Arena** | PixiJS 2D sprites (7.4.2), 60fps game loop | 4 static GLB models (warrior, rogue, mage, tank) + 2D sprite atlases | Pre-rendered 8-direction sprites, no skeletal animation |
| **L2P** | Pure DOM/CSS, no canvas | Emoji + optional SVG icons | CSS keyframe animations only |
| **Assetgenerator** | Three.js preview viewer | Produces static GLB via TripoSR/Meshy | No rigging or animation pipeline |

### Key Gap

The existing GLB models are **static meshes** with no skeleton or animation clips. The Assetgenerator pipeline stops at model generation — there's no rigging or animation phase.

## Architecture

### Approach: Shared Three.js Core + Dual Integration

**Rationale:** Arena's 60fps game loop needs imperative Three.js for performance (no React reconciler overhead). L2P's quiz UI is React-heavy and benefits from React Three Fiber's declarative model. A shared vanilla-JS core library provides model loading, animation, and asset management to both.

### System Diagram

```
Assetgenerator Pipeline (extended)
  concept → model → RIG → ANIMATE → export
                     ↓
           /mnt/pve3a/visual-library/
           ├── models/        (static GLB, existing)
           ├── rigged/        (GLB + skeleton, NEW)
           └── animations/    (clip library, NEW)
                     ↓
         shared-3d/ (npm local package)
         ├── loader.ts        — GLB + Draco loading, LRU cache
         ├── animator.ts      — AnimationMixer wrapper, clip management, emote queue/blend
         ├── cameras.ts       — Isometric, presentation, orbit presets
         ├── lighting.ts      — Arena/quiz/lobby lighting rigs
         └── types.ts         — Shared interfaces
                     ↓
        ┌────────────┴────────────┐
        ▼                         ▼
   Arena (Three.js direct)   L2P (React Three Fiber)
   Imperative game loop      Declarative scene components
```

### Package Structure

```
shared-infrastructure/shared/3d/
├── package.json          # "shared-3d", type: module
├── tsconfig.json
├── src/
│   ├── index.ts          # Public API
│   ├── loader.ts         # ModelLoader (GLTFLoader + DRACOLoader + cache)
│   ├── animator.ts       # AnimationController (mixer, clip mgmt, blending, emote queue)
│   ├── cameras.ts        # createIsometricCamera, createPresentationCamera, createOrbitCamera
│   ├── lighting.ts       # createArenaLighting, createQuizLighting, createLobbyLighting
│   ├── characters.ts     # CharacterManager (see Cloning Strategy below)
│   └── types.ts          # SharedCharacter, AnimationClip, EmoteDefinition, etc.
├── assets/
│   └── animations/       # Shared animation clips (FBX→GLB converted from Mixamo)
└── dist/                 # Built output (tsup, ESM + CJS)
```

**Build tooling:** `tsup` bundles the package to `dist/` (ESM + CJS). Consumers import from the built output. The `prebuild` script in consumer `package.json` triggers the shared-3d build (same pattern as the existing `error-handling` package in `shared/l2p/`).

**Integration pattern** (same as existing L2P shared modules):
```json
// arena/frontend/package.json
{
  "shared-3d": "file:../../shared-infrastructure/shared/3d",
  "scripts": {
    "prebuild": "npm --prefix ../../shared-infrastructure/shared/3d run build"
  }
}

// l2p/frontend/package.json
{
  "shared-3d": "file:../../shared-infrastructure/shared/3d",
  "scripts": {
    "prebuild": "npm --prefix ../../shared-infrastructure/shared/3d run build"
  }
}
```

## Component: Assetgenerator Pipeline Extension

### New Phases: Rig + Animate

The visual pipeline currently has 4 phases: concept → model → render → pack. Two new phases are inserted after model:

| Phase | Tool | Input | Output |
|-------|------|-------|--------|
| **Rig** | Mixamo API (auto-rig) | Static GLB mesh | GLB with humanoid skeleton (65 joints) |
| **Animate** | Mixamo library + Blender cleanup | Rigged GLB + animation clip IDs | GLB with embedded animation clips |

### Animation Clip Library

Standard clips per character (mapped to both Arena and L2P needs):

| Clip Name | Arena Use | L2P Use | Duration | Loop |
|-----------|-----------|---------|----------|------|
| `idle` | Standing still | Default pose in all scenes | 2-4s | Yes |
| `walk` | Player movement | — | 0.8s | Yes |
| `run` | Sprint movement | — | 0.6s | Yes |
| `shoot` | Ranged attack | — | 0.5s | No |
| `melee` | Melee attack | — | 0.6s | No |
| `throw` | Grenade launch | — | 0.8s | No |
| `hit_react` | Taking damage | Wrong answer reaction | 0.4s | No |
| `death` | Player eliminated | — | 1.2s | No |
| `victory` | Round win | Correct answer, results winner | 1.5s | No |
| `defeat` | Round loss | Results non-winner | 1.2s | No |
| `thinking` | — | Waiting for answer | 2s | Yes |
| `celebrate` | — | Streak milestone emote | 2s | No |
| `wave` | Emote | Emote (perk cosmetic) | 1.5s | No |
| `clap` | Emote | Emote (perk cosmetic) | 1.5s | No |
| `thumbsup` | Emote | Emote (perk cosmetic) | 1.2s | No |

### Rigging Integration in Assetgenerator

New adapter: `adapters/mixamo.js`

**Integration method:** Playwright browser automation against the Mixamo web UI (mixamo.com). Mixamo's public REST API was retired, but the web interface remains free and functional. The adapter automates: upload FBX/OBJ → auto-rig → select animations → download FBX.

**Fallback:** If Mixamo automation breaks (UI changes), fall back to Blender Rigify addon with a Python script (`scripts/auto_rig.py`) that adds a humanoid armature and auto-weights. This produces lower-quality rigs but keeps the pipeline unblocked.

**Pipeline integration:** Rig and Animate are new job types dispatched via the existing worker-manager WebSocket queue. The GPU worker spawns `blender --background --python scripts/auto_rig.py` (for Rigify fallback) or `node adapters/mixamo.js` (for Mixamo automation). The Assetgenerator server exposes them as:
- `POST /api/visual-library/:id/generate/rig` — dispatches rig job
- `POST /api/visual-library/:id/generate/animate` — dispatches animation job

**Workflow:**
1. Upload static GLB to Mixamo → receive rigged FBX
2. Apply animation clips by Mixamo animation IDs → download FBX per clip
3. Convert FBX → GLB via `gltf-transform` CLI
4. Optimize: Draco mesh compression, quantize animations
5. Store results in `/mnt/pve3a/visual-library/rigged/` and `/animations/`

### visual-config.json Changes

Merged with existing fields (preserving `directions`, `defaultPoses`, `size`, `conceptResolution`, `has3D`):

```json
{
  "categories": {
    "characters": {
      "directions": 8,
      "defaultPoses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
      "size": 64,
      "conceptResolution": 1024,
      "has3D": true,
      "hasRig": true,
      "hasAnimations": true,
      "animationClips": [
        "idle", "walk", "run", "shoot", "melee", "throw",
        "hit_react", "death", "victory", "defeat",
        "thinking", "celebrate", "wave", "clap", "thumbsup"
      ]
    }
  }
}
```

## Component: Arena 3D Isometric Renderer

### Camera Setup

**Orthographic camera** at 45deg pitch, 45deg yaw:
```
Position: (x + d, y + d, z + d) where d = viewDistance
Target: (playerX, 0, playerY)  // Y-up coordinate system
Projection: Orthographic (no perspective distortion)
Frustum: sized to show ~22 tile radius (matching current zoom)
```

Key properties:
- Player-centered (same as current PixiJS camera)
- Orthographic ensures consistent character sizes (critical for gameplay fairness)
- Zoom levels map to frustum size changes (not camera distance)
- Rotation locked (no user camera rotation — keeps UI consistent)

### Coordinate System Migration

Current (PixiJS 2D):
- World: `(x, y)` in pixels, origin top-left
- Tile: `(tx, ty)` → `(tx * 32, ty * 32)`

New (Three.js 3D, Y-up):
- World: `(x, 0, z)` — X right, Y up, Z forward
- Server sends `(x, y)` → client maps to `(x, 0, y)` (y becomes z)
- Height (Y axis) used for: projectile arcs, jump animations, cover height
- Tile size: 1 unit = 1 tile (not 32px) — camera frustum handles visual scaling

**No server changes required.** The backend continues sending 2D `(x, y)` coordinates. The frontend maps them to 3D space.

### Scene Graph

```
Scene
├── AmbientLight (soft, 0.3 intensity)
├── DirectionalLight (key, casting shadows, 45deg angle)
├── DirectionalLight (fill, opposite side, 0.4 intensity)
├── TerrainGroup
│   ├── FloorMesh (single plane with tiled texture, or instanced tiles)
│   ├── WallInstances (InstancedMesh for walls)
│   └── GridOverlay (optional, faint lines)
├── CoverGroup
│   ├── CoverModel[] (GLB instances: crate, bush, pillar, etc.)
│   └── DestructionVFX (particle system on cover destroy)
├── ItemGroup
│   ├── ItemModel[] (GLB: health_pack, armor_plate, etc.)
│   └── ItemGlow (point lights or emissive, bobbing animation)
├── ProjectileGroup
│   ├── BulletTrail[] (line geometry + glow material)
│   ├── GrenadeModel[] (GLB + arc trajectory)
│   └── ExplosionVFX (particle burst on impact)
├── PlayerGroup
│   ├── PlayerModel[] (rigged GLB, AnimationMixer per player)
│   ├── ArmorRing[] (torus geometry around armored players)
│   └── EmoteBubble[] (sprite above head, same as current)
├── NPCGroup
│   ├── NPCModel[] (zombie GLB with red tint)
│   └── EngagementRing (circle indicator)
├── ZoneOverlay
│   ├── DangerZoneMesh (red-tinted plane outside safe radius)
│   └── ZoneBorder (cylinder/torus at zone edge, animated)
└── LabelGroup (HTML overlay via CSS2DRenderer)
    ├── PlayerName[]
    ├── HPPips[]
    └── DamageNumbers[]
```

### Rendering Strategy

**Instanced rendering** for repeated geometry (tiles, walls, items) — single draw call per type.

**LOD (Level of Detail):**
- Characters close to camera: full mesh + animation
- Characters far from camera: simplified mesh, reduced animation update rate
- Off-screen characters: animation paused, no render

**Shadow mapping:**
- Single directional light casts shadows
- Shadow map: 2048x2048
- Only player and cover objects cast/receive shadows (tiles don't — too expensive)

**Performance budget (target: 60fps on mid-range GPU):**
- Max draw calls: ~100-150
- Max triangles: ~200K visible
- Character poly budget: ~5K tris each (×20 players = 100K)
- Terrain: single mesh or instanced (1 draw call)

### Coordinate Constants Migration

Changing from `1 tile = 32px` to `1 tile = 1 unit` requires updating frontend constants. The server is unaffected (sends abstract coordinates), but the frontend has hardcoded pixel values:

| Constant | Current (PixiJS) | New (Three.js) | Location |
|----------|-----------------|----------------|----------|
| `TILE_SIZE` | 32 (px) | 1.0 (unit) | Game.tsx → GameRenderer |
| Player sprite size | 28×28 px | Model scale ~0.8 units | renderPlayers → PlayerGroup |
| Item size | 20×20 px | Model scale ~0.4 units | renderItems → ItemGroup |
| Joystick radius | 50px (screen) | Unchanged (screen-space) | Input handler |
| Camera frustum | `22 * 32` px | 22 units | Camera setup |

A conversion constant `WORLD_SCALE = 1/32` bridges server coords to Three.js units: `threeX = serverX * WORLD_SCALE`.

### Migration Path (PixiJS → Three.js)

This is a **big-bang renderer swap**, not an incremental migration. PixiJS (2D canvas) and Three.js (WebGL) cannot share the same canvas, and running both simultaneously doubles GPU memory. The migration strategy:

1. **New `GameRenderer3D` class** built alongside existing `Game.tsx` (separate file)
2. **Feature flag** (`use3DRenderer` in gameStore) switches between `<Game />` and `<Game3D />`
3. **Parallel development**: 3D renderer built and tested while 2D remains in production
4. **Cutover**: once 3D renderer passes all 91 existing frontend tests + new visual tests, flip the flag and remove PixiJS
5. **Rollback**: flag can revert to 2D for one release cycle, then PixiJS code is deleted

**Layer-by-layer build order within the 3D renderer:**
1. Terrain + camera (playable with placeholder cubes)
2. Player models + animation
3. Cover objects + items
4. Projectiles + VFX
5. Zone overlay + labels (CSS2DRenderer)
6. HUD integration (React DOM overlay)

Each layer is testable independently. Socket event handling and input handling are unchanged — they feed data to whichever renderer is active.

**Fallback:** If WebGL2 unavailable, show a message (no 2D fallback — modern browsers all support WebGL2).

### New Arena Visual Features (enabled by 3D)

- **Dynamic shadows** from characters and cover
- **Projectile arcs** for grenades (parabolic trajectory visible)
- **Muzzle flash** as point light burst
- **Explosion particles** on grenade/death
- **Footstep dust** particles while moving
- **Zone fog** at edges (volumetric-lite with depth fade)
- **Cover destruction** animation (fragments fly apart)

## Component: L2P 3D Character Scenes

### Integration via React Three Fiber

L2P uses R3F (`@react-three/fiber` + `@react-three/drei`) for declarative 3D scenes within the existing React component tree.

### Scene: Quiz Character (GamePage)

**Placement:** Left pane, beside or below the question card (configurable).

```tsx
<Canvas style={{ width: 200, height: 250 }}>
  <QuizCharacterScene
    characterId={currentCharacter}
    animation={answerState}  // 'thinking' | 'victory' | 'hit_react'
    emote={activeEmote}      // triggered by perk cosmetics
  />
</Canvas>
```

**Behavior:**
- Default: `idle` animation
- Question displayed: transitions to `thinking`
- Correct answer: plays `victory`, then back to `idle`
- Wrong answer: plays `hit_react`, then back to `idle`
- Streak milestone (3/5/10): plays `celebrate`
- Perk emote trigger: plays corresponding emote clip

**Camera:** Fixed presentation angle (slightly below eye level, looking up at character). Subtle auto-orbit (0.5deg/sec).

**Lighting:** Soft 3-point (key + fill + rim) with character-colored rim light.

### Scene: Lobby Room (LobbyPage)

**Placement:** Replaces or augments the current PlayerGrid.

```tsx
<Canvas style={{ width: '100%', height: 300 }}>
  <LobbyRoomScene
    players={players}
    hostId={hostId}
  />
</Canvas>
```

**Layout:** Characters arranged in a semicircle on a stage/platform.
- Host: center position, spotlight from above
- Ready players: standing straight, confident pose
- Not-ready players: `idle` animation, looking around
- New player joins: character walks in from side
- Player leaves: character waves and walks off

### Scene: Results Podium (ResultsPage)

**Placement:** Above the rankings table, replaces the WinnerAnnouncement.

```tsx
<Canvas style={{ width: '100%', height: 350 }}>
  <PodiumScene
    winners={topThreePlayers}
    currentPlayerId={userId}
  />
</Canvas>
```

**Layout:** Classic 3-tier podium (1st center/tall, 2nd left, 3rd right).
- 1st place: `victory` animation, gold spotlight, particle confetti
- 2nd place: `clap` animation, silver lighting
- 3rd place: `wave` animation, bronze lighting
- Camera: slow orbit around podium

### Scene: Duel Arena (DuelView)

**Placement:** Replaces the current VS text divider in Duel mode.

```tsx
<Canvas style={{ width: '100%', height: 250 }}>
  <DuelArenaScene
    player1={duelPlayer1}
    player2={duelPlayer2}
    winner={duelWinner}
  />
</Canvas>
```

**Layout:** Two characters facing each other on a small arena.
- Pre-question: both in `idle`
- Question active: both in `thinking`
- Winner declared: winner plays `victory`, loser plays `defeat`
- Dramatic spotlight swings to winner

### Scene: Character Selector (ProfilePage + Arena Lobby)

**Shared component** used in both projects:

```tsx
<Canvas style={{ width: 300, height: 350 }}>
  <CharacterViewerScene
    characterId={selectedCharacter}
    animation="idle"
    enableOrbit={true}      // user can drag to rotate
    showEmoteButtons={true} // preview emotes
  />
</Canvas>
```

**Features:**
- Full orbit controls (drag to rotate)
- Skin variant switching (base, neon, formal)
- Emote preview buttons (click to play animation)
- Character name + level badge overlay
- Background: gradient matching character color

### Canvas Strategy: One Canvas Per Page

L2P uses **one R3F `<Canvas>` per page** (not one per scene or one global canvas):
- **GamePage**: single canvas for the quiz character scene
- **LobbyPage**: single canvas for the lobby room scene
- **ResultsPage**: single canvas for the podium scene

Only one page is mounted at a time (React Router), so there's never more than one active WebGL context. Scene switching within a page (e.g., quiz → duel in GamePage) swaps the scene content inside the same canvas, not the canvas itself.

This avoids the complexity of a global canvas with portal architecture while keeping GPU usage to one context.

### Mobile Optimization

L2P 3D scenes degrade gracefully on mobile:
- **Canvas size reduced** (150x200 instead of 200x250)
- **Animation update rate halved** (30fps instead of 60)
- **Shadow mapping disabled** on mobile
- **LOD models** loaded (lower poly count)
- **Lobby room** falls back to current 2D PlayerGrid on screens <480px

## Component: Shared Asset Delivery

### Asset Serving

Characters and animations served as static files from the Assetgenerator server or directly from the NAS mount:

**Development (local):**
- Arena/L2P dev servers proxy `/assets/3d/*` to file system at `/mnt/pve3a/visual-library/`

**Production (k8s):**
- 3D assets served from the **existing service frontends** (Arena and L2P), not a new hostname
- Arena: `https://arena.korczewski.de/assets/3d/{id}.glb` — served by nginx from a SMB-CSI volume mount
- L2P: `https://l2p.korczewski.de/assets/3d/{id}.glb` — same pattern
- Both point to the same underlying NAS path (`/mnt/pve3a/visual-library/`)
- No new IngressRoute, TLS cert, or service needed — just a `location /assets/3d/` block in each nginx config
- CDN-friendly: GLB files have long cache TTL (content-hash in filename)
- Draco-compressed: ~500KB-1MB per character (down from 2-4MB)

### Asset Manifest

New manifest format for 3D assets (extends existing `arena/assets/manifest.json`):

```json
{
  "characters": {
    "warrior": {
      "model": "characters/warrior.glb",
      "animations": {
        "idle": "animations/idle.glb",
        "walk": "animations/walk.glb",
        "shoot": "animations/shoot.glb"
      },
      "color": "#00f2ff",
      "variants": ["warrior_f", "warrior_neon", "warrior_formal"]
    }
  }
}
```

Animation clips can be **shared across characters** (Mixamo animations retarget to any humanoid skeleton). Only character-specific clips (death, victory with unique flair) need per-character files.

### Cloning Strategy (CharacterManager)

When multiple players share the same character type (e.g., 5 warriors in a 20-player Arena match), the `CharacterManager` uses `SkeletonUtils.clone()` from Three.js to create independent instances that share geometry/material GPU buffers but have separate skeletons and AnimationMixers:

```
CharacterManager.getCharacter(characterId: string): CharacterInstance
  → If model not loaded: load GLB, cache geometry + material
  → Clone via SkeletonUtils.clone(cachedModel)
  → Create new AnimationMixer for the clone
  → Return { mesh, mixer, playAnimation(name) }

CharacterManager.releaseCharacter(instance): void
  → Dispose mixer, remove from scene
  → Geometry/material stay cached (shared)
```

**LRU cache** holds max 20 unique model geometries (not instances). With 4-5 character types and 20 players, all geometries fit in cache. Instances (clones) are tracked separately and disposed when players leave.

### Preloading Strategy

1. **Critical path** (loaded before scene renders): character model + idle animation
2. **Eager** (loaded in background after scene renders): walk, run, shoot, melee
3. **Lazy** (loaded on demand): emotes, death, victory, hit_react

## Testing Strategy

### shared-3d Package
- Unit tests: loader (mock fetch), animator (mock clock), camera presets (snapshot)
- Integration: load real GLB, verify scene graph, check animation clip names

### Arena 3D Renderer
- Snapshot tests: render scene → compare canvas screenshot
- Performance tests: measure frame time with 20 players
- Input regression: verify socket emit payloads unchanged after migration
- E2E: Playwright with WebGL context (headless Chrome supports WebGL)

### L2P 3D Scenes
- Component tests: R3F test renderer (`@react-three/test-renderer`)
- Integration: verify animation triggers on socket events
- E2E: screenshot comparison of quiz scene with character

## Build Order

| Phase | Deliverable | Depends On | Estimate |
|-------|------------|------------|----------|
| 1 | `shared-3d` package (loader, animator, cameras, lighting) | — | Small (foundation library) |
| 2 | Assetgenerator: Mixamo rig + animate pipeline | Phase 1 (for testing output) | Medium (new adapter + scripts) |
| 3 | Arena: 3D isometric renderer | Phase 1 + 2 (needs animated models) | Largest (full renderer rewrite) |
| 4 | L2P: 3D character scenes (quiz, lobby, results, duel) | Phase 1 + 2 (needs animated models) | Large (4 scene types) |
| 5 | Shared character selector (Arena lobby + L2P profile) | Phase 1-4 (polish, shared UI) | Small (single component) |

Each phase is independently deployable. Phase 3 and 4 can run in parallel once Phase 2 produces animated models.

## Dependencies (New npm Packages)

### shared-3d
- `three` (^0.170) — GLTFLoader, DRACOLoader imported from `three/addons/` (built-in, no extra package)
- `tsup` (dev dependency, for building dist/)

### Arena Frontend (additions)
- `three` (^0.170)
- `shared-3d` (file: local)
- Remove: `pixi.js`, `@pixi/utils` (after full migration)

### L2P Frontend (additions)
- `@react-three/fiber` (^9)
- `@react-three/drei` (^9)
- `three` (^0.170)
- `shared-3d` (file: local)

### Assetgenerator (additions)
- `gltf-transform` CLI (for GLB optimization/compression)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mixamo auto-rig fails on stylized models | Animation pipeline blocked | Manual Blender rigging fallback script; test with 1 character first |
| Arena 60fps not achievable with 20 3D players | Gameplay degradation | Aggressive LOD, instanced rendering, animation LOD (reduce update rate for distant players) |
| GLB file sizes too large for mobile | Slow load times | Draco compression (~70% reduction), progressive loading (low-poly first), shared animation clips |
| L2P mobile performance | Janky quiz experience | One canvas per page (only one active at a time), disable 3D on <480px, halve animation update rate on mobile |
| Three.js version conflicts between shared-3d and consumers | Build failures | Pin exact Three.js version in shared-3d, consumers use same version |

## Out of Scope

- First-person or third-person camera modes for Arena (isometric only)
- Terrain height variation (flat tile grid, same as current)
- Water/liquid simulation
- Day/night cycle
- Character customization beyond skin variants (no armor pieces, accessories)
- Voice chat or lip sync
- Physics engine (server remains authoritative for collision)
