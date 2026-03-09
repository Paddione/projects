---
name: asset-pipeline-commit-workflow
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: git\s+commit|git\s+push
  - field: command
    operator: contains
    pattern: assets
---

📦 **Asset Pipeline Commit Detected**

You're committing asset pipeline changes. Ensure your commit includes the right files and follows the workflow.

**What Should Be Committed:**

✅ **DO Commit:**
- Blender templates: `assets/blend/*.blend` (source of truth)
- Packed sprite atlases: `frontend/public/assets/sprites/*.png` + `*.json`
- Final audio files: `frontend/public/assets/audio/*.ogg` + `*.mp3`
- Asset manifest: `assets/manifest.json` (defines all assets)
- Pipeline scripts: `scripts/generate_all.sh`, `scripts/render_sprites.py`, etc.
- Documentation updates: `CLAUDE.md`, `BLENDER_QUICK_REFERENCE.md`, etc.

❌ **DON'T Commit:**
- Individual sprite renders: `assets/renders/` (intermediate output)
- Raw audio files: `assets/audio/` (large, intermediate)
- 3D models: `assets/models/` (large, regeneratable)
- Concept art: `assets/concepts/` (temporary, AI-generated)

**Check Your Staging:**
```bash
# See what's staged
git diff --cached --name-only

# Verify structure is correct:
# Should see:
#   assets/blend/character.blend        ✅
#   frontend/public/assets/sprites/     ✅
#   assets/manifest.json                ✅
#
# Should NOT see:
#   assets/renders/                     ❌
#   assets/audio/                       ❌
#   assets/models/                      ❌
```

**Commit Message Template:**
```bash
# Format: type(arena): brief description
git commit -m "assets(arena): {action} {what}

{detailed description if needed}
- Changes: {list key changes}
- Validates: {what was tested/verified}
- Stages: {render phases, audio, etc.}
"
```

**Examples:**

**1. New Character (Full Cycle)**
```bash
git commit -m "assets(arena): add warrior character with 8-direction sprites

- Added warrior to manifest.json with idle+run poses
- Generated 3D model via TripoSR
- Rendered 16 sprite frames (8 directions × 2 poses)
- Packed into sprite atlas
- Validates: AssetService loads warrior correctly

Stages: Concept ✓ 3D ✓ Render ✓ Pack ✓
"
```

**2. Blender Template Update**
```bash
git commit -m "assets(arena): improve character.blend lighting rig

- Increased Key light energy from 2.0 to 2.5
- Added soft shadows via improved Fill light positioning
- Re-rendered all characters for consistency

Renders: 5 characters × 16 frames = 80 sprites
"
```

**3. Audio Asset Addition**
```bash
git commit -m "assets(arena): add footstep and impact audio

- Generated via AudioCraft: leather_footstep, metal_impact
- Processed: normalized, added fadeout
- Mapped in manifest.json

Validates: SoundService plays without errors
"
```

**Pre-Commit Checklist:**
- [ ] All individual renders exist? `ls assets/renders/{category}/{asset}/`
- [ ] Sprite atlases packed? `ls frontend/public/assets/sprites/*.png`
- [ ] Atlas metadata valid? `jq empty frontend/public/assets/sprites/characters.json`
- [ ] Manifest updated? `jq empty assets/manifest.json`
- [ ] Game runs? `npm run dev:frontend` loads without console errors
- [ ] Asset loads? `AssetService.isLoaded === true` after waiting
- [ ] Blender templates tracked? `git ls-files assets/blend/*.blend`

**Validation Commands:**
```bash
# 1. Check packed atlases exist
ls -lh frontend/public/assets/sprites/

# 2. Verify manifest syntax
jq empty assets/manifest.json && echo "✅ Valid"

# 3. Test game loads assets
npm run dev:frontend &
sleep 5
curl -s http://localhost:3002 | grep -i "asset" && echo "✅ Assets referenced"

# 4. Verify no intermediate files committed
git diff --cached | grep "assets/renders/" && echo "❌ Renders included!" || echo "✅ Clean"
git diff --cached | grep "assets/audio/" && echo "❌ Raw audio included!" || echo "✅ Clean"
```

**After Committing:**

1. **Push to remote:**
   ```bash
   git push origin master
   ```

2. **Deploy to k3s:**
   ```bash
   ./k8s/scripts/deploy/deploy-arena.sh
   ```

3. **Verify deployment:**
   ```bash
   kubectl rollout status deployment/arena-frontend -n korczewski-services
   curl https://arena.korczewski.de/api/health | jq .
   ```

4. **Test in production:**
   - Open https://arena.korczewski.de
   - Check browser console for asset load errors
   - Verify game renders with correct sprites

**Common Mistakes:**

❌ **Committed assets/renders/ (intermediate output)**
```bash
# Undo and filter:
git reset HEAD~1
rm -f assets/renders/
git add -A
git commit -m "assets(arena): {description}"
```

❌ **Forgot to pack sprites (Phase 4)**
```bash
# Re-run packing:
./scripts/generate_all.sh --phase 4
git add frontend/public/assets/sprites/
git commit --amend  # Add to previous commit
```

❌ **Manifest has invalid entries**
```bash
# Validate before committing:
jq '.characters | map(select(.id | test("^[a-z0-9_-]+$"))) | length' assets/manifest.json
```

**One-Time: Add .gitignore Rules**
```bash
# Ensure these are in .gitignore to prevent accidents:
echo "
# Asset pipeline intermediates (regeneratable)
assets/renders/
assets/concepts/
assets/models/
assets/audio/
" >> .gitignore

git add .gitignore
git commit -m "build: gitignore asset pipeline intermediates"
```

**Ready to commit!** Your workflow is now documented and tracked. 🚀
