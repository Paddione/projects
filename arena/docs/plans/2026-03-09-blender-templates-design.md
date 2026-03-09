# Design: Blender Template Creation & Audio Library Architecture

**Date:** 2026-03-09
**Status:** Approved
**Author:** Claude Code
**Scope:** Asset pipeline foundation (Blender + audio)

---

## Executive Summary

This design establishes the foundational asset generation templates:
1. **6 Blender project files** with professional lighting rigs, cameras, and material linking
2. **Shared materials library** for global consistency and easy iteration
3. **Audio library structure** with reusable sound components and manifest mapping

**Outcome:** Developers can generate high-quality game sprites and audio consistently using persistent templates and automated setup scripts.

---

## Part 1: Blender Templates

### Current State
- Asset pipeline exists (`assets/concepts/`, `assets/models/`, `assets/renders/`, `assets/audio/`)
- Blender 4.0.2 installed with NVIDIA RTX 5070 Ti GPU (CUDA 13.1)
- Rendering currently uses procedural Graphics fallback (no sprite templates)
- Individual sprite frames generated but no persistent project files

### Problem
Fresh Blender scenes created per-render lack:
- Consistent professional lighting across assets
- Reusable lighting rigs and material configurations
- Easy global improvements (change one template, all renders improve)
- Quality consistency between asset categories

### Solution: 6 Template-Based Projects

Each template is a persistent `.blend` file with:
- **Professional 3-point lighting rig** (Key, Fill, Rim lights)
- **Category-specific camera angle & position** (isometric, close-up, top-down, etc.)
- **Material linking** to shared `_shared/materials.blend` library
- **EEVEE rendering configuration** (GPU-accelerated, transparent background, 256×256px)
- **Model import setup** with relative paths for cross-platform compatibility

#### Template Specifications

| Template | Purpose | Camera Angle | Directions | Use Case |
|----------|---------|--------------|-----------|----------|
| **character.blend** | Player characters, enemies | 60° isometric | 8 (N,NE,E,SE,S,SW,W,NW) | Multiple poses per direction |
| **weapon.blend** | Guns, swords, equipment | 45° close-up | 1 (primary angle) | Rim-lit detail shots |
| **item.blend** | Health packs, armor pickups | 0° centered | 1 (icon-like) | Bright, minimal shadows |
| **tile.blend** | Floor tiles, terrain | 90° top-down | 1 (seamless pattern) | Overhead orthographic |
| **cover.blend** | Obstacles, barricades | 45° side-lit | 1 (depth shown) | Shadow depth, silhouette |
| **ui.blend** | UI icons, HUD elements | 0° flat | 1 (orthographic) | Minimal shadows, clean look |

#### Lighting Rig (Shared Across All Templates)

**Key Light**
- Type: Sun (directional)
- Position: (2, -3, 3)
- Energy: 2.0 (main illumination)
- Rotation: (45°, 45°, 0°)
- Shadows: Enabled (sharp, dimensional)

**Fill Light**
- Type: Area (soft, no shadows)
- Position: (-2, 2, 1)
- Energy: 0.5 (softens shadows)
- Size: 3m × 3m
- Purpose: Reduces harsh shadows, adds subtlety

**Rim Light**
- Type: Area (edge separation)
- Position: (0, 1, 2)
- Energy: 0.3 (highlights edges)
- Size: 2m × 2m
- Purpose: Separates subject from background

**Result:** Professional cinematic lighting, consistent across all assets

#### Render Settings

**Engine:** EEVEE (fast, GPU-accelerated)
- Samples: 32 (EEVEE default)
- Anti-aliasing: Temporal (smooth, temporal coherence)

**Output**
- Resolution: 256×256px (downscaled to 128px in-game for sharp pixels)
- Format: PNG RGBA
- Transparency: Enabled (no background)
- Compression: Level 9 (max quality)

**GPU Rendering**
- Render device: CUDA (NVIDIA OptiX preferred)
- Denoiser: OptiX (if available)
- Expected render time: 0.3-1s per frame (GPU vs. 2-5s CPU)

#### Material Library (`_shared/materials.blend`)

Centralized material library shared by all templates:

**PBR_Skin**
- Base Color: #d4a574 (warm skin tone)
- Metallic: 0.0
- Roughness: 0.8
- Subsurface: 0.1 (light penetration)

**PBR_Metal**
- Base Color: #b5b5b5 (gun metal)
- Metallic: 1.0
- Roughness: 0.2 (polished metal)

**PBR_Fabric**
- Base Color: (asset-specific)
- Metallic: 0.0
- Roughness: 0.7 (matte cloth)

**Emission_Glow**
- Base Color: (bright color)
- Emission: 5.0+ (for energy effects)
- Bloom enabled in render

**Benefits:**
- Update one material → all assets using it improve
- Consistent visual language across game
- PBR setup maintains real-world physical accuracy

#### Model Linking Strategy

Templates use **linked model imports** (not embedded):

```blender
File → Link → assets/models/{category}/{id}.glb
```

**Benefits:**
- `.blend` files stay <500KB (vs. 50MB embedded)
- Model changes auto-reflect in template
- Relative paths work cross-platform (Windows SMB, Linux)
- Version control friendly (git handles .blend, not bloated with model data)

