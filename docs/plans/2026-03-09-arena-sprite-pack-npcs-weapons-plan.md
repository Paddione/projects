# Arena: Sprite Pack, NPC Zombies & Weapon System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace broken AI-generated sprites with a purchased sprite pack, add NPC zombie enemies with wander/chase AI, and implement a machine gun weapon pickup with ammo/reload/drop mechanics.

**Architecture:** The sprite pack uses single-direction top-down sprites rotated in-engine (replacing the 8-directional animation system). NPCs reuse the existing entity pattern (spawn timer in GameService tick loop, collision detection reuses projectile/melee hit code). Weapons extend PlayerState with ammo tracking and modify fire rate/pose in the existing shooting flow.

**Tech Stack:** PixiJS 7, TypeScript, free-tex-packer-core, Vitest, Express + Socket.io

**Design doc:** `docs/plans/2026-03-09-arena-sprite-pack-npcs-weapons-design.md`

---

## Task 1: Import Sprite Pack into Render Directory

**Files:**
- Create: `arena/scripts/import_sprite_pack.ts`
- Modify: `arena/assets/renders/` (replace contents)

**Step 1: Create the import script**

This script copies PNGs from the sprite pack into `assets/renders/` with the naming convention the packer expects.

```typescript
// arena/scripts/import_sprite_pack.ts
#!/usr/bin/env npx tsx
/**
 * Import Top-Down Shooter Sprite Pack into arena render directory.
 * Maps sprite pack files to the naming convention expected by pack_sprites.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source: SMB share sprite pack (read via 9p or /home/patrick/SMB-Share)
const PACK_DIR = process.argv[2] || '/home/patrick/SMB-Share/Top-Down-Shooter-Sprite-Pack/PNG';
const RENDERS_DIR = path.resolve(__dirname, '..', 'assets', 'renders');

function ensureDir(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src: string, dest: string) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`  ${path.basename(src)} → ${path.relative(RENDERS_DIR, dest)}`);
}

// Character mapping: arena ID → sprite pack folder + prefix
const CHARACTER_MAP: Record<string, { folder: string; prefix: string }> = {
    warrior: { folder: 'Soldier 1', prefix: 'soldier1' },
    rogue:   { folder: 'Hitman 1', prefix: 'hitman1' },
    mage:    { folder: 'Woman Green', prefix: 'womanGreen' },
    tank:    { folder: 'Robot 1', prefix: 'robot1' },
    zombie:  { folder: 'Zombie 1', prefix: 'zoimbie1' },  // Note: typo in pack ("zoimbie")
};

// Character poses: arena pose name → sprite pack suffix
const POSE_MAP: Record<string, string> = {
    stand:    '_stand',
    gun:      '_gun',
    machine:  '_machine',
    reload:   '_reload',
    hold:     '_hold',
    silencer: '_silencer',
};

// Tile mapping: arena asset ID → tile number
const TILE_MAP: Record<string, string> = {
    floor_01: 'tile_13',
    floor_02: 'tile_14',
    floor_03: 'tile_15',
    floor_04: 'tile_16',
    wall:     'tile_180',
    boundary: 'tile_243',
};

// Item mapping
const ITEM_MAP: Record<string, string> = {
    health_pack:  'tile_240',
    armor_plate:  'tile_237',
    machine_gun:  'tile_262',
};

// Weapon mapping
const WEAPON_MAP: Record<string, string> = {
    projectile: 'tile_241',
};

// Cover mapping
const COVER_MAP: Record<string, string> = {
    bush:       'tile_183',
    pillar:     'tile_206',
    crate:      'tile_242',
    wall_cover: 'tile_233',
    water:      'tile_214',
};

function importCharacters() {
    console.log('\n[Characters]');
    for (const [arenaId, { folder, prefix }] of Object.entries(CHARACTER_MAP)) {
        const srcDir = path.join(PACK_DIR, folder);
        if (!fs.existsSync(srcDir)) {
            console.log(`  [SKIP] ${folder} not found`);
            continue;
        }
        for (const [poseName, suffix] of Object.entries(POSE_MAP)) {
            const srcFile = path.join(srcDir, `${prefix}${suffix}.png`);
            if (!fs.existsSync(srcFile)) {
                console.log(`  [SKIP] ${prefix}${suffix}.png not found`);
                continue;
            }
            // Output: renders/characters/{arenaId}/{arenaId}-{pose}-00.png
            const destFile = path.join(RENDERS_DIR, 'characters', arenaId, `${arenaId}-${poseName}-00.png`);
            copyFile(srcFile, destFile);
        }
    }
}

function importTiles(map: Record<string, string>, category: string) {
    console.log(`\n[${category}]`);
    const tilesDir = path.join(PACK_DIR, 'Tiles');
    for (const [arenaId, tileNum] of Object.entries(map)) {
        const srcFile = path.join(tilesDir, `${tileNum}.png`);
        if (!fs.existsSync(srcFile)) {
            console.log(`  [SKIP] ${tileNum}.png not found`);
            continue;
        }
        const destFile = path.join(RENDERS_DIR, category, arenaId, `${arenaId}-00.png`);
        copyFile(srcFile, destFile);
    }
}

function main() {
    console.log('Arena Sprite Pack Importer');
    console.log('=========================');
    console.log(`Source: ${PACK_DIR}`);
    console.log(`Target: ${RENDERS_DIR}`);

    if (!fs.existsSync(PACK_DIR)) {
        console.error(`\nERROR: Sprite pack not found at ${PACK_DIR}`);
        console.error('Pass the path as first argument: npx tsx scripts/import_sprite_pack.ts /path/to/pack/PNG');
        process.exit(1);
    }

    // Clean existing renders
    if (fs.existsSync(RENDERS_DIR)) {
        console.log('\nCleaning existing renders...');
        fs.rmSync(RENDERS_DIR, { recursive: true });
    }

    importCharacters();
    importTiles(TILE_MAP, 'tiles');
    importTiles(ITEM_MAP, 'items');
    importTiles(WEAPON_MAP, 'weapons');
    importTiles(COVER_MAP, 'cover');

    // UI: keep existing or skip (UI atlas was not broken)
    console.log('\n[UI] Skipped — existing UI atlas is functional');

    console.log('\n[DONE] Run pack_sprites.ts next to rebuild atlases.');
}

main();
```

