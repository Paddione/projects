---
name: sprite-rendering-phase
enabled: true
event: bash
pattern: render_sprites\.py|generate_all\.sh.*--phase\s+3
---

⏱️ **Sprite Rendering Phase Starting**

You're about to render game sprites using Blender EEVEE. This is a long-running phase (5-15 minutes per character).

**What's Happening:**
1. Loading Blender template (character.blend, weapon.blend, etc.)
2. Importing 3D models from `assets/models/`
3. Setting up camera and lighting
4. Rendering 8 directions (or fewer based on asset config)
5. Rendering multiple poses per character (idle, run, attack, etc.)
6. Outputting PNGs to `assets/renders/{category}/{asset_id}/`

**Render Expectations:**
- **Single character** (8 directions × 2 poses = 16 frames): ~16 seconds
- **5 characters**: ~80 seconds (1.3 minutes)
- **10 characters**: ~160 seconds (2.7 minutes)
- **Full batch**: Depends on count, roughly 1 min per character

**While Rendering:**
- ✅ Blender window will appear and render each frame
- ✅ Progress shown: `Rendering frame 1/16...`
- ❌ Don't close Blender window (pipeline manages it)
- ❌ Don't run other heavy tasks (slows renders)

**Optimization Tips:**
1. **Render fewer poses:**
   ```json
   // In manifest.json - use simpler pose sets
   "frames": {
     "idle": 8      // ← Renders 8 directions
     // Skip "run", "attack" if not needed
   }
   ```

2. **Render 1 direction only:**
   ```json
   "frames": {
     "idle": 1      // ← Front view only
   }
   ```

3. **Batch similar assets:**
   ```bash
   # Render only characters (same Blender template)
   ASSET_CATEGORY=characters ./scripts/render_sprites.py
   ```

4. **Single asset (fastest for iteration):**
   ```bash
   ASSET_ID=warrior ./scripts/render_sprites.py   # Just one character
   ```

**Blender Template Check:**
Before rendering, verify template is correct:

```bash
# Character template (isometric 60°, 8 directions)
file assets/blend/character.blend | grep -i blender

# Check if models linked (not embedded)
ls -lh assets/blend/character.blend    # Should be <500KB
```

**If Render Fails:**
- ❌ **Blender not found:** Install from https://www.blender.org/download/
  ```bash
  which blender || echo "Install Blender first"
  ```

- ❌ **Model not found:** Check `assets/models/{category}/{id}.glb` exists
  ```bash
  ls assets/models/characters/warrior.glb
  ```

- ❌ **Template corrupted:** Verify .blend file is valid
  ```bash
  blender --version && echo "Blender OK"
  ```

- ❌ **VRAM out of memory:** Switch to Cycles render (slower but less memory)
  - Edit template in Blender: Render Properties → Engine: Cycles

**Output Verification:**
After rendering completes:
```bash
# Check renders exist
ls assets/renders/characters/warrior/

# Verify all 16 frames (8 directions × 2 poses)
ls assets/renders/characters/warrior/ | wc -l    # Should be 16

# Check file sizes (typically 50-150KB per sprite)
ls -lh assets/renders/characters/warrior/
```

**Next Steps After Rendering:**
1. ✅ Phase 4 runs automatically: Sprite packing
   ```bash
   ./scripts/pack_sprites.ts    # Combines PNGs into atlas + .json metadata
   ```

2. ✅ Atlases appear in:
   ```bash
   ls frontend/public/assets/sprites/
   ```

3. ✅ Game loads from atlases (not individual PNGs)

**Troubleshooting:**
| Issue | Solution |
|-------|----------|
| Renders take >5 min per character | EEVEE + AO enabled; use simpler poses |
| Missing frames in output | Check manifest.json `frames` count |
| Render quality too dark | Increase Key light energy in template |
| Models not showing | Verify .glb paths use relative paths (`//models/`) |
| Out of VRAM | Switch Blender to CPU rendering (slower) |

**Git Workflow:**
After successful rendering:
```bash
git add assets/renders/          # Individual sprite frames
git add frontend/public/assets/  # Packed atlases
git commit -m "assets(arena): render new sprites for {character_name}"
```

This phase typically runs unattended. Set it going and return when complete! ☕
