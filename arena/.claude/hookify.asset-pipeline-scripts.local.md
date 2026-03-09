---
name: asset-pipeline-scripts
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: scripts/(generate_all|render_sprites|pack_sprites)
---

⚙️ **Asset Pipeline Script Modified**

You're editing a core asset generation script. This affects how assets are created for all developers. Review carefully.

**Pipeline Script Responsibilities:**

**1. generate_all.sh** (orchestrator)
   - Runs all 6 phases in sequence
   - Handles `--phase N` filtering
   - Sets environment variables for downstream scripts
   - Should: Chain commands, handle errors, show progress
   - Don't: Duplicate logic from individual phase scripts

**2. render_sprites.py** (Blender rendering)
   - Loads Blender templates from `assets/blend/{category}.blend`
   - Imports 3D models from `assets/models/`
   - Batch renders 8 directions (or fewer)
   - Exports PNGs to `assets/renders/{category}/{id}/`
   - Should: Use persistent templates, link (not embed) models
   - Don't: Create fresh Blender scenes (quality suffers)

**3. pack_sprites.ts** (sprite atlas generation)
   - Reads individual sprite PNGs from `assets/renders/`
   - Packs into optimal atlases
   - Generates `.json` metadata (frame positions, sizes)
   - Outputs to `frontend/public/assets/sprites/`
   - Should: Optimize for game loading, minimize atlas count
   - Don't: Output individual PNGs to web (slow!)

**4. Other Phases:**
   - Phase 1: Concept art (ComfyUI/SDXL)
   - Phase 2: 3D models (TripoSR/Meshy)
   - Phase 5: Audio generation (AudioCraft)
   - Phase 6: Audio processing (ffmpeg)

**Modifications to Consider:**

**Adding a new asset category?**
```bash
# You need to update:
1. assets/manifest.json - Add category + assets
2. assets/blend/ - Create new template (weapon.blend, etc.)
3. render_sprites.py - Add category-specific render logic if needed
4. pack_sprites.ts - Handle new atlas group

# Test: ./scripts/generate_all.sh --phase 3
```

**Changing render output format?**
```bash
# Affects:
1. render_sprites.py - Output format (PNG, TGA, etc.)
2. pack_sprites.ts - Input expectations
3. Game.tsx - Asset loading logic
4. Frontend tests - Asset paths

# Test: npm run dev:frontend + check console
```

**Optimizing render times?**
```bash
# Safe changes:
- Reduce render samples (EEVEE samples: 32 → 16)
- Lower output resolution (256×256 → 128×128)
- Reduce pose count (idle+run → idle only)

# Risky changes:
- Switch rendering engines (EEVEE ↔ Cycles)
- Change camera positions (breaks sprite alignment)
- Remove lighting (looks worse)

# Test first: ASSET_ID=test_char ./scripts/render_sprites.py
```

**Testing Script Changes:**

Before committing:
```bash
# 1. Syntax check
python3 -m py_compile scripts/render_sprites.py

# 2. Single asset test (fastest)
ASSET_ID=warrior ./scripts/render_sprites.py
# Check: assets/renders/characters/warrior/ exists with frames

# 3. Pack test
./scripts/pack_sprites.ts
# Check: frontend/public/assets/sprites/ has atlases

# 4. Full pipeline test (if major changes)
./scripts/generate_all.sh --phase 3 --phase 4
# Check: All outputs present and valid
```

**Common Script Modifications:**

**1. Add environment variable support**
```bash
# Good: Allows flexibility
RENDER_ENGINE=${RENDER_ENGINE:-eevee}  # Default to EEVEE
ASSET_ID=${ASSET_ID:-all}              # Render all if not specified

# Usage: RENDER_ENGINE=cycles ./scripts/generate_all.sh --phase 3
```

**2. Add progress reporting**
```bash
# Good: Shows what's happening
echo "Rendering 16 frames (8 directions × 2 poses)..."
for frame in {1..16}; do
    echo "  [$frame/16] Processing..."
    # render frame
done

# Users know pipeline is running, not stuck
```

**3. Add error handling**
```bash
# Good: Catches failures early
blender --version >/dev/null 2>&1 || {
    echo "ERROR: Blender not installed"
    exit 1
}

# Don't silently fail
```

**4. Add cleanup logic**
```bash
# Good: Removes temp files
trap "rm -rf /tmp/blender_render_$$" EXIT

# Script always cleans up, even on error
```

**Avoiding Common Mistakes:**

❌ **Hard-coding paths**
```bash
# Bad:
BLENDER_PATH="/home/patrick/.blender/4.0"

# Good:
BLENDER_PATH="${BLENDER_PATH:-blender}"  # Use PATH
```

❌ **Assuming asset structure**
```bash
# Bad:
ls assets/renders/characters/*/

# Good:
# Check manifest.json for actual categories
jq '.[] | .category' assets/manifest.json | sort -u
```

❌ **Silencing errors**
```bash
# Bad:
blender ... > /dev/null 2>&1

# Good:
blender ... || {
    echo "Blender render failed"
    exit 1
}
```

❌ **Not validating inputs**
```bash
# Bad:
ASSET_ID=$1
# Proceeds even if $1 is empty

# Good:
ASSET_ID=${1:?Error: Asset ID required}
# Fails clearly if missing
```

**Git Workflow for Script Changes:**

```bash
# 1. Create feature branch
git checkout -b feature/improve-render-pipeline

# 2. Test thoroughly
./scripts/generate_all.sh --phase 3 --phase 4

# 3. Commit with explanation
git commit -m "feat(scripts): optimize Blender render times

- Reduced EEVEE samples from 32 to 16
- Added progress reporting per frame
- Added error handling for missing Blender
- ~50% faster renders, same visual quality

Testing: 5 characters rendered successfully
Timing: 8s/character (was 16s before)
"

# 4. Push and verify
git push origin feature/improve-render-pipeline
```

**Script Deployment:**

Scripts are committed to git, so they deploy automatically:
```bash
# After merging feature branch:
./k8s/scripts/deploy/deploy-arena.sh

# No separate deployment needed
# All developers pull latest scripts on next `git pull`
```

**References:**

- **CLAUDE.md**: Asset pipeline overview (arena/CLAUDE.md)
- **BLENDER_QUICK_REFERENCE.md**: Quick copy-paste values
- **manifest.json**: Asset definitions
- **Blender templates**: `assets/blend/*.blend`

**You're editing infrastructure!** Test thoroughly before committing. 🔧
