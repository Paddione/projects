# Arena: Campus Courtyard Map & L2P Characters — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the random arena map with a hand-crafted Campus Courtyard and swap medieval characters for L2P academic characters.

**Architecture:** Static map defined in TypeScript, imported by GameService. Cover types renamed but gameplay properties preserved (except hedge now blocks movement). Character IDs renamed throughout backend/frontend/tests/database. New sprites needed but deferred to asset pipeline phase.

**Tech Stack:** TypeScript, Vitest, PostgreSQL migrations, PixiJS (frontend rendering)

**Spec:** `docs/superpowers/specs/2026-03-10-arena-map-and-characters-design.md`

---

## Chunk 1: Backend — Types, Map File, GameService

### Task 1: Rename CoverType in types/game.ts

**Files:**
- Modify: `arena/backend/src/types/game.ts:75`

- [ ] **Step 1: Update the CoverType union**

In `arena/backend/src/types/game.ts:75`, change:
```typescript
export type CoverType = 'wall' | 'crate' | 'pillar' | 'bush' | 'water';
```
to:
```typescript
export type CoverType = 'building' | 'bench' | 'fountain' | 'hedge' | 'pond';
```

- [ ] **Step 2: Verify TypeScript catches all old references**

Run: `cd arena/backend && npx tsc --noEmit 2>&1 | head -40`
Expected: Type errors in GameService.ts where old cover names are used. This confirms the type system will guide the remaining fixes.

---

### Task 2: Create the static map file

**Files:**
- Create: `arena/backend/src/maps/campus-courtyard.ts`

- [ ] **Step 1: Create the map file with tile grid, cover, spawns, and item spawns**

Create `arena/backend/src/maps/campus-courtyard.ts`:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { GameMap, CoverObject, SpawnPoint } from '../types/game.js';
import { GAME } from '../types/game.js';

const W = GAME.MAP_WIDTH_TILES;  // 28
const H = GAME.MAP_HEIGHT_TILES; // 22
const T = GAME.TILE_SIZE;        // 32

// Tile grid: 0=grass, 1=wall (perimeter), 2=path
function createTiles(): number[][] {
    const tiles: number[][] = Array(H).fill(null).map(() => Array(W).fill(0));

    // Perimeter walls
    for (let x = 0; x < W; x++) { tiles[0][x] = 1; tiles[H - 1][x] = 1; }
    for (let y = 0; y < H; y++) { tiles[y][0] = 1; tiles[y][W - 1] = 1; }

    // Horizontal cross path (rows 10-11, full width)
    for (let x = 1; x < W - 1; x++) { tiles[10][x] = 2; tiles[11][x] = 2; }

    // Vertical cross path (cols 13-14, full height)
    for (let y = 1; y < H - 1; y++) { tiles[y][13] = 2; tiles[y][14] = 2; }

    return tiles;
}

type CoverDef = { type: CoverObject['type']; tx: number; ty: number };