**Step 2: Run the import**

```bash
cd arena && npx tsx scripts/import_sprite_pack.ts "/home/patrick/SMB-Share/Top-Down-Shooter-Sprite-Pack/PNG"
```

Expected: 5 characters × 6 poses = 30 character PNGs, 6 tiles, 3 items, 1 weapon, 5 cover = 45 total files imported.

**Step 3: Commit**

```bash
git add arena/scripts/import_sprite_pack.ts
git commit -m "feat(arena): add sprite pack import script"
```

---

## Task 2: Update Packer for Pose-Based Characters (No Directions)

**Files:**
- Modify: `arena/scripts/pack_sprites.ts` (lines 84-130, `addAnimations` function)
- Modify: `arena/assets/manifest.json` (character animations section)

**Step 1: Update manifest.json**

Replace the 8-directional animation system with pose-based. Characters no longer have `directions` or per-animation frame counts for 8 dirs. Instead, each pose is a single frame.

In `arena/assets/manifest.json`, replace the `characters` section:

```json
"characters": [
    {
        "id": "warrior",
        "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
        "color": "#6366f1"
    },
    {
        "id": "rogue",
        "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
        "color": "#22c55e"
    },
    {
        "id": "mage",
        "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
        "color": "#a855f7"
    },
    {
        "id": "tank",
        "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
        "color": "#f59e0b"
    },
    {
        "id": "zombie",
        "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
        "color": "#ef4444"
    }
]
```

Also add `machine_gun` to the items array:

```json
"items": [
    { "id": "health_pack", "frames": 1, "size": 64 },
    { "id": "armor_plate", "frames": 1, "size": 64 },
    { "id": "machine_gun", "frames": 1, "size": 64 }
]
```

**Step 2: Update pack_sprites.ts addAnimations()**

Replace the `addAnimations` function (lines 84-130) to handle pose-based characters:

```typescript
function addAnimations(
    frames: Record<string, any>,
    category: string,
    manifest: Manifest
): Record<string, string[]> {
    const animations: Record<string, string[]> = {};

    if (category === 'characters') {
        // Pose-based: each character has single-frame poses
        for (const char of manifest.characters) {
            for (const pose of (char as any).poses || []) {
                const frameName = `${char.id}/${char.id}-${pose}-00`;
                if (frames[frameName]) {
                    animations[`${char.id}_${pose}`] = [frameName];
                }
            }
        }
    }

    // Items/weapons: single frame each (no animation)
    if (category === 'items' || category === 'weapons') {
        const assets = category === 'items' ? manifest.items : manifest.weapons;
        for (const asset of assets) {
            const frameNames: string[] = [];
            for (let i = 0; i < (asset.frames || 1); i++) {
                const frameName = `${asset.id}/${asset.id}-${i.toString().padStart(2, '0')}`;
                if (frames[frameName]) {
                    frameNames.push(frameName);
                }
            }
            if (frameNames.length > 0) {
                animations[`${asset.id}_idle`] = frameNames;
            }
        }
    }

    return animations;
}
```

**Step 3: Run the packer**

```bash
cd arena && npx tsx scripts/pack_sprites.ts
```

Expected: 6 atlas pairs regenerated (characters.png/json, items.png/json, etc.) with new sprite pack content.

**Step 4: Visually verify the packed atlases**

Open `arena/frontend/public/assets/sprites/characters.png` — should show 5 characters × 6 poses = 30 distinct character sprites in a clear grid. Each should be recognizable (soldier, hitman, woman, robot, zombie).

**Step 5: Commit**

```bash
git add arena/assets/manifest.json arena/scripts/pack_sprites.ts arena/frontend/public/assets/sprites/ arena/assets/renders/
git commit -m "feat(arena): replace broken sprites with sprite pack assets

Imports 45 sprites from Top-Down Shooter pack, repacks into PixiJS atlases.
Characters now use pose-based system (6 poses) instead of 8-directional."
```

---

## Task 3: Rewrite AssetService for Pose-Based Rendering

**Files:**
- Modify: `arena/frontend/src/services/AssetService.ts` (full rewrite)

**Step 1: Rewrite AssetService**

Replace the entire file. Key changes:
- Remove `Direction`, `CharacterAnimation` types and `angleToDirection()`
- Add `CharacterPose` type and `getCharacterPose(characterId, pose)`
- Keep `getSprite()`, `getItemAnimation()`, `getFloorTiles()` mostly unchanged

