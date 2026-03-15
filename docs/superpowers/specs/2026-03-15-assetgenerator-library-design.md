# Assetgenerator: Audio & Visual Asset Library

**Date**: 2026-03-15
**Status**: Approved
**Project**: Assetgenerator (extending existing service)
**Depends on**: `2026-03-15-assetgenerator-audio-review-design.md` (already implemented)

## Summary

Extend the Assetgenerator with two shared asset libraries — Audio and Visual — that serve as the central source of truth for all projects in the monorepo. Assets are stored on the NAS, managed via the web UI, and copied into projects on assignment. The visual library includes a full pipeline UI (concept → 3D model → Blender render → atlas packing) with per-phase control.

## Problem

- Audio and visual assets are currently scattered across individual projects (arena has 23 sounds + 55 sprites, L2P has 40 sounds)
- No way to share assets between projects
- The visual generation pipeline (6 Python/TS scripts) is hardcoded to arena with no UI — generation is CLI-only
- Intermediate files (concepts, 3D models, renders) live in gitignored directories with no central tracking
- No way to know which project has which version of an asset

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Assetgenerator UI (localhost:5200)         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Audio Tab   │  │  Visual Tab  │  │  Review   │  │
│  │  (library)   │  │  (pipeline)  │  │  (legacy) │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┘  │
│         │                 │                          │
│  ┌──────▼─────────────────▼──────────┐               │
│  │         Express API server        │               │
│  │    library + visual-library +     │               │
│  │    adapters + SSE progress        │               │
│  └──────┬─────────────────┬──────────┘               │
└─────────┼─────────────────┼──────────────────────────┘
          │                 │
    ┌─────▼──────┐   ┌─────▼──────┐
    │ NAS: audio │   │NAS: visual │
    │  library/  │   │  library/  │
    └────────────┘   └────────────┘
          │                 │
    ┌─────▼─────────────────▼──────┐
    │    Project output dirs       │
    │  arena/frontend/public/...   │
    │  l2p/frontend/public/...     │
    └──────────────────────────────┘
```

---

## Part 1: Audio Library

### Audio Library Data Model (`library.json`)

```json
{
  "version": 1,
  "sounds": {
    "gunshot-sci-fi-01": {
      "id": "gunshot-sci-fi-01",
      "name": "Sci-Fi Laser Gunshot",
      "category": "sfx/weapons",
      "tags": ["arena", "sci-fi", "short", "laser"],
      "prompt": "sci-fi laser gunshot, short sharp burst",
      "seed": 2117503710,
      "duration": 0.5,
      "backend": "audiocraft",
      "filePath": "sfx/weapons/gunshot-sci-fi-01.wav",
      "createdAt": "2026-03-15T04:18:56Z",
      "assignedTo": {
        "arena": { "targetPath": "sfx/gunshot", "syncedAt": "2026-03-15T04:20:00Z" }
      }
    }
  }
}
```

- `category` determines NAS folder location, format: `{type}/{subcategory}`
- `tags` are freeform strings for filtering
- `filePath` is relative to the NAS audio library root
- `assignedTo` maps project names to their target path (without extension) and last sync timestamp
- `targetPath` is relative to the project's output directory (e.g., `sfx/gunshot` → copies as `sfx/gunshot.ogg` + `sfx/gunshot.mp3`)

### Audio NAS Structure

```
/mnt/pve3a/audio-library/
├── sfx/
│   ├── weapons/       # gunshots, melee swings, impacts
│   ├── footsteps/     # walking, sprinting, surface types
│   ├── impacts/       # bullet impacts, explosions
│   ├── ui/            # button clicks, notifications, modals
│   └── environment/   # ambient, zone warnings
└── music/
    ├── battle/        # combat themes
    ├── ambient/       # lobby, menu music
    └── stings/        # victory, defeat, round start/end
