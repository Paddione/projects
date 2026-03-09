# Arena: Sprite Pack Integration, NPC Zombies & Weapon System

**Date:** 2026-03-09
**Status:** Approved

## Problem

The AI-generated asset pipeline (SDXL → TripoSR → Blender) produced broken sprites:
- Characters: tiny grey blobs on transparent backgrounds (invisible at 28×28 game scale)
- Items/weapons/cover: near-transparent, fall back to procedural circles
- Tiles: harsh abstract patterns, barely visible as ground

The game renders colored circles and dark grids instead of actual art.

## Solution

Replace broken assets with a purchased top-down shooter sprite pack, add NPC zombie enemies, and implement a machine gun weapon pickup system.

---

## 1. Asset Replacement

### Source Pack

`/home/patrick/projects/shared-infrastructure/SMB-Share/Top-Down-Shooter-Sprite-Pack/`

- **9 character sets** (6 poses each): Hitman, Man Blue/Brown/Old, Robot, Soldier, Survivor, Woman Green, Zombie
- **524 tiles** (64×64): floors, walls, doors, environment objects, trees, rocks, barrels
- **Spritesheets**: pre-packed PNG + XML (ShoeBox format)

### Character Mapping

| Arena Character | Sprite Pack Source | Rationale |
|---|---|---|
| `warrior` | `Soldier 1/soldier1_*.png` | Military look fits warrior archetype |
| `rogue` | `Hitman 1/hitman1_*.png` | Stealthy hitman fits rogue |
| `mage` | `Woman Green/womanGreen_*.png` | Distinct silhouette for mage |
| `tank` | `Robot 1/robot1_*.png` | Bulky robot fits tank |
| `zombie` (NPC) | `Zombie 1/zoimbie1_*.png` | Built-in zombie character |

### Character Pose System

Each character has 6 poses that map to game states:

| Pose File | Game State | When Used |
|---|---|---|
| `_stand` | idle / walking (default) | No action, moving around |
| `_gun` | firing pistol | Default weapon attack |
| `_machine` | holding/firing machine gun | After machine gun pickup |
| `_reload` | reloading | During 2s reload animation |
| `_hold` | melee attack | Melee swing |
| `_silencer` | (reserved) | Future: silenced pistol pickup |

**Rotation model**: Single sprite rotated by `player.rotation` in PixiJS. Replaces the 8-directional animation system (8 dirs × 6 anims = 48 keys → 6 poses × 1 direction = 6 keys per character).

### Tile Mapping

| Arena Asset | Tile # | Description |
|---|---|---|
| `floor_01` | tile_13 | Dirt floor (checkered) |
| `floor_02` | tile_14 | Dirt floor (spotted) |
| `floor_03` | tile_15 | Dirt floor (clean) |
| `floor_04` | tile_16 | Dirt floor (worn) |
| `wall` | tile_180 | Crate top (solid square) |
| `boundary` | tile_243 | Grey wall cap |
| `zone_overlay` | (procedural) | Stays as red tint overlay |

### Object Mapping

| Arena Asset | Tile # | Description |
|---|---|---|
| `health_pack` | tile_240 | Green gem/leaf |
| `armor_plate` | tile_237 | Blue-grey rock |
| `machine_gun` | tile_262 | Grey rectangles (ammo boxes) |
| `projectile` | tile_241 | Knife/bullet |
| `bush` | tile_183 | Green tree canopy (large) |
| `pillar` | tile_206 | Barrel top (brown circle) |
| `crate` | tile_242 | Crate pair (brown squares) |
| `wall_cover` | tile_233 | Wooden crate (rectangular) |
| `water` | tile_214 | White circle |
| `small_bush` | tile_235 | Small green bush |
| `rock` | tile_239 | Grey pentagon rock |

### UI Assets

Keep existing UI atlas — hearts, shields, round pips are functional (not broken like game sprites).

---

## 2. NPC Zombie System

### Entity Model

```typescript
interface NPC {
  id: string;
  type: 'zombie';
  x: number;
  y: number;
  hp: number;          // 2 HP (dies in 2 pistol shots or 1 melee)
  speed: number;       // 40% of player speed
  rotation: number;    // Facing angle
  targetPlayerId: string | null;  // Currently chasing
  state: 'wander' | 'chase';
  wanderAngle: number; // Random wander direction
}
```

### Behavior (per game tick)

1. **Spawn**: Every 30-60s (random), spawn at random map edge position. Max 6 NPCs alive at once.
2. **Wander**: Move in random direction, change direction every 2-3s. Speed: 40% of player.
3. **Aggro**: When any player within 5 tiles (160px), switch to `chase` state, set `targetPlayerId`.
4. **Chase**: Move toward target player. Speed stays 40% of player (slow but relentless).
5. **De-aggro**: If target dies or moves beyond 8 tiles (256px), return to `wander`.
6. **Damage**: On contact (distance < 16px), deal 1 HP damage to player. 1s cooldown between hits.
7. **Death**: When HP reaches 0, drop a random item (health_pack or armor_plate; later: weapons). Remove NPC.
8. **Zone interaction**: NPCs take zone damage like players.

### Game State Extension

```typescript
// Added to game-state broadcast
interface GameState {
  players: Player[];
  projectiles: Projectile[];
  items: Item[];
  npcs: NPC[];        // NEW
  zone?: Zone;
}
```

### Backend Changes

- `GameService`: Add NPC spawn timer, NPC tick logic (wander/chase/damage/death) in game loop
- `PlayerService`: Add `damageFromNPC()` method, NPC collision detection
- Projectile hit detection: extend to check NPC collisions (reuse existing hit logic)
- Melee hit detection: extend to check NPC collisions