```typescript
// arena/frontend/src/services/AssetService.ts
/**
 * AssetService — PixiJS Spritesheet Preloader & Typed Accessor
 *
 * Loads all sprite sheet atlases on game start and provides typed access
 * to individual sprites and animation frame sequences.
 *
 * Characters use a POSE-BASED system (single sprite rotated in-engine)
 * instead of 8-directional animations.
 */

import { Assets, Spritesheet, Texture, type UnresolvedAsset } from 'pixi.js';

const ATLAS_KEYS = ['characters', 'items', 'weapons', 'tiles', 'cover', 'ui'] as const;
type AtlasKey = (typeof ATLAS_KEYS)[number];

const ASSETS_BASE = '/assets/sprites';

/** Character pose — maps to sprite pack file suffixes */
export type CharacterPose = 'stand' | 'gun' | 'machine' | 'reload' | 'hold' | 'silencer';

class AssetServiceImpl {
    private loaded = false;
    private spritesheets: Partial<Record<AtlasKey, Spritesheet>> = {};

    get isLoaded(): boolean {
        return this.loaded;
    }

    async loadAll(onProgress?: (progress: number) => void): Promise<void> {
        if (this.loaded) return;

        const bundles: UnresolvedAsset[] = [];
        for (const key of ATLAS_KEYS) {
            bundles.push({ alias: key, src: `${ASSETS_BASE}/${key}.json` });
        }

        Assets.addBundle('arena-sprites', bundles);
        const assets = await Assets.loadBundle('arena-sprites', (progress) => {
            onProgress?.(progress);
        });

        for (const key of ATLAS_KEYS) {
            if (assets[key] instanceof Spritesheet) {
                this.spritesheets[key] = assets[key];
            }
        }

        this.loaded = true;
    }

    /**
     * Get a character pose texture. Characters are single sprites rotated in-engine.
     *
     * @param characterId e.g. 'warrior', 'rogue', 'mage', 'tank', 'zombie'
     * @param pose e.g. 'stand', 'gun', 'machine', 'reload', 'hold'
     * @returns Single Texture or null if not found
     */
    getCharacterPose(characterId: string, pose: CharacterPose): Texture | null {
        const sheet = this.spritesheets.characters;
        if (!sheet) return null;

        // Try animation key first (from pack_sprites.ts)
        const animKey = `${characterId}_${pose}`;
        const animFrames = sheet.animations?.[animKey];
        if (animFrames && animFrames.length > 0) {
            return animFrames[0];
        }

        // Fallback: direct frame lookup
        const frameName = `${characterId}/${characterId}-${pose}-00`;
        return sheet.textures?.[frameName] ?? null;
    }

    /**
     * Get a single sprite texture from an atlas.
     */
    getSprite(category: AtlasKey, assetId: string, frame = 0): Texture | null {
        const sheet = this.spritesheets[category];
        if (!sheet) return null;

        const withFrame = `${assetId}/${assetId}-${frame.toString().padStart(2, '0')}`;
        if (sheet.textures?.[withFrame]) return sheet.textures[withFrame];
        if (sheet.textures?.[assetId]) return sheet.textures[assetId];

        return null;
    }

    /**
     * Get animation frames for a non-character asset (items, weapons).
     */
    getItemAnimation(category: AtlasKey, assetId: string): Texture[] {
        const sheet = this.spritesheets[category];
        if (!sheet) return [];

        const animKey = `${assetId}_idle`;
        if (sheet.animations?.[animKey]) return sheet.animations[animKey];

        const frames: Texture[] = [];
        for (let i = 0; i < 10; i++) {
            const tex = this.getSprite(category, assetId, i);
            if (tex) frames.push(tex);
            else break;
        }
        return frames;
    }

    /**
     * Get floor tile textures for tiling.
     */
    getFloorTiles(): Texture[] {
        const tiles: Texture[] = [];
        for (let i = 1; i <= 4; i++) {
            const tex = this.getSprite('tiles', `floor_0${i}`);
            if (tex) tiles.push(tex);
        }
        return tiles;
    }

    hasAtlas(key: AtlasKey): boolean {
        return key in this.spritesheets;
    }
}

export const AssetService = new AssetServiceImpl();
```

**Step 2: Commit**

```bash
git add arena/frontend/src/services/AssetService.ts
git commit -m "refactor(arena): rewrite AssetService for pose-based character rendering

Remove 8-directional animation system. Characters now use single-pose
textures rotated in-engine via sprite.rotation."
```

---

## Task 4: Update Game.tsx Rendering (Players, Items, NPCs)

**Files:**
- Modify: `arena/frontend/src/components/Game.tsx`
  - Lines 1-6: Update imports (remove CharacterAnimation)
  - Lines 420-491: Rewrite `renderPlayers()` for pose + rotation
  - Lines 336-375: Update `renderItems()` to handle machine_gun type
  - Lines 265-300: Add NPC rendering layer
  - Lines 704-826: Add ammo HUD

**Step 1: Update imports (line 9)**

Replace:
```typescript
import { AssetService, type CharacterAnimation } from '../services/AssetService';
```
With:
```typescript
import { AssetService, type CharacterPose } from '../services/AssetService';
```

**Step 2: Add NPC layer after zone layer (around line 256)**

In the layer setup section where containers are created, add:
```typescript
const npcLayer = new Container();
worldContainer.addChild(npcLayer);
```

And in the render loop (around line 289), add between zone and player rendering:
```typescript
npcLayer.removeChildren();
renderNPCs(npcLayer, state);
```

**Step 3: Rewrite renderPlayers() (lines 420-491)**

Replace the entire function body:

```typescript
function renderPlayers(
    playerContainer: Container,
    labelContainer: Container,
    state: any,
    _me: any,
) {
    for (const player of state.players || []) {
        if (!player.isAlive) continue;

        const isMe = player.id === playerId;

        if (useSprites) {
            // Determine pose from weapon + action state
            let pose: CharacterPose = 'stand';
            if (player.isReloading) {
                pose = 'reload';
            } else if (player.weapon?.type === 'machine_gun') {
                pose = 'machine';
            } else if (player.isShooting) {
                pose = 'gun';
            } else if (player.isMeleeing) {
                pose = 'hold';
            }

            const charId = player.selectedCharacter || player.selected_character || 'warrior';
            const tex = AssetService.getCharacterPose(charId, pose);

            if (tex) {
                const sprite = new Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.position.set(player.x, player.y);
                sprite.width = 32;
                sprite.height = 32;
                // KEY CHANGE: rotate sprite by player facing angle
                // Subtract PI/2 because sprites face "up" (north) by default
                sprite.rotation = player.rotation + Math.PI / 2;
                playerContainer.addChild(sprite);

                // Armor ring overlay
                if (player.hasArmor) {
                    const armorG = new Graphics();
                    armorG.lineStyle(2, 0x38bdf8, 0.8);
                    armorG.drawCircle(player.x, player.y, 18);
                    playerContainer.addChild(armorG);
                }

                renderPlayerLabel(labelContainer, player, isMe);
                continue;
            }
        }

        // Fallback: procedural player
        const pg = new Graphics();
        const color = isMe ? 0x6366f1 : 0xef4444;
        pg.beginFill(color);
        pg.drawCircle(player.x, player.y, 12);
        pg.endFill();
        const dirX = player.x + Math.cos(player.rotation) * 18;
        const dirY = player.y + Math.sin(player.rotation) * 18;
        pg.lineStyle(3, color, 0.8);
        pg.moveTo(player.x, player.y);
        pg.lineTo(dirX, dirY);
        if (player.hasArmor) {
            pg.lineStyle(2, 0x38bdf8, 0.8);
            pg.drawCircle(player.x, player.y, 15);
        }
        playerContainer.addChild(pg);
        renderPlayerLabel(labelContainer, player, isMe);
    }
}
```

