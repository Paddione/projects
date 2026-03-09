---
name: asset-pipeline-prerequisites
enabled: true
event: bash
pattern: generate_all\.sh|render_sprites\.py|pack_sprites\.ts
---

🎨 **Asset Generation Pipeline Detected**

You're about to run a computationally intensive asset generation phase. Before proceeding, verify these prerequisites:

**Required Tools:**
- ✅ **Blender 4.0+** installed at `/usr/bin/blender` or in PATH
  - Check: `blender --version`
- ✅ **Python 3.10+** with required packages
  - Check: `python3 -c "import bpy; import PIL; print('OK')"`
  - Missing? Run: `pip install pillow imageio scipy`
- ✅ **Node.js 20+** (for sprite packing)
  - Check: `node --version`

**Before Running:**
1. **Manifest valid?** — `assets/manifest.json` must have correct structure
   ```bash
   # Validate: each asset needs id, category, name, description, model_prompt
   jq '.characters[0] | keys' assets/manifest.json
   ```

2. **Space available?** — Asset generation uses significant disk space
   - Concepts: ~50MB per batch
   - 3D models: ~100MB per model
   - Renders: ~200MB per character (8 directions × 2 poses)
   - Audio: ~20MB per track

3. **Which phase?** — If running `generate_all.sh --phase N`:
   - Phase 1 (concepts): 5-15 min (ComfyUI dependency)
   - Phase 2 (3D models): 10-30 min per model
   - **Phase 3 (sprites)**: 5-15 min per character (Blender EEVEE rendering)
   - Phase 4 (packing): 2-5 min
   - Phase 5 (audio): 3-10 min per track (AudioCraft)
   - Phase 6 (processing): 1-3 min per track

**Blender Specific:**
- Using persistent templates? (`assets/blend/character.blend`, etc.)
- EEVEE engine configured? (faster than Cycles for game sprites)
- Render resolution set to 256×256? (downscale to 128px in-game)
- Models linked (not embedded)? (keeps .blend files <500KB)

**Run Command Examples:**
```bash
# Full pipeline (1-2 hours total)
./scripts/generate_all.sh

# Single phase (faster for iteration)
./scripts/generate_all.sh --phase 3    # Render sprites only
./scripts/generate_all.sh --phase 4    # Pack only

# Specific asset (most efficient for changes)
ASSET_ID=warrior ./scripts/render_sprites.py
```

**After Generation:**
- Sprites in: `assets/renders/` (individual PNGs)
- Packed atlases: `frontend/public/assets/sprites/` (.png + .json)
- Verify: `ls -lh frontend/public/assets/sprites/`

Ready? Proceed with the appropriate phase command above.