// All cover objects, hand-placed for visual balance across 4 quadrants.
// Each quadrant has: L-shaped building, 4 hedges, 3 benches, 2x2 pond.
const COVER_DEFS: CoverDef[] = [
    // === Central fountain (2x2) ===
    { type: 'fountain', tx: 13, ty: 10 },
    { type: 'fountain', tx: 14, ty: 10 },
    { type: 'fountain', tx: 13, ty: 11 },
    { type: 'fountain', tx: 14, ty: 11 },

    // === Top-left quadrant ===
    // Building L-shape
    { type: 'building', tx: 3, ty: 3 }, { type: 'building', tx: 4, ty: 3 }, { type: 'building', tx: 5, ty: 3 },
    { type: 'building', tx: 3, ty: 4 }, { type: 'building', tx: 3, ty: 5 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 12, ty: 3 }, { type: 'hedge', tx: 12, ty: 5 }, { type: 'hedge', tx: 12, ty: 7 },
    { type: 'hedge', tx: 10, ty: 9 },
    // Benches
    { type: 'bench', tx: 6, ty: 2 }, { type: 'bench', tx: 2, ty: 6 }, { type: 'bench', tx: 9, ty: 9 },
    // Pond 2x2
    { type: 'pond', tx: 8, ty: 5 }, { type: 'pond', tx: 9, ty: 5 },
    { type: 'pond', tx: 8, ty: 6 }, { type: 'pond', tx: 9, ty: 6 },

    // === Top-right quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 22, ty: 3 }, { type: 'building', tx: 23, ty: 3 }, { type: 'building', tx: 24, ty: 3 },
    { type: 'building', tx: 24, ty: 4 }, { type: 'building', tx: 24, ty: 5 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 15, ty: 3 }, { type: 'hedge', tx: 15, ty: 5 }, { type: 'hedge', tx: 15, ty: 7 },
    { type: 'hedge', tx: 17, ty: 9 },
    // Benches
    { type: 'bench', tx: 21, ty: 2 }, { type: 'bench', tx: 25, ty: 6 }, { type: 'bench', tx: 18, ty: 9 },
    // Pond 2x2
    { type: 'pond', tx: 18, ty: 5 }, { type: 'pond', tx: 19, ty: 5 },
    { type: 'pond', tx: 18, ty: 6 }, { type: 'pond', tx: 19, ty: 6 },

    // === Bottom-left quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 3, ty: 16 }, { type: 'building', tx: 3, ty: 17 },
    { type: 'building', tx: 3, ty: 18 }, { type: 'building', tx: 4, ty: 18 }, { type: 'building', tx: 5, ty: 18 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 12, ty: 14 }, { type: 'hedge', tx: 12, ty: 16 }, { type: 'hedge', tx: 12, ty: 18 },
    { type: 'hedge', tx: 10, ty: 12 },
    // Benches
    { type: 'bench', tx: 6, ty: 19 }, { type: 'bench', tx: 2, ty: 15 }, { type: 'bench', tx: 9, ty: 12 },
    // Pond 2x2
    { type: 'pond', tx: 8, ty: 15 }, { type: 'pond', tx: 9, ty: 15 },
    { type: 'pond', tx: 8, ty: 16 }, { type: 'pond', tx: 9, ty: 16 },

    // === Bottom-right quadrant ===
    // Building L-shape (mirrored)
    { type: 'building', tx: 24, ty: 16 }, { type: 'building', tx: 24, ty: 17 },
    { type: 'building', tx: 22, ty: 18 }, { type: 'building', tx: 23, ty: 18 }, { type: 'building', tx: 24, ty: 18 },
    // Hedges along vertical path approach
    { type: 'hedge', tx: 15, ty: 14 }, { type: 'hedge', tx: 15, ty: 16 }, { type: 'hedge', tx: 15, ty: 18 },
    { type: 'hedge', tx: 17, ty: 12 },
    // Benches
    { type: 'bench', tx: 21, ty: 19 }, { type: 'bench', tx: 25, ty: 15 }, { type: 'bench', tx: 18, ty: 12 },
    // Pond 2x2
    { type: 'pond', tx: 18, ty: 15 }, { type: 'pond', tx: 19, ty: 15 },
    { type: 'pond', tx: 18, ty: 16 }, { type: 'pond', tx: 19, ty: 16 },
];

function createCover(): CoverObject[] {
    return COVER_DEFS.map((def) => ({
        id: uuidv4(),
        type: def.type,
        x: def.tx * T,
        y: def.ty * T,
        width: T,
        height: T,
        hp: def.type === 'bench' ? 3 : -1,
        blocksProjectiles: def.type !== 'hedge' && def.type !== 'pond',
        blocksLineOfSight: def.type !== 'hedge' && def.type !== 'pond',
        blocksMovement: def.type !== 'pond',
        slowsMovement: def.type === 'pond',
    }));
}

const SPAWN_POINTS: SpawnPoint[] = [
    { x: 2, y: 2, corner: 'top-left' },
    { x: W - 3, y: 2, corner: 'top-right' },
    { x: 2, y: H - 3, corner: 'bottom-left' },
    { x: W - 3, y: H - 3, corner: 'bottom-right' },
];