**Step 4: Add renderNPCs function** (after renderPlayers)

```typescript
function renderNPCs(container: Container, state: any) {
    for (const npc of state.npcs || []) {
        if (useSprites) {
            const pose: CharacterPose = 'hold';  // Zombie always in melee pose
            const tex = AssetService.getCharacterPose('zombie', pose);
            if (tex) {
                const sprite = new Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.position.set(npc.x, npc.y);
                sprite.width = 32;
                sprite.height = 32;
                sprite.rotation = npc.rotation + Math.PI / 2;
                sprite.tint = 0xccffcc;  // Slight green tint for zombie feel
                container.addChild(sprite);

                // HP bar for NPCs
                const hpG = new Graphics();
                const hpWidth = 24;
                const hpHeight = 3;
                const hpX = npc.x - hpWidth / 2;
                const hpY = npc.y - 22;
                hpG.beginFill(0x333333);
                hpG.drawRect(hpX, hpY, hpWidth, hpHeight);
                hpG.endFill();
                hpG.beginFill(0xef4444);
                hpG.drawRect(hpX, hpY, hpWidth * (npc.hp / 2), hpHeight);
                hpG.endFill();
                container.addChild(hpG);
                continue;
            }
        }

        // Fallback: procedural NPC
        const ng = new Graphics();
        ng.beginFill(0x22c55e);
        ng.drawCircle(npc.x, npc.y, 12);
        ng.endFill();
        ng.lineStyle(3, 0x22c55e, 0.8);
        const dx = npc.x + Math.cos(npc.rotation) * 18;
        const dy = npc.y + Math.sin(npc.rotation) * 18;
        ng.moveTo(npc.x, npc.y);
        ng.lineTo(dx, dy);
        container.addChild(ng);
    }
}
```

**Step 5: Update renderItems to handle machine_gun type**

In `renderItems()`, update the assetId mapping (around line 339):

```typescript
function renderItems(container: Container, state: any) {
    for (const item of state.items || []) {
        if (useSprites) {
            let assetId: string;
            let category: 'items' | 'weapons' = 'items';
            if (item.type === 'health') {
                assetId = 'health_pack';
            } else if (item.type === 'armor') {
                assetId = 'armor_plate';
            } else if (item.type === 'machine_gun') {
                assetId = 'machine_gun';
            } else {
                assetId = 'health_pack'; // fallback
            }
            const frames = AssetService.getItemAnimation(category, assetId);
            if (frames.length > 0) {
                const sprite = new Sprite(frames[0]);
                sprite.anchor.set(0.5);
                sprite.position.set(item.x, item.y);
                sprite.width = 24;
                sprite.height = 24;
                container.addChild(sprite);
                continue;
            }
        }

        // Fallback: procedural items
        const ig = new Graphics();
        const colors: Record<string, number> = {
            health: 0xef4444,
            armor: 0x38bdf8,
            machine_gun: 0xfbbf24,
        };
        const color = colors[item.type] || 0xffffff;
        ig.beginFill(color);
        ig.drawCircle(item.x, item.y, 8);
        ig.endFill();
        ig.lineStyle(2, color, 0.3 + Math.sin(Date.now() / 300) * 0.3);
        ig.drawCircle(item.x, item.y, 12);
        container.addChild(ig);
    }
}
```

**Step 6: Add ammo HUD in JSX overlay**

In the JSX return (around line 710), add an ammo display after the HP display:

```tsx
{/* Ammo counter — only shown when holding machine gun */}
{gameStateRef.current?.players?.find((p: any) => p.id === playerId)?.weapon?.type === 'machine_gun' && (
    <div style={{
        position: 'absolute', bottom: 20, right: 20,
        color: '#fbbf24', fontFamily: 'Outfit', fontSize: 18, fontWeight: 700,
        background: 'rgba(0,0,0,0.6)', padding: '8px 14px', borderRadius: 8,
    }}>
        {(() => {
            const w = gameStateRef.current?.players?.find((p: any) => p.id === playerId)?.weapon;
            return w ? `🔫 ${w.clipAmmo} / ${w.totalAmmo}` : '';
        })()}
    </div>
)}
```

**Step 7: Add R key for reload in input loop**

In the input loop (around line 200-259), add reload to the emitted input:

```typescript
socket.emit('player-input', {
    matchId,
    input: {
        movement: { x: mx, y: my },
        aimAngle,
        shooting,
        melee,
        sprint,
        pickup: keys.has('f'),
        reload: keys.has('r'),  // NEW
        timestamp: Date.now(),
    },
});
```

**Step 8: Commit**

```bash
git add arena/frontend/src/components/Game.tsx
git commit -m "feat(arena): update Game.tsx for pose-based rendering, NPCs, and ammo HUD

- Players rendered with single rotated sprite based on weapon/action pose
- NPC zombie rendering with HP bar and green tint
- Machine gun item rendering
- Ammo counter HUD for machine gun
- R key reload input"
```

---

## Task 5: Add Weapon Types to Backend

**Files:**
- Create: `arena/backend/src/types/weapon.ts`
- Modify: `arena/backend/src/types/game.ts` (add weapon to PlayerState, add NPC types, update ItemType)

**Step 1: Create weapon types**

```typescript
// arena/backend/src/types/weapon.ts
export type WeaponType = 'pistol' | 'machine_gun';

export interface WeaponState {
    type: WeaponType;
    totalAmmo: number;      // Reserve ammo (not in clip)
    clipAmmo: number;       // Current rounds in clip
    clipSize: number;       // Max clip capacity
    isReloading: boolean;
    reloadStartTime: number | null;
}

export const PISTOL_DEFAULT: WeaponState = {
    type: 'pistol',
    totalAmmo: Infinity,
    clipAmmo: Infinity,
    clipSize: Infinity,
    isReloading: false,
    reloadStartTime: null,
};

export const MACHINE_GUN_PICKUP: WeaponState = {
    type: 'machine_gun',
    totalAmmo: 60,
    clipAmmo: 30,
    clipSize: 30,
    isReloading: false,
    reloadStartTime: null,
};

export const WEAPON_STATS: Record<WeaponType, { cooldownMs: number; damage: number; spreadRad: number }> = {
    pistol:      { cooldownMs: 400, damage: 1, spreadRad: 0 },
    machine_gun: { cooldownMs: 100, damage: 1, spreadRad: 5 * (Math.PI / 180) },
};

export const RELOAD_DURATION_MS = 2000;
```