```

Each sound stored as WAV (master) + OGG + MP3 (processed). Processing is done inline by the server using `execFileSync('ffmpeg', [...])` — not delegating to `process_audio.sh` which has hardcoded arena paths. The ffmpeg commands replicate the same processing:

1. Normalize loudness (EBU R128: -16 LUFS for SFX, -20 LUFS for music) + trim silence
2. Convert to OGG (Opus @ 96kbps): `ffmpeg -y -i input.wav -af "silenceremove=...,loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 1 -c:a libopus -b:a 96k output.ogg`
3. Convert to MP3 (LAME @ 128kbps): `ffmpeg -y -i input.wav -af "..." -ar 44100 -ac 1 -c:a libmp3lame -b:a 128k output.mp3`

The processed OGG+MP3 are stored alongside the WAV on the NAS. On assign, only the OGG+MP3 are copied to the project.

### Audio Library Config (`config/library-config.json`)

```json
{
  "libraryRoot": "/mnt/pve3a/audio-library",
  "loudness": { "sfx": -16, "music": -20 },
  "categories": {
    "sfx": ["weapons", "footsteps", "impacts", "ui", "environment"],
    "music": ["battle", "ambient", "stings"]
  },
  "defaultTags": ["arena", "l2p", "sci-fi", "retro", "ui", "ambient"]
}
```

### Audio Library API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/library` | Returns full audio catalog with assignment status |
| `GET` | `/api/library/:id/audio` | Streams WAV/OGG/MP3 from NAS for preview |
| `POST` | `/api/library` | Create new sound entry |
| `PUT` | `/api/library/:id` | Update sound metadata (name, tags, category, prompt) |
| `DELETE` | `/api/library/:id` | Remove from library and NAS |
| `POST` | `/api/library/:id/assign` | Assign to project: process WAV → copy OGG/MP3 to project output dir. Body: `{ "project": "arena", "targetPath": "sfx/gunshot" }` |
| `POST` | `/api/library/:id/unassign` | Remove assignment, optionally delete from project. Body: `{ "project": "arena" }` |
| `POST` | `/api/library/import` | Import existing project sounds into library. Body: `{ "project": "arena" }` |
| `POST` | `/api/library/:id/generate` | Generate a new sound via adapter, store on NAS |
| `POST` | `/api/projects/:name/sync` | Sync all stale audio assignments for a project. Compares `createdAt` vs `syncedAt`, re-copies updated files. Returns list of synced sounds. |

### Audio Assignment Flow

1. Click "Assign to" → select project + specify target path (e.g., `sfx/gunshot`)
2. Server checks if processed OGG/MP3 exist on NAS alongside the WAV
3. If not, runs inline ffmpeg processing (normalize + convert to OGG + MP3) and stores results on NAS next to the WAV
4. Copies `{id}.ogg` and `{id}.mp3` from NAS to `{project.outputRoot}/{targetPath}.ogg` and `.mp3`
5. Records `assignedTo.{project}.syncedAt` timestamp

### Audio Sync Flow

1. Click "Sync" with project selected
2. Server compares each assigned sound's `createdAt` vs `assignedTo.{project}.syncedAt`
3. Returns list of stale sounds (regenerated since last sync)
4. UI shows stale list with "Sync All" button
5. Re-copies updated OGG/MP3 files, updates `syncedAt`
6. Optionally triggers deploy via project's `deployScript`

### Audio Import Flow (first run)

**Arena import:** Reads existing `Assetgenerator/projects/arena.json` state (prompts, seeds, durations). For each sound:
1. Copies WAV from `arena/assets/audio/{type}/{id}.wav` to NAS `audio-library/{category}/{id}.wav`
2. Maps arena SFX IDs to library subcategories using this table:

| Subcategory | Sound IDs |
|-------------|-----------|
| `sfx/weapons` | gunshot, gunshot_new, melee_swing, grenade_launch, grenade_explode |
| `sfx/footsteps` | footstep_walk, footstep_sprint |
| `sfx/impacts` | bullet_impact, player_hit, player_death |
| `sfx/ui` | health_pickup, armor_pickup, match_victory, match_defeat, round_start, round_end |
| `sfx/environment` | zone_warning, zone_tick |
| `music/battle` | battle |
| `music/ambient` | lobby |
| `music/stings` | victory, defeat, respectisevt |