---

## 3. Machine Gun Weapon System

### Weapon Model

```typescript
interface WeaponState {
  type: 'pistol' | 'machine_gun';
  totalAmmo: number;     // Remaining ammo (not in clip)
  clipAmmo: number;      // Current clip rounds
  clipSize: number;      // Max clip capacity
  isReloading: boolean;
  reloadStartTime: number | null;
}

// Defaults
const PISTOL: WeaponState = {
  type: 'pistol',
  totalAmmo: Infinity,
  clipAmmo: Infinity,
  clipSize: Infinity,
  isReloading: false,
  reloadStartTime: null,
};

const MACHINE_GUN_PICKUP: WeaponState = {
  type: 'machine_gun',
  totalAmmo: 60,      // 60 reserve
  clipAmmo: 30,       // 30 in clip (90 total)
  clipSize: 30,
  isReloading: false,
  reloadStartTime: null,
};
```

### Fire Rate & Damage

| Weapon | Fire Cooldown | Damage | Spread | Notes |
|---|---|---|---|---|
| Pistol | 400ms | 1 HP | None | Default, infinite ammo |
| Machine Gun | 100ms | 1 HP | ±5° random | Burns ammo fast, wider spread |

### Reload Mechanic

- **Trigger**: Press R key, or automatic when clip reaches 0
- **Duration**: 2 seconds
- **During reload**: Cannot fire. Character shows `_reload` pose.
- **On complete**: Fill clip from totalAmmo. `clipAmmo = min(clipSize, totalAmmo)`, `totalAmmo -= added`.
- **Auto-discard**: When totalAmmo + clipAmmo = 0, revert to pistol.

### Drop on Death

When a player holding a machine gun dies:
- Spawn a `machine_gun` item at death position
- Item contains remaining ammo: `{ totalAmmo: player.weapon.totalAmmo, clipAmmo: player.weapon.clipAmmo }`
- Other players can pick it up (inheriting the ammo state)

### Pickup Behavior

Machine gun spawns:
- From NPC zombie drops (random chance, ~20% drop rate vs 40% health, 40% armor)
- As timed spawns on the map (every 90s, max 1 on map at a time)
- From player death drops

### Player State Extension

```typescript
interface Player {
  // ... existing fields
  weapon: WeaponState;    // NEW — replaces implicit "everyone has a gun"
  pose: string;           // NEW — current sprite pose ('stand', 'gun', 'machine', 'reload', 'hold')
}
```

### Client Input Extension

```typescript
// New client → server event
'player-reload'  // Player pressed R

// Weapon state included in game-state broadcast
// Client reads player.weapon.type to determine sprite pose
// Client reads player.weapon.clipAmmo for HUD ammo counter
```

---

## 4. Frontend Changes

### AssetService

- Remove 8-directional animation system
- `getCharacterPose(characterId, pose)` → returns single Texture
- `getSprite(category, assetId)` → unchanged
- Remove `angleToDirection()` — no longer needed

### Game.tsx Rendering

**Player rendering**:
```
1. Get pose from player state (stand/gun/machine/reload/hold)
2. Get single texture: AssetService.getCharacterPose(charId, pose)
3. Create Sprite (not AnimatedSprite — single frame)
4. Set sprite.rotation = player.rotation  ← KEY CHANGE
5. Set sprite.anchor(0.5, 0.5) for center rotation
```

**NPC rendering**:
```
1. Get zombie texture: AssetService.getCharacterPose('zombie', 'stand')
2. Set sprite.rotation toward target/wander direction
3. Add red-tinted overlay or name label "Zombie"
```

**HUD additions**:
- Ammo counter (bottom-right): `30 / 60` for machine gun, hidden for pistol
- Weapon icon: gun_icon or machine_gun_icon

### Input Handling

- Add `R` key for manual reload
- Machine gun auto-reload when clip empty (with 2s delay)

---

## 5. Implementation Order

1. **Asset import + repack** — get visible sprites in-game first
2. **AssetService + Game.tsx** — new pose-based rendering with rotation
3. **NPC backend** — zombie entity, spawn, wander/chase AI, damage
4. **NPC frontend** — render zombies, death effects
5. **Weapon backend** — machine gun state, ammo, reload, fire rate, drop on death
6. **Weapon frontend** — pose switching, ammo HUD, reload animation
7. **Integration testing** — verify all sprites render, NPCs behave, weapons work
8. **Repack + deploy**

---

## 6. Files Changed

### New Files
- `arena/scripts/import_sprite_pack.ts` — copies + renames sprite pack PNGs
- `arena/backend/src/services/NPCService.ts` — NPC spawn, AI, damage logic
- `arena/backend/src/types/npc.ts` — NPC type definitions
- `arena/backend/src/types/weapon.ts` — Weapon type definitions

### Modified Files
- `arena/scripts/pack_sprites.ts` — update animation key generation (no directions)
- `arena/frontend/src/services/AssetService.ts` — pose-based lookup, remove directions
- `arena/frontend/src/components/Game.tsx` — rotation-based rendering, NPC layer, ammo HUD
- `arena/backend/src/services/GameService.ts` — NPC tick, weapon fire rate, ammo tracking
- `arena/backend/src/services/PlayerService.ts` — weapon state, reload, NPC damage
- `arena/backend/src/services/SocketService.ts` — reload event, weapon state in broadcasts
- `arena/assets/manifest.json` — update for new asset structure
- `arena/assets/renders/` — replaced with sprite pack content
- `arena/frontend/public/assets/sprites/` — regenerated atlases