**Step 2: Update game.ts types**

Add to `PlayerState`:
```typescript
weapon: WeaponState;
lastShotTime: number;
pose: string;  // 'stand' | 'gun' | 'machine' | 'reload' | 'hold'
```

Add to `PlayerInput`:
```typescript
reload: boolean;
```

Update `ItemType`:
```typescript
type ItemType = 'health' | 'armor' | 'machine_gun';
```

Add `MapItem` optional ammo fields:
```typescript
interface MapItem {
    id: string;
    type: ItemType;
    x: number;
    y: number;
    isCollected: boolean;
    spawnedAt: number;
    // Weapon items carry ammo state
    weaponState?: WeaponState;
}
```

Add NPC types:
```typescript
type NPCState = 'wander' | 'chase';

interface NPC {
    id: string;
    type: 'zombie';
    x: number;
    y: number;
    hp: number;
    speed: number;
    rotation: number;
    targetPlayerId: string | null;
    state: NPCState;
    wanderAngle: number;
    wanderChangeTime: number;
    lastDamageTime: number;
}
```

Add `npcs` to `GameState`:
```typescript
interface GameState {
    // ... existing fields
    npcs: NPC[];
    lastNPCSpawnTick: number;
}
```

**Step 3: Commit**

```bash
git add arena/backend/src/types/weapon.ts arena/backend/src/types/game.ts
git commit -m "feat(arena): add weapon, NPC, and machine_gun item types"
```

---

## Task 6: Implement Weapon Mechanics in PlayerService

**Files:**
- Modify: `arena/backend/src/services/PlayerService.ts`

**Step 1: Add weapon methods to PlayerService**

Add these methods after the existing `collectItem()`:

```typescript
import { WeaponState, PISTOL_DEFAULT, MACHINE_GUN_PICKUP, WEAPON_STATS, RELOAD_DURATION_MS } from '../types/weapon';

// In createPlayer(), add:
//   weapon: { ...PISTOL_DEFAULT },
//   lastShotTime: 0,
//   pose: 'stand',

/** Check if player can fire their weapon */
canShoot(player: PlayerState): boolean {
    if (player.weapon.isReloading) return false;
    if (player.weapon.clipAmmo <= 0) return false;
    const stats = WEAPON_STATS[player.weapon.type];
    return (Date.now() - player.lastShotTime) >= stats.cooldownMs;
}

/** Consume one round of ammo. Returns false if empty. */
consumeAmmo(player: PlayerState): boolean {
    if (player.weapon.type === 'pistol') return true;  // Infinite ammo
    if (player.weapon.clipAmmo <= 0) return false;
    player.weapon.clipAmmo--;
    // Auto-reload when clip empty
    if (player.weapon.clipAmmo <= 0 && player.weapon.totalAmmo > 0) {
        this.startReload(player);
    }
    // Auto-discard when all ammo gone
    if (player.weapon.clipAmmo <= 0 && player.weapon.totalAmmo <= 0) {
        player.weapon = { ...PISTOL_DEFAULT };
    }
    return true;
}

/** Start reload process */
startReload(player: PlayerState): void {
    if (player.weapon.type === 'pistol') return;
    if (player.weapon.isReloading) return;
    if (player.weapon.totalAmmo <= 0) return;
    if (player.weapon.clipAmmo >= player.weapon.clipSize) return;

    player.weapon.isReloading = true;
    player.weapon.reloadStartTime = Date.now();
}

/** Check and complete reload (called in tick) */
updateReload(player: PlayerState): void {
    if (!player.weapon.isReloading || !player.weapon.reloadStartTime) return;

    if (Date.now() - player.weapon.reloadStartTime >= RELOAD_DURATION_MS) {
        const needed = player.weapon.clipSize - player.weapon.clipAmmo;
        const toLoad = Math.min(needed, player.weapon.totalAmmo);
        player.weapon.clipAmmo += toLoad;
        player.weapon.totalAmmo -= toLoad;
        player.weapon.isReloading = false;
        player.weapon.reloadStartTime = null;
    }
}

/** Pick up a weapon item. Returns the old weapon state if player had one to drop. */
pickupWeapon(player: PlayerState, itemWeapon: WeaponState): WeaponState | null {
    const oldWeapon = player.weapon.type !== 'pistol' ? { ...player.weapon } : null;
    player.weapon = { ...itemWeapon };
    return oldWeapon;
}

/** Get weapon to drop on death (null if pistol) */
getDeathDrop(player: PlayerState): WeaponState | null {
    if (player.weapon.type === 'pistol') return null;
    return { ...player.weapon };
}

/** Determine current sprite pose from player state */
updatePose(player: PlayerState, isShooting: boolean, isMeleeing: boolean): void {
    if (player.weapon.isReloading) {
        player.pose = 'reload';
    } else if (isMeleeing) {
        player.pose = 'hold';
    } else if (player.weapon.type === 'machine_gun') {
        player.pose = 'machine';
    } else if (isShooting) {
        player.pose = 'gun';
    } else {
        player.pose = 'stand';
    }
}
```

Also update `resetForRound()` to reset weapon:
```typescript
player.weapon = { ...PISTOL_DEFAULT };
player.lastShotTime = 0;
player.pose = 'stand';
```

**Step 2: Write tests for weapon mechanics**

