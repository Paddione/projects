# Arena: Campus Courtyard Map & L2P Character Integration

## Summary

Replace the randomly generated arena map with a single hand-crafted "Campus Courtyard" map and swap the 5 medieval fantasy characters (warrior, rogue, mage, tank, zombie) for 5 L2P academic characters (student, professor, librarian, researcher, dean).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme | Campus Courtyard | Matches L2P academic character identity |
| Characters | Student, Professor, Librarian, Researcher, Dean | 5 to match current count; Graduate dropped (visual overlap with Student) |
| Map symmetry | Point-symmetric (hand-placed) | All 4 spawns visually balanced; cover defined explicitly per-quadrant (not algorithmic rotation — grid is non-square) |
| Map storage | TypeScript file (`maps/campus-courtyard.ts`) | One map, type-safe, no runtime loading |
| Map dimensions | 28×22 tiles (896×704 px) | Unchanged from current |

## Characters

### Mapping (Old → New)

| Old | New | Color Gradient | Visual Identity |
|-----|-----|---------------|-----------------|
| warrior | student | Cyan → Green (#00f2ff → #3eff8b) | Backpack, messy hair, eager |
| rogue | researcher | Green → Cyan (#3eff8b → #00f2ff) | Lab coat, goggles, wild hair |
| mage | professor | Purple → Cyan (#bc13fe → #00f2ff) | Glasses, suit, tie |
| tank | dean | Gold → Cyan (#ffd700 → #00f2ff) | Formal, authoritative |
| zombie | librarian | Pink → Cyan (#ff6b9d → #00f2ff) | Professional, precise |

### What Changes

- `assets/manifest.json` — rename character IDs and update color values
- Sprite atlas `characters.json` / `characters.png` — new sprites needed (Blender render with L2P style)
- Backend: `LobbyService` default character → `student` (was `soldier`)
- Frontend: `Lobby.tsx` hardcoded `warrior` → `student`
- Frontend: `Game.tsx` line 479 fallback `warrior` → `student`
- Frontend: `AssetService.ts` — update character IDs + JSDoc examples referencing old names
- Database: `players.selected_character` default → `student`
- All references to old character names in types, tests, UI

### Sprite Generation

Characters need 6 poses × 8 directions = 48 frames each, 5 characters = 240 frames total. Use existing Blender `character.blend` template. New 3D models needed in L2P cyberpunk neon style (dark body, neon accents matching each character's gradient).

## Map: Campus Courtyard

### Tile Types

| ID | Type | Appearance | Walkable |
|----|------|-----------|----------|
| 0 | Grass | Dark green, subtle variation | Yes |
| 1 | Wall | Perimeter boundary | No |
| 2 | Path | Stone, warm tan | Yes |

### Cover Objects

| Type | Replaces | HP | Blocks Movement | Blocks Projectiles | Blocks LoS | Slows |
|------|----------|----|----|----|----|-----|
| building | wall | -1 (indestructible) | Yes | Yes | Yes | No |
| bench | crate | 3 | Yes | Yes | Yes | No |
| fountain | pillar | -1 (indestructible) | Yes | Yes | Yes | No |
| hedge | bush | -1 (indestructible) | Yes (**changed** — bush was walkable) | No | No | No |
| pond | water | -1 (indestructible) | No | No | No | Yes |

### Layout

```
28 tiles wide × 22 tiles tall
Perimeter: wall tiles (row 0, row 21, col 0, col 27)
Center: 2×2 fountain at tiles (13,10), (14,10), (13,11), (14,11)
Paths: Cross shape — horizontal path at rows 10-11, vertical path at cols 13-14
```

#### Cover Placement (all 4 quadrants, hand-placed)

The grid is 28×22 (non-square), so true 90° rotation is not possible. Instead, all cover positions are defined explicitly in the map file, hand-balanced so each quadrant has equivalent cover density and types. The visual mockup (in `.superpowers/brainstorm/`) shows exact positions.

**Per-quadrant pattern** (visually balanced, not algorithmically rotated):
- **L-shaped building facade**: 3+2 tiles near each corner, oriented to create a room/alcove
- **3 hedges**: Along the path approach toward center
- **2 benches**: Near spawn and along nearest path
- **1 bench**: Near the path intersection leading to center
- **2×2 pond**: Offset in the quadrant interior
- **1 hedge**: Near the central cross path

Total cover: ~40 objects (4×10 per quadrant + 4 fountain tiles at center).

### Spawn Points

| Corner | Tile Position | Pixel Position |
|--------|--------------|----------------|
| Top-left | (2, 2) | (80, 80) |
| Top-right | (25, 2) | (816, 80) |
| Bottom-right | (25, 19) | (816, 624) |
| Bottom-left | (2, 19) | (80, 624) |

### Item Spawn Points

12 points along the central cross paths, forcing players toward mid-map:
- Horizontal path: (7,10), (7,11), (20,10), (20,11)
- Vertical path: (13,5), (14,5), (13,16), (14,16)
- Near center: (10,10), (17,11), (13,8), (14,13)

## Implementation Scope

### Backend Changes

1. **New file**: `arena/backend/src/maps/campus-courtyard.ts` — exports tile grid, cover objects, spawn points, item spawn points
2. **Modify**: `GameService.generateMap()` — return static map data instead of randomizing
3. **Modify**: `GameService.randomCoverType()` — remove (cover is predefined)
4. **Modify**: Cover type definitions in `types/game.ts` — rename types (wall→building, crate→bench, pillar→fountain, bush→hedge, water→pond)
5. **Modify**: Default character references — `warrior` → `student`

### Frontend Changes

1. **Modify**: `Game.tsx` `renderMap()` — render 3 tile types (grass, wall, path) instead of just floor variations
2. **Modify**: `Game.tsx` cover rendering — render cover objects visually (currently invisible!)
3. **Modify**: `AssetService.ts` — update character IDs, JSDoc comments, add `getTileTexture(tileType)` method for grass/wall/path dispatch (current `getFloorTiles()` only returns `floor_01`–`floor_04`)
4. **Modify**: `Lobby.tsx` — default character `student`
5. **Modify**: `Game.tsx` line 479 — character fallback `warrior` → `student`
6. **Modify**: Sprite atlases — new character + cover + tile sprites needed

### Asset Pipeline

1. Update `assets/manifest.json` with new character IDs and cover types
2. Create/source 3D models for 5 characters in L2P neon style
3. Render sprites via Blender pipeline (phase 3)
4. Create new tile sprites (grass, path) and cover sprites (building, bench, fountain, hedge, pond)
5. Pack into atlases (phase 4)

### Database

- Migration: Update `players.selected_character` default from `'soldier'` to `'student'`
- Backfill: Update existing player records with old character names to new names (warrior→student, rogue→researcher, mage→professor, tank→dean, zombie→librarian, soldier→student)
- Fix existing migration `20260310_000000_backfill_players.sql` line 24 — hardcoded `'warrior'` fallback → `'student'`

### Tests

- Update `GameService.test.ts` — map is now static, test exact dimensions and cover counts
- Update character references in all test files: `app.integration.test.ts`, `GameService.test.ts`, `LobbyService.test.ts`, `Home.test.tsx`, `MatchResults.test.tsx`
- Frontend tests — update character name assertions (`warrior`/`soldier` → `student`)

## Gameplay Changes

- **Hedge blocks movement** (bush did not): Players cannot walk through hedges. This is intentional — hedges are solid barriers that don't block projectiles, creating a "you can shoot over/through but can't walk through" mechanic. This replaces bush which was purely visual concealment with no collision.
- **Map is static**: No more random cover placement. Every match uses the same layout. This rewards map knowledge and makes the game more competitive.

## Out of Scope

- Character selection UI (already tracked separately — all players currently hardcoded)
- Character-specific stats or abilities (all characters are cosmetic)
- Multiple maps / map selection
- Map editor tooling
