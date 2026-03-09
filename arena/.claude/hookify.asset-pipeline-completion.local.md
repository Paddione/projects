---
name: asset-pipeline-completion
enabled: true
event: stop
pattern: .*
---

🎬 **Asset Pipeline Work Complete**

Before finishing your session, verify your asset pipeline work is ready for deployment:

**Post-Generation Checklist:**

**1. Output Validation** ✓
   ```bash
   # Verify all phases completed successfully
   [ ] assets/renders/characters/ has frame files
   [ ] frontend/public/assets/sprites/ has .png + .json
   [ ] frontend/public/assets/audio/ has .ogg + .mp3
   ```

**2. Asset Manifest** ✓
   ```bash
   # Validate manifest.json structure
   jq empty assets/manifest.json && echo "✅ Valid JSON"

   # Check for duplicate IDs
   jq '.[] | .id' assets/manifest.json | sort | uniq -d
   # ^ Should be empty (no duplicates)
   ```

**3. Game Loads Assets** ✓
   ```bash
   # Start frontend dev server
   npm run dev:frontend &

   # Check console (should see no asset load errors)
   # Look for: "AssetService: Loaded X sprites"
   ```

**4. Sprite Atlas Integrity** ✓
   ```bash
   # Verify atlases are properly packed
   ls -lh frontend/public/assets/sprites/

   # Check metadata is valid
   jq '.frames | keys | length' frontend/public/assets/sprites/characters.json
   ```

**5. Blender Templates Saved** ✓
   ```bash
   # If you edited Blender templates:
   git status assets/blend/

   # Should show modified .blend files staged
   ```

**6. Documentation Updated** ✓
   ```bash
   # If adding new assets or changing pipeline:
   [ ] arena/CLAUDE.md updated with new asset descriptions?
   [ ] assets/manifest.json reflects all new assets?
   [ ] TESTING.md has asset generation steps?
   ```

**Staging & Committing:**

**Step 1: Stage the right files**
```bash
# Stage Blender templates (if modified)
git add assets/blend/

# Stage final packed assets (required)
git add frontend/public/assets/sprites/
git add frontend/public/assets/audio/

# Stage manifest & docs
git add assets/manifest.json
git add arena/CLAUDE.md
git add scripts/
```

**Step 2: Verify nothing unintended is staged**
```bash
# Should NOT see:
git diff --cached --name-status | grep -E "assets/(renders|audio|models|concepts)"

# Should see:
git diff --cached --name-status | grep -E "assets/blend|frontend/public/assets"
```

**Step 3: Create meaningful commit**
```bash
git commit -m "assets(arena): {description}

- Rendered {N} characters with {poses} poses
- Packed into sprite atlases
- Added to manifest: {asset_ids}
- Validates: Game loads without errors

Stages: Concept ✓ 3D ✓ Render ✓ Pack ✓ Audio ✓
"
```

**Step 4: Push and Deploy**
```bash
# Push to remote
git push origin master

# Deploy to production
./k8s/scripts/deploy/deploy-arena.sh

# Verify deployment
kubectl rollout status deployment/arena-frontend -n korczewski-services
```

**Deployment Verification:**

After deploying, test in production:
```bash
# 1. Health check
curl https://arena.korczewski.de/api/health | jq .

# 2. Open game in browser
# https://arena.korczewski.de

# 3. Open browser console (F12)
# Look for: No 404 errors loading sprites
# Look for: Console shows "Assets loaded: X"

# 4. Start a game
# Verify characters render with new sprites
```

**Common Issues & Recovery:**

| Issue | Solution |
|-------|----------|
| "Failed to load sprite" console error | Sprites not in atlas. Re-run: `generate_all.sh --phase 4` |
| Render quality worse than before | Blender lighting changed. Review character.blend |
| Game doesn't start | Missing asset in manifest. Run validation: `jq .characters manifest.json` |
| Deployment failed | Image build error. Check: `docker build -f arena/frontend/Dockerfile .` |
| Too many commits for one feature | Next time: Combine asset + code in single feature branch |

**If You Need to Redo:**

**Regenerate specific phase:**
```bash
# Concept art only
./scripts/generate_all.sh --phase 1

# Render sprites only
./scripts/generate_all.sh --phase 3

# Re-pack atlases only
./scripts/generate_all.sh --phase 4
```

**Discard uncommitted changes:**
```bash
git reset --hard HEAD     # Discard all local changes
git clean -fd             # Delete untracked files
```

**Incomplete But Committed:**
```bash
# Undo last commit (keep changes staged)
git reset --soft HEAD~1

# Continue working or fix issues
```

**Next Session Checklist:**

When you return to work on assets:
1. Check deployment status: `k3d/deploy-tracker.sh status`
2. Verify production is running: `curl https://arena.korczewski.de/api/health`
3. Review uncommitted changes: `git status`
4. Check if more phases needed: `ls -la assets/renders/ assets/audio/`

**File Locations Reference:**
- **Blender templates:** `arena/assets/blend/`
- **Generation scripts:** `arena/scripts/`
- **Asset manifest:** `arena/assets/manifest.json`
- **Rendered frames:** `arena/assets/renders/` (gitignored, intermediate)
- **Final sprites:** `arena/frontend/public/assets/sprites/` (committed)
- **Final audio:** `arena/frontend/public/assets/audio/` (committed)

**Resources:**
- Full Blender guide: `arena/CLAUDE.md` → "Blender Sprite Rendering"
- Quick reference: `arena/BLENDER_QUICK_REFERENCE.md`
- Pipeline overview: `/mnt/f/Obsidian/services/Arena.md`

**You're all set!** Your asset pipeline work is documented, tested, and ready for deployment. 🎉