Create `arena/backend/src/services/PlayerService.weapon.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerService } from './PlayerService';
import { PISTOL_DEFAULT, MACHINE_GUN_PICKUP } from '../types/weapon';

describe('PlayerService weapon mechanics', () => {
    let service: PlayerService;
    let player: any;

    beforeEach(() => {
        service = new PlayerService();
        player = service.createPlayer('p1', 'TestUser', 'warrior', 1);
    });

    it('starts with pistol (infinite ammo)', () => {
        expect(player.weapon.type).toBe('pistol');
        expect(service.canShoot(player)).toBe(true);
    });

    it('picks up machine gun with 30/60 ammo', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        expect(player.weapon.type).toBe('machine_gun');
        expect(player.weapon.clipAmmo).toBe(30);
        expect(player.weapon.totalAmmo).toBe(60);
    });

    it('consumes ammo on shot', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        service.consumeAmmo(player);
        expect(player.weapon.clipAmmo).toBe(29);
    });

    it('auto-reloads when clip empty', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        player.weapon.clipAmmo = 1;
        service.consumeAmmo(player);
        expect(player.weapon.clipAmmo).toBe(0);
        expect(player.weapon.isReloading).toBe(true);
    });

    it('discards weapon when all ammo spent', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        player.weapon.clipAmmo = 1;
        player.weapon.totalAmmo = 0;
        service.consumeAmmo(player);
        expect(player.weapon.type).toBe('pistol');
    });

    it('completes reload after 2 seconds', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        player.weapon.clipAmmo = 0;
        service.startReload(player);
        expect(player.weapon.isReloading).toBe(true);
        // Simulate time passing
        player.weapon.reloadStartTime = Date.now() - 2001;
        service.updateReload(player);
        expect(player.weapon.isReloading).toBe(false);
        expect(player.weapon.clipAmmo).toBe(30);
        expect(player.weapon.totalAmmo).toBe(30);
    });

    it('drops weapon on death', () => {
        service.pickupWeapon(player, { ...MACHINE_GUN_PICKUP });
        player.weapon.clipAmmo = 15;
        player.weapon.totalAmmo = 40;
        const drop = service.getDeathDrop(player);
        expect(drop).not.toBeNull();
        expect(drop!.clipAmmo).toBe(15);
        expect(drop!.totalAmmo).toBe(40);
    });

    it('does not drop pistol on death', () => {
        expect(service.getDeathDrop(player)).toBeNull();
    });
});
```

**Step 3: Run tests**

```bash
cd arena/backend && npx vitest run src/services/PlayerService.weapon.test.ts
```

Expected: All 7 tests pass.

**Step 4: Commit**

```bash
git add arena/backend/src/services/PlayerService.ts arena/backend/src/services/PlayerService.weapon.test.ts
git commit -m "feat(arena): implement weapon mechanics in PlayerService

Ammo tracking, reload with 2s duration, auto-discard on empty,
death drops with remaining ammo state. 7 unit tests."
```

---

## Task 7: Implement NPC Zombie System in GameService

**Files:**
- Modify: `arena/backend/src/services/GameService.ts`

**Step 1: Add NPC constants**

Near the existing `GAME` constants:
```typescript
const NPC = {
    MAX_ALIVE: 6,
    SPAWN_INTERVAL_S: 45,         // spawn every 45s (30-60 range via random)
    SPEED: GAME.PLAYER_SPEED * 0.4,
    AGGRO_RANGE: 5 * GAME.TILE_SIZE,      // 160px
    DEAGGRO_RANGE: 8 * GAME.TILE_SIZE,    // 256px
    DAMAGE: 1,
    HP: 2,
    CONTACT_RANGE: 16,            // pixels
    DAMAGE_COOLDOWN_MS: 1000,
    WANDER_CHANGE_MS: 2500,
} as const;
```

**Step 2: Add NPC tick methods to GameService**

Add these methods to GameService:

