---
name: blender-template-changes
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: assets/blend/.*\.blend$
---

🎨 **Blender Template Modified**

You've edited a Blender project file. Any changes to lighting, camera, materials, or render settings will affect ALL subsequent renders using this template.

**What Changed & What to Do:**

**1. Lighting Rig Changes** (Key, Fill, Rim lights)
   - ✅ Affects: All future renders from this template
   - ❌ Previous renders NOT updated (need re-render)
   - Action: Re-render affected assets
   ```bash
   # If you edited character.blend:
   ./scripts/generate_all.sh --phase 3    # Re-render all characters
   ```

**2. Camera Position / Angle**
   - ✅ Affects: Frame composition, character positioning
   - ❌ Previous sprites in `assets/renders/` need deletion
   - Action: Clear old renders, regenerate
   ```bash
   rm -rf assets/renders/characters/   # If editing character.blend
   ./scripts/generate_all.sh --phase 3
   ```

**3. Render Settings** (EEVEE/Cycles, resolution, samples)
   - ✅ Affects: Render quality, file size, speed
   - ❌ Old renders still old quality
   - Action: Re-render for consistency
   ```bash
   # Or re-render specific asset:
   ASSET_ID=warrior ./scripts/render_sprites.py
   ```

**4. Material Library Changes** (`assets/blend/_shared/materials.blend`)
   - ✅ Affects: All templates that link from this file
   - ⚠️ Change propagates when any template re-renders
   - Action: Next render cycle applies changes automatically

**Best Practices for Template Edits:**
- [ ] Test render one frame (F12) before batch rendering
- [ ] Save early, save often (Blender crashes happen)
- [ ] Keep models linked (not embedded) to maintain <500KB .blend files
- [ ] Use relative paths (`//models/character/warrior.glb`) for cross-platform compatibility

**Re-Render Checklist:**
1. After lighting changes:
   ```bash
   ./scripts/generate_all.sh --phase 3    # Full re-render
   ```

2. After camera changes:
   ```bash
   rm -rf assets/renders/characters/     # Clear old frames
   ./scripts/generate_all.sh --phase 3
   ```

3. After material changes:
   - If only linked materials changed: Auto-applied next render
   - If you edited material values: Re-render the affected category

4. After render settings (EEVEE/Cycles):
   ```bash
   ./scripts/generate_all.sh --phase 3 --force   # Force all
   ```

**Which Template for Each Category:**
- `character.blend` → 60° isometric, 8-direction, multiple poses
- `weapon.blend` → Close-up, single angle, rim lighting
- `item.blend` → Centered icon-like, bright
- `tile.blend` → Top-down, seamless
- `cover.blend` → 45° angle, depth shadows
- `ui.blend` → Flat orthographic

**Render Times (Expect These Delays):**
- Single character (8 directions × 2 poses): ~16s
- 5 characters: ~80s
- Full character set: 5-15 min depending on count

**After Re-Rendering:**
1. Verify outputs exist:
   ```bash
   ls -lh assets/renders/characters/
   ```

2. Pack updated sprites:
   ```bash
   ./scripts/generate_all.sh --phase 4
   ```

3. Update frontend assets:
   ```bash
   cp assets/renders/* frontend/public/assets/sprites/
   ```

**Git Workflow:**
```bash
# Save .blend changes
git add assets/blend/character.blend

# After re-rendering:
git add assets/renders/
git add frontend/public/assets/sprites/

# Commit together (template + renders + packed atlas)
git commit -m "assets(arena): update character lighting and re-render all sprites"
```

Ready to re-render? The asset pipeline will handle the rest!