const ITEM_SPAWN_POINTS: { x: number; y: number }[] = [
    // Horizontal path
    { x: 7, y: 10 }, { x: 7, y: 11 }, { x: 20, y: 10 }, { x: 20, y: 11 },
    // Vertical path
    { x: 13, y: 5 }, { x: 14, y: 5 }, { x: 13, y: 16 }, { x: 14, y: 16 },
    // Near center
    { x: 10, y: 10 }, { x: 17, y: 11 }, { x: 13, y: 8 }, { x: 14, y: 13 },
];

export function createCampusCourtyard(): GameMap {
    return {
        width: W,
        height: H,
        tileSize: T,
        tiles: createTiles(),
        coverObjects: createCover(),
        spawnPoints: SPAWN_POINTS,
        itemSpawnPoints: ITEM_SPAWN_POINTS,
    };
}

/** Number of cover objects in the static map (for tests). */
export const CAMPUS_COURTYARD_COVER_COUNT = COVER_DEFS.length;
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd arena/backend && npx tsc --noEmit 2>&1 | grep campus`
Expected: No errors from the new file (other files still have old cover type references).

---

### Task 3: Update GameService to use static map

**Files:**
- Modify: `arena/backend/src/services/GameService.ts:1199-1273`

- [ ] **Step 1: Replace generateMap() and remove randomCoverType()**

In `arena/backend/src/services/GameService.ts`, add the import at the top:
```typescript
import { createCampusCourtyard } from '../maps/campus-courtyard.js';
```

Replace `generateMap()` (lines 1199-1268) with:
```typescript
private generateMap(): GameMap {
    return createCampusCourtyard();
}
```

Delete `randomCoverType()` (lines 1270-1273) and `isNearCorner()` (lines 1275 onward, if only used by generateMap — check first).

- [ ] **Step 2: Update all cover type string literals in GameService**

Search for `'crate'`, `'bush'`, `'water'`, `'wall'` (as cover type) and `'pillar'` in GameService.ts and replace:
- `'crate'` → `'bench'` (in grenade damage, cover destruction logic)
- `'bush'` → `'hedge'` (if referenced anywhere)
- `'water'` → `'pond'` (if referenced anywhere)
- Cover property checks should already work since they use boolean fields, not type strings

- [ ] **Step 3: Verify it compiles**

Run: `cd arena/backend && npx tsc --noEmit`
Expected: Clean (no errors).

- [ ] **Step 4: Run tests to see what breaks**

Run: `cd arena/backend && npx vitest run 2>&1 | tail -20`
Expected: Some GameService tests may fail due to map now being static (different cover count, deterministic layout). Note which tests fail — we'll fix them in Task 4.

- [ ] **Step 5: Commit**

```bash
git add arena/backend/src/types/game.ts arena/backend/src/maps/campus-courtyard.ts arena/backend/src/services/GameService.ts
git commit -m "feat(arena): add Campus Courtyard static map, rename cover types"
```

---

### Task 4: Fix backend tests for static map

**Files:**
- Modify: `arena/backend/src/services/GameService.test.ts`

- [ ] **Step 1: Update map generation tests**

The current tests check for random map properties (cover count 25-39, random positions). Update to check static map properties:
- Exact cover count: import `CAMPUS_COURTYARD_COVER_COUNT` from `../maps/campus-courtyard.js`
- Exact dimensions: 28×22
- Perimeter walls still at edges
- Cover types are now `'building'`, `'bench'`, `'fountain'`, `'hedge'`, `'pond'`
- Spawn points at known positions

- [ ] **Step 2: Update cover type references in tests**

Replace all test assertions checking for old cover type names:
- `'wall'` (as cover) → `'building'`
- `'crate'` → `'bench'`
- `'pillar'` → `'fountain'`
- `'bush'` → `'hedge'`
- `'water'` → `'pond'`

- [ ] **Step 3: Run tests**

Run: `cd arena/backend && npx vitest run src/services/GameService.test.ts 2>&1 | tail -20`
Expected: All GameService tests pass.

- [ ] **Step 4: Commit**

```bash
git add arena/backend/src/services/GameService.test.ts
git commit -m "test(arena): update GameService tests for static Campus Courtyard map"
```

---

## Chunk 2: Backend — Character Rename & Database

### Task 5: Rename character defaults in backend

**Files:**
- Modify: `arena/backend/src/services/LobbyService.ts:75`
- Modify: `arena/backend/src/app.ts` (if any character references)
- Modify: `arena/assets/manifest.json`

- [ ] **Step 1: Update LobbyService default character**

In `arena/backend/src/services/LobbyService.ts:75`, change:
```typescript
character: request.selectedCharacter || 'soldier',
```
to:
```typescript
character: request.selectedCharacter || 'student',
```

- [ ] **Step 2: Update manifest.json character IDs**

In `arena/assets/manifest.json`, replace the 5 character entries:
- `"id": "warrior"` → `"id": "student"`, color `"#00f2ff"`
- `"id": "rogue"` → `"id": "researcher"`, color `"#3eff8b"`
- `"id": "mage"` → `"id": "professor"`, color `"#bc13fe"`
- `"id": "tank"` → `"id": "dean"`, color `"#ffd700"`
- `"id": "zombie"` → `"id": "librarian"`, color `"#ff6b9d"`

Also update the cover section IDs:
- `"id": "wall_cover"` → `"id": "building"`
- `"id": "crate"` → `"id": "bench"`
- `"id": "pillar"` → `"id": "fountain"`
- `"id": "bush"` → `"id": "hedge"`
- `"id": "water"` → `"id": "pond"`

- [ ] **Step 3: Verify backend compiles**

Run: `cd arena/backend && npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add arena/backend/src/services/LobbyService.ts arena/assets/manifest.json
git commit -m "feat(arena): rename characters to L2P academic theme, update manifest"
```

---

### Task 6: Database migration for character rename

**Files:**
- Create: `arena/backend/migrations/20260310_000001_rename_characters.sql`
- Modify: `arena/backend/migrations/20260310_000000_backfill_players.sql:23` (fix hardcoded fallback)

- [ ] **Step 1: Create character rename migration**

Create `arena/backend/migrations/20260310_000001_rename_characters.sql`:
```sql
-- Migration: Rename characters from medieval to L2P academic theme
-- Date: 2026-03-10