3. Creates library entry with prompt/seed/duration from project state. IDs found in the arena state file but absent from `manifest.json` (e.g., `gunshot_new`, `respectisevt`) are imported with empty prompts — the user fills them in via the UI.
4. Sets `assignedTo.arena` with current target paths

**L2P import:** Scans `l2p/frontend/public/audio/*.mp3`. These are pre-made (no prompts/seeds), so:
1. Copies MP3 to NAS `audio-library/sfx/ui/` (most are UI sounds)
2. Creates library entry with empty prompt, category inferred from filename
3. Sets `assignedTo.l2p`

---

## Part 2: Visual Library

### Visual Library Data Model (`visual-library.json`)

```json
{
  "version": 1,
  "assets": {
    "warrior": {
      "id": "warrior",
      "name": "Warrior Character",
      "category": "characters",
      "tags": ["arena", "melee", "humanoid"],
      "prompt": "armored warrior character, low-poly stylized, game asset",
      "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
      "directions": 8,
      "size": 64,
      "color": "#00f2ff",
      "pipeline": {
        "concept": {
          "status": "done",
          "path": "concepts/characters/warrior.png",
          "backend": "comfyui",
          "generatedAt": "2026-03-10T10:00:00Z"
        },
        "model": {
          "status": "done",
          "path": "models/characters/warrior.glb",
          "backend": "triposr",
          "generatedAt": "2026-03-10T10:15:00Z"
        },
        "render": {
          "status": "done",
          "frameCount": 48,
          "generatedAt": "2026-03-10T10:16:00Z"
        },
        "pack": {
          "status": "done",
          "generatedAt": "2026-03-10T10:17:00Z"
        }
      },
      "assignedTo": {
        "arena": { "atlas": "characters", "syncedAt": "2026-03-10T12:00:00Z" }
      }
    }
  }
}
```

- `pipeline` tracks each phase's status: `pending`, `generating`, `done`, `error`
- `pipeline.concept.path` and `pipeline.model.path` are relative to NAS visual library root
- `poses` and `directions` determine render frame count (poses × directions = total frames)
- Categories with `directions: 1` (tiles, items, ui) produce single-angle renders
- `pipeline.packed` is true when renders have been packed into the category atlas
- When any upstream phase is regenerated, downstream phases are marked stale (status changes to `pending`)

### Visual NAS Structure

```
/mnt/pve3a/visual-library/
├── concepts/
│   ├── characters/        # 1024×1024 SDXL concept art
│   ├── weapons/
│   ├── items/
│   ├── tiles/
│   ├── cover/
│   └── ui/
├── models/
│   ├── characters/        # GLB 3D models (~2-5MB each)
│   ├── weapons/
│   ├── items/
│   └── cover/
├── renders/
│   ├── characters/
│   │   └── warrior/       # 256×256 PNG per pose×direction
│   │       ├── warrior-stand-N.png
│   │       └── ...
│   ├── weapons/
│   ├── items/
│   ├── tiles/
│   ├── cover/
│   └── ui/
├── sprites/
│   ├── characters.png     # Packed atlas
│   ├── characters.json    # PixiJS frame metadata
│   ├── weapons.png + .json
│   └── ...
└── blend/
    ├── character.blend    # Blender templates (moved from arena)
    ├── weapon.blend
    ├── item.blend
    ├── tile.blend
    ├── cover.blend
    ├── ui.blend
    └── _shared/
        └── materials.blend
```

### Visual Library Config (`config/visual-config.json`)

