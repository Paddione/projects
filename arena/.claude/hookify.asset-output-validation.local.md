---
name: asset-output-validation
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: assets/(renders|audio|models)/
---

✅ **Asset Output File Modified**

You've modified a generated asset (sprite render, audio, or 3D model). These are typically output from the generation pipeline, not manually edited.

**Before Proceeding:**
1. **Is this intentional?** Asset files are usually auto-generated:
   - `assets/renders/` ← From Blender sprite rendering
   - `assets/audio/` ← From AudioCraft generation
   - `assets/models/` ← From 3D model generation (TripoSR/Meshy)

2. **If you're manually editing:**
   - ⚠️ Changes will be overwritten on next pipeline run
   - Solution: Modify the generation scripts or Blender templates instead

3. **If replacing assets:**
   - Ensure new files match naming convention: `{category}/{asset_id}/{pose}_{direction}.png`
   - Ensure dimensions match: 256×256px (renders downscale to 128px in-game)
   - Ensure format: PNG RGBA with transparency

**Asset Directory Structure:**
```
arena/assets/
├── renders/
│   ├── characters/
│   │   ├── warrior/
│   │   │   ├── idle_N.png
│   │   │   ├── idle_NE.png
│   │   │   └── ... (8 directions)
│   │   └── archer/
│   └── weapons/
├── audio/
│   ├── sfx/
│   │   ├── arrow_release.wav
│   │   └── ...
│   └── music/
└── models/
    ├── characters/
    │   ├── warrior.glb
    │   └── archer.glb
    └── weapons/
```

**Common Scenarios:**

**Scenario 1: Replaced a sprite frame manually**
```bash
# You edited: assets/renders/characters/warrior/idle_N.png
# This will be overwritten on next render!
# Instead: Edit Blender template, re-render
```

**Scenario 2: Added new audio manually**
```bash
# You added: assets/audio/sfx/custom_sound.wav
# This will be lost on next audio generation!
# Instead: Add to manifest.json, re-run Phase 5
```

**Scenario 3: Replaced 3D model**
```bash
# You edited: assets/models/characters/new_character.glb
# The rendering pipeline will use this next render
# ✅ This is fine, just ensure valid .glb format
```

**If Modifying Asset Pipeline Outputs:**
1. **Render frames?** → Edit Blender template, re-run Phase 3
2. **Audio files?** → Edit manifest.json, re-run Phase 5
3. **3D models?** → External generator (TripoSR), manually verify
4. **Sprite atlases?** → Auto-generated, modify to commit
5. **Materials?** → Edit `assets/blend/_shared/materials.blend`

**Re-Generation Workflow:**
```bash
# If you need to regenerate after changes:
./scripts/generate_all.sh --phase 3    # Sprites only
./scripts/generate_all.sh --phase 4    # Re-pack atlases
./scripts/generate_all.sh --phase 5    # Audio only
./scripts/generate_all.sh --phase 6    # Audio processing

# Full pipeline (all phases)
./scripts/generate_all.sh
```

**Git Handling:**
- ✅ **Commit modified Blender templates:** `git add assets/blend/*.blend`
- ✅ **Commit final packed atlases:** `git add frontend/public/assets/sprites/`
- ❌ **Don't commit individual renders:** They're intermediate outputs
  - Add to `.gitignore`: `assets/renders/` (only commit atlases)
- ❌ **Don't commit raw audio:** They're large, commit processed only
  - Add to `.gitignore`: `assets/audio/` (only commit `frontend/public/assets/audio/`)

**Verify Asset Integrity:**
After modifying or regenerating:
```bash
# Check sprite atlases exist
ls frontend/public/assets/sprites/

# Verify atlas has metadata JSON
file frontend/public/assets/sprites/characters.json

# Test asset loading in game
npm run dev:frontend    # Should load without errors

# Check console for missing asset warnings
# If seeing "Failed to load sprite: warrior", path mismatch
```

**Common Errors:**
| Error | Cause | Fix |
|-------|-------|-----|
| "Failed to load sprite" | Asset not in atlas | Re-pack: `generate_all.sh --phase 4` |
| Renders all black | Lighting in template broken | Re-open .blend, adjust lights |
| Audio doesn't play | Format not .ogg/.mp3 | Re-run Phase 6 (audio processing) |
| Wrong dimensions | Blender resolution changed | Reset to 256×256 in template |

**Bottom Line:**
- 🟢 **Generated assets** are meant to be auto-generated from templates
- 🟡 **Modifying manually?** Consider if you should edit the source instead
- 🔴 **Changes will be overwritten** on next pipeline run unless you update the generation source

Proceed knowing the pipeline will regenerate these on next run!