BEGIN;

-- Update players table defaults and existing values
ALTER TABLE players ALTER COLUMN selected_character SET DEFAULT 'student';

UPDATE players SET selected_character = CASE selected_character
    WHEN 'warrior' THEN 'student'
    WHEN 'soldier' THEN 'student'
    WHEN 'rogue' THEN 'researcher'
    WHEN 'mage' THEN 'professor'
    WHEN 'tank' THEN 'dean'
    WHEN 'zombie' THEN 'librarian'
    ELSE selected_character
END
WHERE selected_character IN ('warrior', 'soldier', 'rogue', 'mage', 'tank', 'zombie');

-- Update match_results character names
UPDATE match_results SET character_name = CASE character_name
    WHEN 'warrior' THEN 'student'
    WHEN 'soldier' THEN 'student'
    WHEN 'rogue' THEN 'researcher'
    WHEN 'mage' THEN 'professor'
    WHEN 'tank' THEN 'dean'
    WHEN 'zombie' THEN 'librarian'
    ELSE character_name
END
WHERE character_name IN ('warrior', 'soldier', 'rogue', 'mage', 'tank', 'zombie');

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('20260310_000001_rename_characters', 'Rename characters from medieval to L2P academic theme');

COMMIT;
```

- [ ] **Step 2: Fix the backfill migration fallback**

In `arena/backend/migrations/20260310_000000_backfill_players.sql:23`, change:
```sql
        'warrior'
```
to:
```sql
        'student'