```typescript
private spawnNPC(game: GameState): void {
    if (game.npcs.length >= NPC.MAX_ALIVE) return;

    // Spawn at random map edge
    const mapW = game.map.width * GAME.TILE_SIZE;
    const mapH = game.map.height * GAME.TILE_SIZE;
    const edge = Math.floor(Math.random() * 4);
    let x: number, y: number;
    switch (edge) {
        case 0: x = Math.random() * mapW; y = GAME.TILE_SIZE; break;           // top
        case 1: x = Math.random() * mapW; y = mapH - GAME.TILE_SIZE; break;    // bottom
        case 2: x = GAME.TILE_SIZE; y = Math.random() * mapH; break;           // left
        default: x = mapW - GAME.TILE_SIZE; y = Math.random() * mapH; break;   // right
    }

    const npc: NPC = {
        id: uuidv4(),
        type: 'zombie',
        x, y,
        hp: NPC.HP,
        speed: NPC.SPEED,
        rotation: Math.random() * Math.PI * 2,
        targetPlayerId: null,
        state: 'wander',
        wanderAngle: Math.random() * Math.PI * 2,
        wanderChangeTime: Date.now() + NPC.WANDER_CHANGE_MS,
        lastDamageTime: 0,
    };

    game.npcs.push(npc);
}

private updateNPCs(game: GameState): void {
    const toRemove: string[] = [];

    for (const npc of game.npcs) {
        // Find nearest alive player
        let nearestDist = Infinity;
        let nearestId: string | null = null;
        for (const [pid, p] of game.players) {
            if (!p.isAlive) continue;
            const dist = Math.hypot(p.x - npc.x, p.y - npc.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestId = pid;
            }
        }

        // Aggro / de-aggro
        if (npc.state === 'wander' && nearestDist <= NPC.AGGRO_RANGE && nearestId) {
            npc.state = 'chase';
            npc.targetPlayerId = nearestId;
        } else if (npc.state === 'chase') {
            const target = npc.targetPlayerId ? game.players.get(npc.targetPlayerId) : null;
            if (!target || !target.isAlive) {
                npc.state = 'wander';
                npc.targetPlayerId = null;
            } else {
                const dist = Math.hypot(target.x - npc.x, target.y - npc.y);
                if (dist > NPC.DEAGGRO_RANGE) {
                    npc.state = 'wander';
                    npc.targetPlayerId = null;
                }
            }
        }

        // Movement
        if (npc.state === 'chase' && npc.targetPlayerId) {
            const target = game.players.get(npc.targetPlayerId)!;
            const angle = Math.atan2(target.y - npc.y, target.x - npc.x);
            npc.x += Math.cos(angle) * npc.speed;
            npc.y += Math.sin(angle) * npc.speed;
            npc.rotation = angle;
        } else {
            // Wander: change direction periodically
            if (Date.now() > npc.wanderChangeTime) {
                npc.wanderAngle = Math.random() * Math.PI * 2;
                npc.wanderChangeTime = Date.now() + NPC.WANDER_CHANGE_MS + Math.random() * 1000;
            }
            npc.x += Math.cos(npc.wanderAngle) * npc.speed * 0.5;
            npc.y += Math.sin(npc.wanderAngle) * npc.speed * 0.5;
            npc.rotation = npc.wanderAngle;
        }

        // Clamp to map bounds
        const mapW = game.map.width * GAME.TILE_SIZE;
        const mapH = game.map.height * GAME.TILE_SIZE;
        npc.x = Math.max(GAME.TILE_SIZE, Math.min(mapW - GAME.TILE_SIZE, npc.x));
        npc.y = Math.max(GAME.TILE_SIZE, Math.min(mapH - GAME.TILE_SIZE, npc.y));

        // Contact damage to players
        for (const [pid, p] of game.players) {
            if (!p.isAlive) continue;
            const dist = Math.hypot(p.x - npc.x, p.y - npc.y);
            if (dist < NPC.CONTACT_RANGE && Date.now() - npc.lastDamageTime > NPC.DAMAGE_COOLDOWN_MS) {
                const result = this.playerService.applyDamage(p, NPC.DAMAGE, npc.id);
                npc.lastDamageTime = Date.now();

                this.onPlayerHit?.(game.matchId, {
                    targetId: pid,
                    attackerId: npc.id,
                    damage: NPC.DAMAGE,
                    remainingHp: result.remainingHp,
                    hasArmor: result.hasArmor,
                });

                if (result.died) {
                    this.playerService.makeSpectator(p);
                    game.currentRound.alivePlayers = game.currentRound.alivePlayers.filter((id) => id !== pid);
                    this.onPlayerKilled?.(game.matchId, {
                        victimId: pid,
                        killerId: npc.id,
                        weapon: 'zombie',
                    });
                }
            }
        }

        // Zone damage
        if (game.zone?.isActive) {
            const distToCenter = Math.hypot(npc.x - game.zone.centerX, npc.y - game.zone.centerY);
            if (distToCenter > game.zone.currentRadius) {
                npc.hp -= DAMAGE.ZONE;
            }
        }

        if (npc.hp <= 0) {
            toRemove.push(npc.id);
            this.spawnNPCDrop(game, npc);
        }
    }

    game.npcs = game.npcs.filter((n) => !toRemove.includes(n.id));
}

private spawnNPCDrop(game: GameState, npc: NPC): void {
    const roll = Math.random();
    let type: ItemType;
    let weaponState: WeaponState | undefined;
    if (roll < 0.4) {
        type = 'health';
    } else if (roll < 0.8) {
        type = 'armor';
    } else {
        type = 'machine_gun';
        weaponState = { ...MACHINE_GUN_PICKUP };
    }

    const item: MapItem = {
        id: uuidv4(),
        type,
        x: npc.x,
        y: npc.y,
        isCollected: false,
        spawnedAt: Date.now(),
        weaponState,
    };

    game.items.push(item);
    this.onItemSpawned?.(game.matchId, {
        item,
        announcement: type === 'machine_gun' ? '🔫 Machine gun dropped!' : type === 'health' ? '💊 Health dropped!' : '🛡️ Armor dropped!',
    });
}
```

**Step 3: Integrate into tick() loop**

In the `tick()` method (line ~193), add after item spawning and before `checkRoundEnd`:

```typescript
// NPC spawning
const npcSpawnTicks = (NPC.SPAWN_INTERVAL_S + (Math.random() * 30 - 15)) * this.tickRate;
if (game.tickCount - game.lastNPCSpawnTick >= npcSpawnTicks) {
    this.spawnNPC(game);
    game.lastNPCSpawnTick = game.tickCount;
}

// NPC AI + movement + damage
this.updateNPCs(game);

// Reload timers
for (const [, player] of game.players) {
    this.playerService.updateReload(player);
}
```

**Step 4: Extend projectile hit detection for NPCs**

In `updateProjectiles()` (after player hit detection, around line 306), add NPC hit detection:

```typescript
// NPC hit detection
for (const npc of game.npcs) {
    const dist = Math.hypot(npc.x - projectile.x, npc.y - projectile.y);
    if (dist < GAME.TILE_SIZE / 2) {
        npc.hp -= projectile.damage;
        toRemove.push(projectile.id);
        break;
    }
}
```

**Step 5: Extend melee hit detection for NPCs**

In `processMelee()` (after player melee logic), add NPC melee:

```typescript
// Also check NPCs
for (const npc of game.npcs) {
    const dist = Math.hypot(npc.x - attacker.x, npc.y - attacker.y);
    if (dist <= GAME.MELEE_RANGE) {
        const angleToNPC = Math.atan2(npc.y - attacker.y, npc.x - attacker.x);
        const angleDiff = Math.abs(attacker.rotation - angleToNPC);
        if (angleDiff < Math.PI / 2 || angleDiff > Math.PI * 1.5) {
            npc.hp -= DAMAGE.MELEE;  // Instant kill (99 damage vs 2 HP)
            break;
        }
    }
}
```

**Step 6: Integrate weapon mechanics into processInput()**

In `processInput()` where shooting is handled, wrap with weapon checks:

```typescript
if (input.shooting && this.playerService.canShoot(player)) {
    if (this.playerService.consumeAmmo(player)) {
        player.lastShotTime = Date.now();
        const stats = WEAPON_STATS[player.weapon.type];
        const spread = (Math.random() - 0.5) * 2 * stats.spreadRad;
        this.createProjectile(game, player, input.aimAngle + spread);
    }
}

if (input.reload) {
    this.playerService.startReload(player);
}

// Update pose
this.playerService.updatePose(player, input.shooting, input.melee);
```

