---
name: asset-manifest-structure
enabled: true
event: file
conditions:
  - field: file_path
    operator: ends_with
    pattern: manifest.json
  - field: new_text
    operator: contains
    pattern: characters|weapons|items|tiles|covers
---

📋 **Asset Manifest Being Modified**

You're editing `assets/manifest.json` — the source of truth for all game assets. Ensure your changes follow the structure:

**Required Fields Per Asset:**
```json
{
  "id": "warrior",                 // Unique identifier (kebab-case)
  "category": "characters",        // characters, weapons, items, tiles, covers, ui
  "name": "Warrior",               // Display name
  "description": "...",            // AI prompt for concept art
  "model_prompt": "...",           // AI prompt for 3D model
  "frames": {
    "idle": 8,                     // Directions for this pose (8 = all, 1 = single angle)
    "run": 8,
    "attack": 4
  },
  "audio": {
    "footstep": "...",             // Audio file names in /assets/audio/sfx/
    "hit": "..."
  }
}
```

**Field Rules:**
- **id**: Must be unique across all assets (no duplicates!)
  - Regex: `/^[a-z0-9_-]+$/` (lowercase, numbers, hyphens, underscores only)
- **category**: Must match one of:
  - `characters` (8-direction rendering)
  - `weapons` (single-angle close-up)
  - `items` (centered icon-like)
  - `tiles` (top-down seamless)
  - `covers` (45° depth perspective)
  - `ui` (flat orthographic)
- **frames**: Integer 1-8 for directions (8 = full compass, 1 = front only)
- **audio**: Optional, filenames without extension (adds .ogg + .mp3 variants)

**Validation Checklist:**
- [ ] All IDs unique? `jq '.[] | .id' manifest.json | sort | uniq -d` (should be empty)
- [ ] Categories valid? `jq '.[] | .category' manifest.json | sort | uniq` (check list above)
- [ ] Frames in 1-8? `jq '.[] | .frames | .[] | values' manifest.json` (all ≥1 and ≤8)
- [ ] Prompts descriptive? At least 10 words for concept + model prompts
- [ ] Asset IDs formatted? No spaces, no uppercase

**After Editing:**
1. **Validate JSON syntax:**
   ```bash
   jq empty assets/manifest.json && echo "✅ Valid"
   ```

2. **New assets trigger regeneration:**
   ```bash
   # If you added a character "paladin":
   ./scripts/generate_all.sh  # Full pipeline, or
   ASSET_ID=paladin ./scripts/render_sprites.py  # Render only
   ```

3. **Modified assets:**
   - Changed `name` or `description`? → Re-run Phase 1 (concept art)
   - Changed `frames`? → Re-run Phase 3 (sprite rendering)
   - Changed `audio` mappings? → Re-run Phase 5 (audio generation)

**Common Mistakes:**
- ❌ Uppercase letters in IDs → Use lowercase only
- ❌ Duplicate IDs → Breaks asset lookup
- ❌ Invalid category → Pipeline won't know which template to use
- ❌ frames=0 → Requires at least 1 direction

**Example Valid Entry:**
```json
{
  "id": "archer",
  "category": "characters",
  "name": "Archer",
  "description": "Elite ranged warrior in leather armor with bow and quiver",
  "model_prompt": "Fantasy archer character, leather armor, bow equipment",
  "frames": {
    "idle": 8,
    "run": 8,
    "shoot": 4
  },
  "audio": {
    "bowshot": "arrow_release",
    "footstep": "leather_step"
  }
}
```

Proceed with confidence — the pipeline will guide you through rendering!