```

- [ ] **Step 3: Commit**

```bash
git add arena/backend/migrations/
git commit -m "feat(arena): add character rename migration, fix backfill fallback"
```

---

### Task 7: Fix backend integration tests

**Files:**
- Modify: `arena/backend/src/app.integration.test.ts`
- Modify: `arena/backend/src/services/LobbyService.test.ts`

- [ ] **Step 1: Update character references in app.integration.test.ts**

Replace all occurrences:
- `character: 'soldier'` → `character: 'student'`
- `selected_character: 'soldier'` → `selected_character: 'student'`
- Any `'warrior'`, `'rogue'`, `'mage'` in test data → corresponding new names

- [ ] **Step 2: Update LobbyService.test.ts**

Replace character references:
- Default character checks: `'soldier'` → `'student'`
- Any explicit character selections using old names

- [ ] **Step 3: Run all backend tests**

Run: `cd arena/backend && npx vitest run 2>&1 | tail -20`
Expected: All tests pass (or only the pre-existing cover destruction test fails).

- [ ] **Step 4: Commit**

```bash
git add arena/backend/src/app.integration.test.ts arena/backend/src/services/LobbyService.test.ts
git commit -m "test(arena): update backend tests for L2P character names"
```

---

## Chunk 3: Frontend — Character Rename & Map Rendering

### Task 8: Rename characters in frontend

**Files:**
- Modify: `arena/frontend/src/components/Lobby.tsx:31`
- Modify: `arena/frontend/src/components/Game.tsx:479`
- Modify: `arena/frontend/src/services/AssetService.ts:91`

- [ ] **Step 1: Update Lobby.tsx default character**

In `arena/frontend/src/components/Lobby.tsx:31`, change:
```typescript
character: 'warrior',
```
to:
```typescript
character: 'student',
```

- [ ] **Step 2: Update Game.tsx character fallback**

In `arena/frontend/src/components/Game.tsx:479`, change:
```typescript
const charId = player.character || 'warrior';
```
to:
```typescript
const charId = player.character || 'student';
```

- [ ] **Step 3: Update AssetService.ts JSDoc**

In `arena/frontend/src/services/AssetService.ts:91`, update the comment from:
```
* @param characterId e.g. 'warrior', 'rogue', 'mage', 'tank'
```
to:
```
* @param characterId e.g. 'student', 'professor', 'researcher', 'dean', 'librarian'
```

- [ ] **Step 4: Commit**

```bash
git add arena/frontend/src/components/Lobby.tsx arena/frontend/src/components/Game.tsx arena/frontend/src/services/AssetService.ts
git commit -m "feat(arena): rename frontend character references to L2P theme"
```

---

### Task 9: Update frontend map rendering for tile types

**Files:**
- Modify: `arena/frontend/src/components/Game.tsx:312-356` (renderMap function)

- [ ] **Step 1: Update renderMap() to handle 3 tile types**

The current `renderMap()` only renders floor tiles with hash-based variation. Update it to dispatch on tile type:
- Tile 0 (grass): Use existing floor tile sprites or dark green procedural colors (`0x1a2e1a`, `0x1c301c`)
- Tile 1 (wall): Use a distinct wall color (`0x2a2a4a`) or wall sprite
- Tile 2 (path): Use a warm stone color (`0x2a2520`, `0x282320`) or path sprite

In the sprite-based branch, replace `getFloorTiles()` random selection with tile-type-aware rendering:
```typescript
// Inside the tile loop:
const tileType = state.map?.tiles?.[ty]?.[tx] ?? 0;
let texture: Texture | null = null;
if (tileType === 1) {
    texture = AssetService.getSprite('tiles', 'wall_01');
} else if (tileType === 2) {
    texture = AssetService.getSprite('tiles', 'path_01');
} else {
    const floorTiles = AssetService.getFloorTiles();
    const hash = (tx * 7919 + ty * 104729) % floorTiles.length;
    texture = floorTiles[hash] || null;
}
```

In the procedural fallback branch, add colors for wall and path tiles:
```typescript
const tileType = state.map?.tiles?.[ty]?.[tx] ?? 0;
let color: number;
if (tileType === 1) {
    color = 0x2a2a4a; // wall - dark blue-gray
} else if (tileType === 2) {
    color = (tx + ty) % 2 === 0 ? 0x2a2520 : 0x282320; // path - warm stone
} else {
    const hash = (tx * 7919 + ty * 104729) % 4;
    color = [0x1a2e1a, 0x1c301c, 0x182a18, 0x1e321e][hash]; // grass - green variants
}
```

- [ ] **Step 2: Add cover object rendering to the render loop**

Cover objects are currently invisible. Add a `renderCover()` function after `renderMap()` in the render loop (around line 290). Cover should render between the map layer and item layer:

```typescript
function renderCover(container: Container, state: any) {
    if (!state.map?.coverObjects) return;

    for (const cover of state.map.coverObjects) {
        if (cover.hp === 0) continue; // destroyed

        const coverSprite = AssetService.getSprite('cover', cover.type);
        if (coverSprite) {
            const sprite = new Sprite(coverSprite);
            sprite.position.set(cover.x, cover.y);
            sprite.width = cover.width;
            sprite.height = cover.height;
            container.addChild(sprite);
        } else {
            // Procedural fallback
            const g = new Graphics();
            const colors: Record<string, number> = {
                building: 0x3a3a5a,
                bench: 0x5a4020,
                fountain: 0x1a3a5a,
                hedge: 0x1a4a2a,
                pond: 0x0a2a4a,
            };
            g.beginFill(colors[cover.type] || 0x444444, 0.8);
            g.drawRect(cover.x, cover.y, cover.width, cover.height);
            g.endFill();
            container.addChild(g);
        }
    }
}
```

Add `renderCover(mapLayer, state);` after `renderMap(mapLayer, state);` in the render loop.

- [ ] **Step 3: Run frontend build to verify**

Run: `cd arena/frontend && npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add arena/frontend/src/components/Game.tsx
git commit -m "feat(arena): render tile types (grass/wall/path) and cover objects"
```

---

### Task 10: Fix frontend tests

**Files:**
- Modify: `arena/frontend/src/components/Home.test.tsx`
- Modify: `arena/frontend/src/components/MatchResults.test.tsx`

- [ ] **Step 1: Update Home.test.tsx character references**

Replace test data:
- `'warrior'` → `'student'`
- `'rogue'` → `'researcher'`
- `'mage'` → `'professor'`

- [ ] **Step 2: Update MatchResults.test.tsx character references**

Same replacements as above in match result test data.

- [ ] **Step 3: Run frontend tests**

Run: `cd arena/frontend && npx vitest run 2>&1 | tail -20`
Expected: All frontend tests pass.

- [ ] **Step 4: Commit**

```bash
git add arena/frontend/src/components/Home.test.tsx arena/frontend/src/components/MatchResults.test.tsx
git commit -m "test(arena): update frontend tests for L2P character names"
```

---

## Chunk 4: Final Verification & Deploy

### Task 11: Full test suite + typecheck

- [ ] **Step 1: Run full backend tests**

Run: `cd arena/backend && npx vitest run`
Expected: All pass (except pre-existing cover destruction test).

- [ ] **Step 2: Run full frontend tests**

Run: `cd arena/frontend && npx vitest run`
Expected: All pass.

- [ ] **Step 3: Typecheck both packages**

Run: `cd arena && npm run typecheck`
Expected: Clean.

---

### Task 12: Deploy

- [ ] **Step 1: Run the database migration on production**

```bash
kubectl exec -n korczewski-infra deploy/postgres -- psql -U arena_user -d arena_db -f - < arena/backend/migrations/20260310_000001_rename_characters.sql
```

- [ ] **Step 2: Deploy arena**

```bash
./k8s/scripts/deploy/deploy-arena.sh
```

- [ ] **Step 3: Verify deployment**

```bash
curl -s https://arena.korczewski.de/api/health
./k8s/scripts/utils/deploy-tracker.sh status
```

- [ ] **Step 4: Final commit with all changes**

If any uncommitted changes remain, commit them:
```bash
git add -A arena/ k8s/services/arena-backend/ docs/
git commit -m "feat(arena): Campus Courtyard map + L2P characters — complete"
```

---

## Asset Pipeline (Deferred — Requires Manual Work)

New sprites are needed but require Blender rendering (3D models don't exist yet for L2P characters). Until then, the procedural fallback rendering will work for both tiles and cover. The game is fully playable without sprites.

When ready to create sprites:
1. Create 3D models for student, professor, librarian, researcher, dean in L2P neon cyberpunk style
2. Create tile sprites: `grass_01`–`grass_04`, `wall_01`, `path_01`–`path_02`
3. Create cover sprites: `building`, `bench`, `fountain`, `hedge`, `pond`
4. Run `./scripts/generate_all.sh --phase 3` (Blender render)
5. Run `./scripts/generate_all.sh --phase 4` (sprite pack)
