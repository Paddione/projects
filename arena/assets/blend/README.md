# Blender Asset Templates

Professional Blender project templates for Arena sprite rendering.

## Overview

Each template is a persistent Blender project with:
- **Professional 3-point lighting rig** (Key, Fill, Rim lights)
- **Category-specific camera** (isometric, close-up, top-down, etc.)
- **Material library linking** (shared `_shared/materials.blend`)
- **EEVEE GPU rendering** (OptiX accelerated, 256×256px)
- **Model import setup** (relative paths for cross-platform)

## Template Types

| Template | Purpose | Camera | Renders |
|----------|---------|--------|---------|
| **character.blend** | Player characters | 60° isometric | 8 directions × N poses |
| **weapon.blend** | Guns, swords | 45° close-up | 1 angle × N poses |
| **item.blend** | Pickups, health | Centered icon | 1 angle |
| **tile.blend** | Floor, terrain | 90° top-down | 1 angle |
| **cover.blend** | Obstacles | 45° side-lit | 1 angle |
| **ui.blend** | UI icons | Flat ortho | 1 angle |

## Rendering a New Asset

1. **Add to manifest.json:**
   ```json
   {
     "id": "paladin",
     "category": "characters",
     "poses": ["stand", "gun", "machine", "reload", "hold", "silencer"]
   }
   ```

2. **Create 3D model:**
   ```bash
   # Generate model (Phase 2)
   ./scripts/generate_all.sh --phase 2
   ```

3. **Render sprites:**
   ```bash
   # Use templates (Phase 3)
   blender --background --python scripts/render_sprites.py -- --id paladin
   # or
   ./scripts/generate_all.sh --phase 3
   ```

4. **Pack atlas:**
   ```bash
   # Combine PNGs into atlas (Phase 4)
   ./scripts/generate_all.sh --phase 4
   ```

## Material Library (_shared/materials.blend)

Centralized material definitions:

- **PBR_Skin** - Character skin (warm tone, subsurface)
- **PBR_Metal** - Weapons, equipment (polished, reflective)
- **PBR_Fabric** - Clothing (matte, cloth texture)
- **Emission_Glow** - Glowing effects (bright, emissive)

All templates **link** to this file (not embed) so:
- Edit materials once → all templates auto-update
- File size stays small (~150KB per template)
- Easy to improve quality globally

## Workflow: Editing Templates

### Improve Lighting

```blender
# In character.blend:
1. Adjust Key light energy (try 2.5-3.0 for brighter)
2. Adjust Fill light position (try -2, 2, 2 for softer)
3. Render test: F12
4. Save: Ctrl+S
```

After saving, re-render all characters:
```bash
./scripts/generate_all.sh --phase 3
git add assets/renders/ frontend/public/assets/sprites/
git commit -m "assets(arena): improve character lighting"
```

### Update Materials

Edit `_shared/materials.blend`:
```blender
1. Open _shared/materials.blend
2. Edit PBR_Skin color, roughness, etc.
3. Save
```

Next render automatically uses updated materials.

### Change Camera Angle

In template (e.g., `character.blend`):
```blender
1. Select Camera object
2. Change position/rotation
3. Save
```

Re-render all assets using that template.

## Render Times

With NVIDIA RTX 5070 Ti (GPU/OptiX):

| Asset | Frames | Time | Notes |
|-------|--------|------|-------|
| 1 character (8 dir × 2 poses) | 16 | ~16s | EEVEE + AO |
| 5 characters | 80 | ~80s | 1m20s |
| Full batch | Varies | 2-5min | All characters |

CPU rendering: ~5x slower (avoid)

## Troubleshooting

**Problem:** Render is very dark
- Solution: Increase Key light energy (2.0 → 3.0)

**Problem:** Camera angle wrong
- Solution: Select camera, adjust Position + Rotation in Properties

**Problem:** Materials look wrong
- Solution: Verify materials linked: File → Link → _shared/materials.blend

**Problem:** Model not showing
- Solution: Verify .glb path exists at assets/models/{category}/{id}.glb

## File Sizes

Expected .blend file sizes:

| File | Size | Reason |
|------|------|--------|
| `_shared/materials.blend` | ~100KB | Materials only |
| Template (.blend) | ~150-250KB | Lights, camera, linked materials |
| Individual render (.png) | 50-200KB | 256×256 RGBA |
| Packed atlas (.png) | 1-2MB | 10-20 characters |

Packed atlas is what's served to game (not individual PNGs).

## Git Workflow

```bash
# After creating/editing templates:
git add assets/blend/*.blend                    # Templates
git add assets/blend/_shared/materials.blend    # Materials
git add assets/renders/                         # Rendered frames
git add frontend/public/assets/sprites/         # Packed atlases
git commit -m "assets(arena): render new sprites from updated templates"
```

Note: Only commit `.blend` files once (template setup). After that, commit renders + packed atlases, not individual templates.

## Quick Reference

- **Blender location:** https://www.blender.org/
- **GPU setup:** Edit → Preferences → System → Cycles: GPU Compute (CUDA/OptiX)
- **Render shortcut:** F12 (renders to Image Editor)
- **Save:** Ctrl+S
- **Undo:** Ctrl+Z
- **Move object:** G (grab)
- **Rotate:** R
- **Scale:** S

## Next Steps

1. Verify templates with `blender assets/blend/character.blend`
2. Run first asset through full pipeline
3. Check game loads without asset warnings
4. Iterate on lighting/materials as needed