```json
{
  "libraryRoot": "/mnt/pve3a/visual-library",
  "blenderPath": "blender",
  "categories": {
    "characters": {
      "directions": 8,
      "defaultPoses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
      "size": 64,
      "conceptResolution": 1024,
      "has3D": true
    },
    "weapons": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "animated": true,
      "has3D": true
    },
    "items": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": true
    },
    "tiles": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": false,
      "conceptResolution": 512
    },
    "cover": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": true
    },
    "ui": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 16,
      "has3D": false,
      "conceptResolution": 512
    }
  },
  "render": {
    "engine": "EEVEE",
    "resolution": 256,
    "format": "PNG"
  },
  "atlas": {
    "maxSize": 2048,
    "padding": 2,
    "powerOfTwo": true
  },
  "tags": ["arena", "fantasy", "sci-fi", "medieval", "modern", "nature"]
}
```

- `has3D: false` categories (tiles, ui) skip the model phase — concepts go directly to renders
- `animated: true` categories produce multi-frame sequences
- `conceptResolution` varies by category (characters need detail, tiles don't)

### Visual Pipeline Backends & Adapters

| Phase | Adapters | Default | Spawns |
|-------|----------|---------|--------|
| Concept | `comfyui.js`, `diffusers.js` | comfyui | Python: `scripts/generate_concepts.py --id <id> --prompt "..." --output <path>` |
| Model | `triposr.js`, `meshy.js` | triposr | Python: `scripts/generate_3d.py --id <id> --input <concept.png> --output <path>` |
| Render | `blender.js` | blender | `blender --background --python scripts/render_sprites.py -- --id <id> --model <glb> --template <blend> --output <dir>` |
| Pack | `packer.js` | packer | `npx tsx scripts/pack_sprites.ts --category <cat> --input <renders/> --output <sprites/>` |

All adapters use `spawn()` with explicit argument arrays (no shell injection). Each adapter:
1. Resolves paths relative to NAS library root
2. Spawns the Python/Node process
3. Captures stdout/stderr for SSE progress streaming
4. Returns result metadata (paths, frame counts, file sizes)

The adapter interface extends the audio pattern:
```js
export async function generate({ id, asset, config, libraryRoot }) {
  // Run generation, write to libraryRoot
  // Return { status: 'done', path: '...', metadata: {...} }
}
```

### Visual Library API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/visual-library` | Returns full visual catalog with pipeline status |
| `GET` | `/api/visual-library/:id` | Single asset with full pipeline details |
| `GET` | `/api/visual-library/:id/concept` | Streams concept PNG from NAS |
| `GET` | `/api/visual-library/:id/model` | Streams GLB from NAS |
| `GET` | `/api/visual-library/:id/render/:pose/:direction` | Streams individual render frame |
| `GET` | `/api/visual-library/:id/atlas` | Streams packed atlas PNG |
| `POST` | `/api/visual-library` | Create new asset entry |
| `PUT` | `/api/visual-library/:id` | Update metadata (name, tags, prompt, poses) |
| `DELETE` | `/api/visual-library/:id` | Remove from library + all NAS files |
| `POST` | `/api/visual-library/:id/generate/:phase` | Run specific phase (concept/model/render/pack) via SSE. Marks downstream phases as stale. |
| `POST` | `/api/visual-library/:id/generate/full` | Run full pipeline from earliest stale phase via SSE |
| `POST` | `/api/visual-library/:id/assign` | Assign to project: copies atlas PNG+JSON to project output dir. Body: `{ "project": "arena", "atlas": "characters" }` |
| `POST` | `/api/visual-library/:id/unassign` | Remove assignment. Body: `{ "project": "arena" }` |
| `POST` | `/api/visual-library/import` | Import existing arena assets into library |
| `POST` | `/api/visual-library/batch/generate` | Batch generation for multiple assets via SSE. Body: `{ "ids": ["warrior", "rogue"], "fromPhase": "render" }` |
| `POST` | `/api/projects/:name/sync-visual` | Sync all stale visual assignments for a project |

### Visual Assignment Flow

1. Click "Assign to" → select project + atlas name (e.g., `characters`)
2. Server reads the packed atlas for this category from NAS
3. Copies `{category}.png` + `{category}.json` to `{project.outputRoot}/sprites/`
4. Records `assignedTo.{project}.syncedAt`

Note: Visual assets are assigned at the atlas level (all characters in one atlas), not individually. This matches how PixiJS loads spritesheets.

### Visual Sync Flow

Same as audio: compare `pipeline.pack.generatedAt` vs `assignedTo.{project}.syncedAt`. If stale, re-copy the atlas files.

### Visual Import Flow (first run — arena)

1. **Concepts**: Copy `arena/assets/concepts/{category}/{id}.png` → NAS `visual-library/concepts/...`
2. **Models**: Copy `arena/assets/models/{category}/{id}.glb` → NAS `visual-library/models/...`
3. **Renders**: Copy `arena/assets/renders/{category}/{id}/` → NAS `visual-library/renders/...`
4. **Sprites**: Copy `arena/frontend/public/assets/sprites/{category}.png/.json` → NAS `visual-library/sprites/...`
5. **Blender templates**: Copy `arena/assets/blend/` → NAS `visual-library/blend/`
6. Create library entries from `arena/assets/manifest.json` (characters, weapons, items, tiles, cover, ui sections). Note: character entries in the manifest have no `prompt` field (only `id`, `poses`, `color`) — their library entries get an empty prompt which the user fills in via the UI. All other categories (weapons, items, tiles, cover, ui) have prompts in the manifest.
7. All pipeline phases marked as `done` since assets already exist
8. Set `assignedTo.arena` for all entries

### Pipeline Staleness Rules

When a phase is regenerated, downstream phases become stale:
- Regen concept → model, render, pack all become `pending`
- Regen model → render, pack become `pending`
- Regen render → `pipeline.pack.status` becomes `pending` (shows "stale" badge until re-packed)
- Regen pack → only updates the atlas files

The UI shows stale phases with an orange dot and "needs regen" label.

---

## Part 3: UI Design

### View Toggle

The header gets a view toggle replacing the old "Review" single-view:

```
ASSETGENERATOR  [Audio | Visual]  Project: [Arena ▾]  [Scan] [Sync] [Regen]
```

- **Audio tab**: Library browse + generation + assignment (replaces old per-project Review view)
- **Visual tab**: Pipeline cards + generation + assignment

The old "Review" view functionality is absorbed into the Audio tab's library view.

### Audio Tab Layout

```
┌───────────────────────────────────────────────────────────┐
│ Filter: [All] [SFX] [Music]   Tags: [sci-fi ×] [+]       │
│ Category: [All ▾]             Search: [___________]       │
├───────────────────────────────────────────────────────────┤
│  ── sfx/weapons ──────────────────────────────────────── │
│  ┌ gunshot-sci-fi-01 ──── [arena] [sci-fi] ──────────┐  │
│  │ ▶ ████▓▓██▓███▓▓██░░  0.5s  Sci-Fi Laser Gunshot │  │
│  │ Prompt: [sci-fi laser gunshot, short sharp______]  │  │
│  │ Duration: [0.5]  Seed: [2117503710]  Backend: [▾]  │  │
│  │ Assigned: arena/sfx/gunshot (synced 2min ago)      │  │
│  │                    [Save] [Assign to ▾] [Flag] [Del]│  │
│  └────────────────────────────────────────────────────┘  │
│  ┌ + New Sound [Generate into this category] ────────┐   │
└───────────────────────────────────────────────────────────┘
```

### Visual Tab Layout

```
┌───────────────────────────────────────────────────────────────┐
│ Category: [Characters ▾]  Tags: [arena ×]  Search: [_____]   │
├───────────────────────────────────────────────────────────────┤
│  ┌ warrior ──────────── [arena] [melee] ──────────────────┐  │
│  │ Pipeline: ● Concept → ● Model → ● Render → ● Packed   │  │
│  │           ✓ done      ✓ done    ✓ 48fr     ✓ atlas     │  │
│  │                                                        │  │
│  │ [concept.png] [model.glb] [8-dir render preview]       │  │
│  │                                                        │  │
│  │ Prompt: [armored warrior character, low-poly______]    │  │
│  │ Poses: stand, gun, machine, reload, hold, silencer     │  │
│  │ Assigned: arena/characters (synced 2h ago)             │  │
│  │                                                        │  │
│  │ [Regen Concept] [Regen Model] [Regen Renders] [Pack]   │  │
│  │ [Run Full Pipeline] [Assign to ▾] [Edit] [Delete]      │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌ + New Asset [Create in this category] ────────────────┐   │
└───────────────────────────────────────────────────────────────┘
```

### Generation Log

Shared between both tabs — same collapsible panel at the bottom with SSE events. Visual pipeline events include the phase name:

```
[04:20:01] [concept] Generating warrior via ComfyUI
[04:20:15] [concept] ✓ warrior (1024×1024, 245KB)
[04:20:15] [model] Generating warrior via TripoSR
[04:20:30] [model] ✓ warrior (warrior.glb, 2.3MB)
[04:20:30] [render] Rendering warrior (48 frames via Blender)
[04:21:18] [render] ✓ warrior (48 frames, 1.2MB total)
[04:21:18] [pack] Packing characters atlas
[04:21:19] [pack] ✓ characters (30 sprites, 58KB atlas)
```

---

## Part 4: Script Migration & Arena Cleanup

### Scripts moved to Assetgenerator

| From (arena) | To (Assetgenerator) | New CLI Flags | Internal Changes |
|-------------|---------------------|---------------|------------------|
| `scripts/generate_concepts.py` | `scripts/generate_concepts.py` | `--prompt "..."` (override manifest prompt), `--output <dir>` (NAS concepts dir) | `main()` uses `--output` instead of hardcoded `OUTPUT_BASE`; `generate_asset()` uses `--prompt` when provided |
| `scripts/generate_3d.py` | `scripts/generate_3d.py` | `--input <concept.png>` (NAS concept path), `--output <dir>` (NAS models dir) | `main()` uses `--input` instead of hardcoded `CONCEPTS_DIR`; uses `--output` instead of hardcoded `OUTPUT_BASE` |
| `scripts/render_sprites.py` | `scripts/render_sprites.py` | `--model <path.glb>` (NAS model path), `--template <path.blend>` (NAS template path), `--output <dir>` (NAS renders dir) | `main()` refactored: when `--model` is provided, passes it directly to `render_character()`/`render_static()` instead of constructing from `MODELS_DIR + category + id`. Both `render_character()` and `render_static()` gain an optional `template_path` parameter; when provided, it replaces the call to `get_template_path()` which uses hardcoded `BLEND_DIR`. `main()` passes the resolved `--template` value through to both functions. |
| `scripts/pack_sprites.ts` | `scripts/pack_sprites.ts` | `--input <dir>` (NAS renders dir), `--output <dir>` (NAS sprites dir) | Uses flag values instead of hardcoded `RENDERS_DIR` and `OUTPUT_DIR` constants |
| `scripts/create_blender_templates.py` | `scripts/create_blender_templates.py` | `--output <dir>` | Output to NAS blend directory instead of arena blend dir |
| `scripts/import_sprite_pack.ts` | `scripts/import_sprite_pack.ts` | `--output <dir>` | Import to NAS library renders instead of arena renders |

### Scripts staying in arena

| Script | Reason |
|--------|--------|
| `scripts/generate_audio.py` | AudioCraft/ElevenLabs adapters spawn it directly; arena-specific Python venv |
| `scripts/process_audio.sh` | Legacy per-project post-processing; still usable for bulk arena-local workflows. The library assign flow uses inline ffmpeg instead (process_audio.sh has hardcoded arena paths). |

### Files removed from arena after migration

- `scripts/generate_all.sh` — replaced by Assetgenerator UI
- `scripts/generate_concepts.py` — moved to Assetgenerator
- `scripts/generate_3d.py` — moved to Assetgenerator
- `scripts/render_sprites.py` — moved to Assetgenerator
- `scripts/pack_sprites.ts` — moved to Assetgenerator
- `scripts/create_blender_templates.py` — moved to Assetgenerator
- `scripts/import_sprite_pack.ts` — moved to Assetgenerator
- `assets/blend/` — templates moved to NAS
- `assets/concepts/` — intermediate files now on NAS
- `assets/models/` — intermediate files now on NAS
- `assets/renders/` — intermediate files now on NAS

### Files staying in arena

- `assets/manifest.json` — game still reads this for asset definitions at runtime
- `assets/audio/` — WAV masters (audio pipeline unchanged for now)
- `assets/audio-manifest.json` — character/weapon sound mappings
- `frontend/public/assets/sprites/` — copied from library on assign
- `frontend/public/assets/sfx/`, `music/` — copied from library on assign
- `scripts/generate_audio.py` — AudioCraft adapter target
- `scripts/process_audio.sh` — audio post-processing
- All frontend/backend game code — unchanged

### CLAUDE.md Updates

- `arena/CLAUDE.md`: Update Asset Pipeline section — generation is now in Assetgenerator, arena just receives copied assets
- Root `CLAUDE.md`: Add Assetgenerator to the services table

---

## Part 5: Updated File Structure

```
Assetgenerator/
├── package.json                        # Add tsx dependency for pack_sprites.ts
├── server.js                           # Extended: audio library + visual library + sync routes
├── index.html                          # Extended: Audio tab + Visual tab + view toggle
├── library.json                        # Audio library catalog
├── visual-library.json                 # Visual library catalog
├── config/
│   ├── backends.json                   # Audio backends (unchanged)
│   ├── library-config.json             # Audio library config (NAS root, categories, tags)
│   └── visual-config.json              # Visual config (NAS root, categories, render settings)
├── projects/
│   └── arena.json                      # Extended: deployScript, visual atlas mappings
├── adapters/
│   ├── audiocraft.js                   # Audio (unchanged)
│   ├── elevenlabs.js                   # Audio (unchanged)
│   ├── comfyui.js                      # Visual Phase 1: ComfyUI/SDXL concepts
│   ├── diffusers.js                    # Visual Phase 1: local diffusers/SDXL
│   ├── triposr.js                      # Visual Phase 2: local TripoSR
│   ├── meshy.js                        # Visual Phase 2: cloud Meshy.ai
│   ├── blender.js                      # Visual Phase 3: Blender rendering
│   └── packer.js                       # Visual Phase 4: atlas packing
└── scripts/
    ├── generate_concepts.py            # Moved from arena, extended with --output
    ├── generate_3d.py                  # Moved from arena, extended with --output
    ├── render_sprites.py               # Moved from arena, extended with --template/--output
    ├── pack_sprites.ts                 # Moved from arena, extended with --input/--output
    ├── create_blender_templates.py     # Moved from arena
    └── import_sprite_pack.ts           # Moved from arena
```

---

## Part 6: Concurrency & Runtime

### Concurrency

Same as existing: one generation at a time per library. The server tracks `audioGenerationInProgress` and `visualGenerationInProgress` separately — audio and visual can run in parallel, but two audio or two visual generations cannot.

### Runtime Environment

Local-only — same as existing Assetgenerator. Requires:
- **Python venv** (arena `.venv`) with torch, diffusers, audiocraft, tsr
- **Blender** 3.6+ installed on system PATH
- **Node.js** 20+ with tsx for TypeScript packer script
- **ffmpeg** for audio processing
- **NAS mounted** at configured paths (`/mnt/pve3a/audio-library`, `/mnt/pve3a/visual-library`)

Prerequisites check on startup verifies all of these and shows warnings in the UI header.

### Port

Unchanged: `localhost:5200`

---

## Part 7: Testing Strategy

- Manual testing via the UI (developer tool)
- Verify: NAS read/write, import from arena, generation per phase, atlas packing, assignment copy, sync detection, deploy trigger
- Verify: pipeline staleness propagation (regen concept → downstream marked pending)
- Verify: concurrent audio + visual generation works, same-type rejection (409) works