---

### Implementation: Python Script (`create_blender_templates.py`)

**What it does:**
1. Creates 6 `.blend` files with bpy (Blender's Python API)
2. Sets up lighting rigs per template specification
3. Links materials from `_shared/materials.blend`
4. Configures EEVEE + GPU rendering
5. Positions cameras for each asset type
6. Saves to `assets/blend/{template_name}.blend`

**Usage:**
```bash
blender --background --python scripts/create_blender_templates.py
```

**Execution time:** ~30 seconds (creates 6 files + validates)

**Output:**
- `assets/blend/_shared/materials.blend` (material library)
- `assets/blend/character.blend`
- `assets/blend/weapon.blend`
- `assets/blend/item.blend`
- `assets/blend/tile.blend`
- `assets/blend/cover.blend`
- `assets/blend/ui.blend`

---

## Part 2: Audio Library Architecture

### Current State
- Raw audio generated in `assets/audio/` (by AudioCraft, Phase 5)
- Processed audio (ffmpeg) in `frontend/public/assets/audio/`
- No centralized sound effect library or reuse strategy

### Problem
- Audio generation creates new files for each asset
- Footstep sounds for 5 characters = 5 separate audio files (redundant)
- No easy way to globally swap or improve sounds
- Asset manifest doesn't track audio dependencies

### Solution: Shared Audio Library + Manifest

#### Directory Structure

```
assets/audio/
├── _shared/              ← Reusable base sounds
│   ├── footsteps/
│   │   ├── leather.wav   ← Used by "warrior" armor
│   │   ├── metal.wav     ← Used by "knight" armor
│   │   └── cloth.wav     ← Used by "mage" clothing
│   ├── impacts/
│   │   ├── flesh.wav
│   │   ├── metal_hit.wav
│   │   └── stone.wav
│   └── ambience/
│       ├── wind.wav
│       └── battle_hum.wav
├── sfx/                  ← Generated SFX (built from _shared)
│   ├── warrior_footstep.wav
│   ├── archer_footstep.wav
│   └── ...
└── music/               ← Generated music tracks
    ├── battle_theme.wav
    └── ...
```

#### Audio Manifest (`assets/audio-manifest.json`)

Maps sounds to asset categories for reuse:

```json
{
  "characters": {
    "warrior": {
      "footstep": "leather",    ← References _shared/footsteps/leather.wav
      "impact": "flesh",        ← References _shared/impacts/flesh.wav
      "idle_ambience": null
    },
    "knight": {
      "footstep": "metal",      ← Metal armor footstep
      "impact": "metal_hit",
      "idle_ambience": null
    }
  },
  "weapons": {
    "sword": {
      "swing": "melee_swing",
      "impact": "metal_hit"
    }
  }
}
```

#### Processing Pipeline Enhancement

Phase 5 & 6 (audio generation/processing) now:
1. Generate base sounds → `_shared/`
2. Reference manifest for asset-specific combinations
3. Mix/process base sounds for each asset
4. Output to `frontend/public/assets/audio/`

**Benefits:**
- One "leather footstep" sound used by 5 characters (consistency)
- Change footstep globally = update one file
- Smaller total audio size (no duplication)
- Easy to swap sounds (edit manifest, re-process)

---

## Testing & Validation

### Blender Templates
- [ ] Each `.blend` file opens in Blender without errors
- [ ] Lighting is visible and consistent
- [ ] Camera angles match specification
- [ ] Materials link to `_shared/materials.blend` successfully
- [ ] GPU rendering works (EEVEE test render)

### Audio Library
- [ ] `_shared/` contains base sound effects
- [ ] Manifest is valid JSON and references existing files
- [ ] Processing pipeline correctly mixes/references sounds
- [ ] Output audio plays without errors

### Integration
- [ ] Sprite rendering pipeline uses character.blend (Phase 3)
- [ ] Game loads rendered sprites correctly
- [ ] Audio plays with correct sound effects
- [ ] No console errors for missing assets

---

## Dependencies

- **Blender 4.0.2** (installed, NVIDIA OptiX available)
- **Python 3.10+** with bpy module (included with Blender)
- **Pillow, imageio** (for image processing, already in venv)

---

## Success Criteria

✅ **All 6 Blender templates created with ideal config**
✅ **Shared materials library functional and linked**
✅ **Sprite rendering uses persistent templates (not fresh scenes)**
✅ **Render quality improved (3-point lighting visible)**
✅ **Audio library structure enables sound reuse**
✅ **First sprite renders successfully with new pipeline**
✅ **Game loads and displays new sprites correctly**

---

## Implementation Sequence

1. Create `create_blender_templates.py` (bpy script)
2. Execute script → generates 6 `.blend` files + materials library
3. Verify templates in Blender GUI (visual check)
4. Update `render_sprites.py` to use templates (Phase 3)
5. Create audio manifest structure
6. Test full sprite rendering pipeline
7. Test game asset loading
8. Commit all changes

---

## Notes

- Templates are committed to git (source of truth)
- Individual renders (`assets/renders/`) gitignored (regeneratable)
- Blender projects ~150KB each (small, manageable)
- Can re-run `create_blender_templates.py` anytime to reset

---

**Next:** Invoke writing-plans skill to create detailed implementation plan.
