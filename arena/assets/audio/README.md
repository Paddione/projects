# Arena Audio Assets

## Directory Structure

```
assets/audio/
├── _shared/              ← Reusable base sounds (master copies)
│   ├── footsteps/        ← Character movement sounds
│   ├── impacts/          ← Hit/collision sounds
│   ├── weapons/          ← Attack/swing sounds
│   └── ambience/         ← Background/idle sounds
├── sfx/                  ← Generated sound effects (from _shared)
├── music/                ← Generated music tracks
└── audio-manifest.json   ← Asset → sound mapping
```

## Workflow

1. **Add new sound effect:**
   - Create base sound in `_shared/{category}/`
   - Add mapping in `audio-manifest.json`
   - Re-run audio generation pipeline (Phase 5/6)

2. **Reuse sound:**
   - Reference in manifest by name
   - Pipeline automatically mixes/processes

3. **Update sound globally:**
   - Edit file in `_shared/`
   - All assets using that sound auto-update on next processing

## Manifest Format

```json
{
  "characters": {
    "warrior": {
      "footstep": "leather_footstep",  ← References _shared sound
      "impact": "flesh_impact"
    }
  },
  "shared_sounds": {
    "leather_footstep": "assets/audio/_shared/footsteps/leather.wav"
  }
}
```

## Current Shared Sounds

### Footsteps
- `leather_footstep` - Soft armor (warrior, archer)
- `metal_footstep` - Heavy armor (knight)
- `cloth_footstep` - Light armor (mage)

### Impacts
- `flesh_impact` - Character hit
- `metal_impact` - Equipment collision
- `magical_impact` - Spell effects

### Weapons
- `melee_swing` - Sword/axe attacks
- `staff_whoosh` - Staff casting
- `bowshot` - Arrow release

### Ambience
- `magic_hum` - Magical character idle