**Step 7: Handle weapon drop on player death**

In the player death handling (both in projectile hit and melee), add weapon drop:

```typescript
if (result.died) {
    // Drop weapon if not pistol
    const weaponDrop = this.playerService.getDeathDrop(target);
    if (weaponDrop) {
        const dropItem: MapItem = {
            id: uuidv4(),
            type: 'machine_gun',
            x: target.x,
            y: target.y,
            isCollected: false,
            spawnedAt: Date.now(),
            weaponState: weaponDrop,
        };
        game.items.push(dropItem);
    }
    // ... existing death logic
}
```

**Step 8: Update processPickup() for weapon items**

In `processPickup()`, handle `machine_gun` type:

```typescript
if (item.type === 'machine_gun') {
    const oldWeapon = this.playerService.pickupWeapon(player, item.weaponState || { ...MACHINE_GUN_PICKUP });
    // If player had a weapon, drop it
    if (oldWeapon) {
        const dropItem: MapItem = {
            id: uuidv4(),
            type: 'machine_gun',
            x: item.x,
            y: item.y,
            isCollected: false,
            spawnedAt: Date.now(),
            weaponState: oldWeapon,
        };
        game.items.push(dropItem);
    }
}
```

**Step 9: Update serializeState() to include NPCs and weapon state**

Ensure the serialized game state sent to clients includes:
- `npcs` array with `{ id, type, x, y, hp, rotation, state }`
- Player `weapon`, `pose`, `isReloading` fields

**Step 10: Commit**

```bash
git add arena/backend/src/services/GameService.ts
git commit -m "feat(arena): implement NPC zombies and weapon mechanics in GameService

- Zombie spawn/wander/chase/damage AI in game tick loop
- Projectile and melee hit detection extended for NPCs
- NPC drops (40% health, 40% armor, 20% machine gun)
- Machine gun fire rate (100ms), spread, ammo consumption
- Reload integration in tick loop
- Weapon drop on player death
- Weapon swap on pickup"
```

---

## Task 8: Update SocketService for New Events

**Files:**
- Modify: `arena/backend/src/services/SocketService.ts`

**Step 1: Add reload event handler**

In the socket event setup (around line 265), add:

```typescript
socket.on('player-reload', (data: { matchId: string }) => {
    // Handled via player-input.reload flag, but accept dedicated event too
    const game = this.gameService.getGame(data.matchId);
    if (!game) return;
    const player = game.players.get(socket.data.userId);
    if (!player) return;
    this.gameService.playerService.startReload(player);
});
```

**Step 2: Ensure game-state broadcast includes NPCs**

The `serializeState()` in GameService should already include `npcs` (from Task 7 Step 9). Verify the broadcast callback sends the full serialized state.

**Step 3: Commit**

```bash
git add arena/backend/src/services/SocketService.ts
git commit -m "feat(arena): add reload socket event handler"
```

---

## Task 9: Write Integration Tests

**Files:**
- Modify: `arena/backend/src/services/GameService.test.ts` (add NPC + weapon test cases)

**Step 1: Add NPC spawn test**

```typescript
describe('NPC zombies', () => {
    it('spawns NPCs after spawn interval', () => {
        // Start match, advance ticks past NPC spawn interval
        // Verify game.npcs.length > 0
    });

    it('zombie chases player within aggro range', () => {
        // Place zombie near player, run tick
        // Verify zombie state becomes 'chase' and moves toward player
    });

    it('zombie deals contact damage', () => {
        // Place zombie at player position, run tick
        // Verify player took 1 damage
    });

    it('zombie dies from 2 gunshots', () => {
        // Create zombie with 2 HP, apply 2 projectile hits
        // Verify zombie removed and item dropped
    });

    it('zombie dies instantly from melee', () => {
        // Melee does 99 damage, zombie has 2 HP
    });
});
```

**Step 2: Add weapon test**

```typescript
describe('machine gun mechanics', () => {
    it('machine gun fires faster than pistol', () => {
        // Verify 100ms vs 400ms cooldown
    });

    it('machine gun drops on player death', () => {
        // Kill player with machine gun, verify item spawned
    });

    it('weapon swap drops old weapon', () => {
        // Give player machine gun, pick up another, verify drop
    });
});
```

**Step 3: Run all tests**

```bash
cd arena/backend && npx vitest run
```

**Step 4: Commit**

```bash
git add arena/backend/src/services/GameService.test.ts
git commit -m "test(arena): add integration tests for NPCs and weapon mechanics"
```

---

## Task 10: Final Integration & Deploy

**Step 1: Run full test suite**

```bash
cd arena && npm run test:all
```

**Step 2: Run typecheck**

```bash
cd arena && npm run typecheck
```

**Step 3: Test locally**

```bash
# Terminal 1: Backend
cd arena && npm run dev:backend

# Terminal 2: Frontend
cd arena && npm run dev:frontend
```

Verify in browser at http://localhost:3002:
- [ ] Characters render as visible sprites (soldier, hitman, etc.)
- [ ] Floor tiles are visible (dirt/sand pattern)
- [ ] Rotation works — character sprite rotates to face mouse
- [ ] Items render as visible sprites (green gem, blue rock, grey ammo box)
- [ ] Cover objects render (trees, barrels, crates)
- [ ] Zombies spawn and wander
- [ ] Zombies chase when player approaches
- [ ] Zombies die from gun/melee
- [ ] Zombies drop items on death
- [ ] Machine gun pickup works (pose changes to _machine)
- [ ] Ammo counter shows in HUD
- [ ] Reload with R key works (pose changes to _reload for 2s)
- [ ] Machine gun auto-discards when empty
- [ ] Weapon drops on death

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(arena): integration fixes for sprites, NPCs, and weapons"
```

**Step 5: Deploy**

```bash
./k8s/scripts/deploy/deploy-arena.sh
```

**Step 6: Verify deployment**

```bash
./k8s/scripts/deploy/deploy-tracker.sh status
```

Visit https://arena.korczewski.de and verify sprites load correctly in production.
