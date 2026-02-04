# Perk System Rework — Skill Tree & Draft Mechanic

**Date:** 2026-02-04
**Status:** Approved Design

## Overview

Rework the L2P perk system from flat auto-unlock to a draft-based skill tree. Players earn 1 perk point per level (levels 1-30), pick from 3 random gameplay perks each level, and build a unique loadout. Cosmetics unlock separately with a character creator in early levels.

## Core Draft Mechanic

### Pool

- **40 gameplay perks** total, 8 per category (Time, Information, Scoring, Recovery, XP)
- All perks start in the player's available pool

### On Level Up (Levels 1-30)

1. Results screen shows XP earned, bar animates, level increments with celebration
2. Draft panel slides in showing **3 random perks** from the player's remaining pool
3. Each perk card displays: flat vector icon, name, category color stripe, effect description
4. Player either:
   - **Picks one** — perk is locked in and immediately active; other 2 return to the pool
   - **Dumps all 3** ("Alle ablehnen") — all 3 are permanently removed from the pool (with confirmation dialog)
5. Picked perk takes effect starting next game

### Pool Exhaustion

- When the pool is empty (all perks either picked or dumped): **"Du kannst schon alles digga"** — no selection shown on future level-ups

### Multiple Level-Ups

If a player gains multiple levels in one game, they draft sequentially — one pick per level, shown in order.

### Full Reset (Respec)

- Available from the skill tree screen via "Zurücksetzen" button
- **Clean slate**: ALL perks return to the pool, including previously dumped ones
- Player keeps their level and XP
- Enters sequential re-draft flow: pick-1-of-3 for each level from 1 to current level
- Confirmation dialog: "Alle Perks und Ablehnungen werden zurückgesetzt. Du wählst erneut für jedes Level."

## The 40 Gameplay Perks

### Balance Philosophy

Every category has perks that are situationally strong. No single perk dominates — draft order should not decide game outcomes.

- **Time** perks help cautious players
- **Information** perks reward strategic play
- **Scoring** perks reward aggressive/fast play
- **Recovery** perks help inconsistent players
- **XP** perks trade game performance for faster leveling

### Time (Blue) — 8 Perks

| Perk | Effect |
|------|--------|
| **Quick Breather** | +2 seconds per question |
| **Deep Breath** | +4 seconds per question |
| **Slow Motion** | Timer ticks 20% slower |
| **Time Warp** | Timer ticks 30% slower, but -5% score |
| **Last Stand** | +5 seconds when under 3s remaining (once per game) |
| **Early Bird** | +10% score if answered in first 25% of time |
| **Time Bank** | Unused seconds carry over (max +5s banked) |
| **Pause** | Freeze timer for 3s once per game |

### Information (Yellow) — 8 Perks

| Perk | Effect |
|------|--------|
| **Fifty-Fifty** | Eliminate 1 wrong answer once per game |
| **Sharp Eye** | Eliminate 1 wrong answer twice per game |
| **Category Scout** | See question category before it appears |
| **Difficulty Sense** | See difficulty rating before answering |
| **Crowd Wisdom** | See % of players who picked each answer (after answering) |
| **Hot Streak Hint** | After 3-streak, next question highlights 1 wrong answer |
| **Subject Expert** | +15% score on your best-performing category |
| **Preview** | See next question's topic during current question |

### Scoring (Green) — 8 Perks

| Perk | Effect |
|------|--------|
| **Score Boost** | +5% base score |
| **Power Surge** | +10% base score, but streak resets on wrong answer |
| **Streak Builder** | Streak multiplier grows 25% faster |
| **Combo King** | Max streak multiplier is 6x instead of 5x |
| **Speed Demon** | +20% score for answers under 3 seconds |
| **Perfectionist** | +50% score for all-correct rounds |
| **Closer** | +25% score on last 3 questions of a game |
| **Clutch Player** | Double points when trailing 1st place |

### Recovery (Red) — 8 Perks

| Perk | Effect |
|------|--------|
| **Safety Net** | First wrong answer per game doesn't break streak |
| **Thick Skin** | First 2 wrong answers don't break streak |
| **Bounce Back** | +10% score on the question after a wrong answer |
| **Second Wind** | After 2 wrong in a row, next correct answer gives 2x |
| **Partial Credit** | Wrong answers still earn 25% of base score |
| **Streak Shield** | Streak only drops by 1 instead of resetting (once per game) |
| **Comeback** | +15% score when below average in current game |
| **Resilience** | Streak multiplier starts at 2x instead of 1x |

### XP & Progression (Purple) — 8 Perks

| Perk | Effect |
|------|--------|
| **XP Boost** | +10% XP earned |
| **XP Surge** | +20% XP, but -5% score |
| **Study Bonus** | +15% XP on categories you score below 50% |
| **Streak XP** | Bonus XP equal to streak at end of game |
| **Participation** | Earn XP even on wrong answers (5% of base) |
| **Dedication** | +25% XP for completing a full game (no disconnects) |
| **Quick Learner** | +30% XP for first 3 games each day |
| **Mentor** | +10% XP for every player in the lobby |

## Cosmetic System (Separate from Skill Tree)

### Character Creator — Early Levels (1-5)

Cosmetics auto-unlock. Each unlock triggers a customization screen.

| Level | Unlock | Options |
|-------|--------|---------|
| 1 | **Gender / Body Type** | 4 base body types (masculine, feminine, androgynous, stocky) |
| 2 | **Hairstyles** | 8 starter styles per body type |
| 3 | **Outfits** | 6 starter outfits (casual, sporty, academic, streetwear, formal, cozy) |
| 4 | **Poses** | 5 poses (standing, arms crossed, thumbs up, thinking, waving) |
| 5 | **Skin Tones & Accessories** | 8 skin tones, starter glasses/hats |

### Later Cosmetics (Levels 6-30)

| Levels | Unlocks |
|--------|---------|
| 6-10 | Additional hairstyles (4), color dyes, new hat options |
| 11-15 | Premium outfits (lab coat, wizard robe, hoodie+headphones, suit), answer animations (bounce, glow) |
| 16-20 | Victory celebrations (confetti, fireworks, stars), emote sets for lobby chat |
| 21-25 | Rare outfits (astronaut, knight, detective), profile frames, custom name colors |
| 26-30 | Legendary set (golden outfit, crown, aura effects), title "Quiz Master" |

### Avatars Visible In-Game

- **Lobby:** Full avatar next to player name
- **During questions:** Small avatar portraits in a player bar (top or side)
- **Results screen:** Avatars in ranking with victory pose for winner
- **Streak/answer moments:** Avatar reacts (celebration on correct, shrug on wrong)

Avatars rendered as **composited SVG layers** — body + hair + outfit + pose + accessories stacked. Small file sizes, full mix-and-match.

## Skill Tree Visualization

### Layout

Horizontal scrollable path from level 1 (left) to level 30 (right). Central line with short branches forking off at each node.

```
        [Time perk]
       /
  (1)----(2)----(3)----(4)----(5)---- ... ----(30)
       \           \
    [Info perk]   [Recovery perk]
```

### Node States

| State | Visual |
|-------|--------|
| Not yet reached | Empty circle |
| Reached, unspent | Glowing circle with "?" |
| Perk chosen | Filled node with perk icon, branch extends with category color |
| Dumped | Crossed-out node |

### Category Colors

| Category | Color |
|----------|-------|
| Time | Blue |
| Information | Yellow |
| Scoring | Green |
| Recovery | Red |
| XP | Purple |

### Interactions

- **Hover/tap a filled node** — tooltip with perk name, description, effect
- **Scroll/drag** to pan along path
- **Zoom** to show full tree or current progress area
- **Reset button** — bottom corner, triggers full respec with confirmation
- **Current level** pulses gently
- **Progress indicator** — "12/30 Perks" with mini progress bar above tree
- Conquered path (behind current level): solid bright line
- Future path: faded/dotted line

## Results Screen Draft Flow

### Sequence

1. Game ends → results screen shows scores and rankings
2. XP bar animates → player sees XP earned, bar fills
3. Level up detected → bar overflows, level increments with celebration
4. Draft panel slides in → bottom half of results screen

### Draft Panel Layout

```
┌──────────────────────────────────────┐
│  Level 12!  Wähle einen Perk:        │
│                                       │
│  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │ icon │  │ icon │  │ icon │       │
│  │      │  │      │  │      │       │
│  │Time  │  │Score │  │Recov │       │
│  │Bank  │  │Boost │  │Safety│       │
│  │      │  │      │  │Net   │       │
│  │+5s   │  │+5%   │  │1 free│       │
│  │banked│  │score │  │miss  │       │
│  └──┬───┘  └──┬───┘  └──┬───┘       │
│     │         │         │            │
│  [Wählen]  [Wählen]  [Wählen]       │
│                                       │
│  [Alle ablehnen]                      │
└──────────────────────────────────────┘
```

- Each card: icon, category color stripe, perk name, short effect text
- Hover/tap to expand longer description
- "Wählen" button under each card
- "Alle ablehnen" with confirmation dialog
- After picking: animation of perk flying into skill tree node

## Technical Architecture

### Database Changes

**`perks` table (reworked):**
- Remove `level_required`
- Add `category` enum: `time`, `info`, `scoring`, `recovery`, `xp`
- Add `tier` field
- Add `effect_config` JSONB — actual gameplay values (e.g., `{"bonus_seconds": 2}`)
- Keep `name`, `title`, `description`, `config_schema`, `asset_data`, `is_active`

**`user_perk_drafts` table (new):**
- `id` (SERIAL PRIMARY KEY)
- `user_id` (FK → users.id)
- `level` (INTEGER) — which level this draft is for
- `offered_perk_ids` (INTEGER[]) — the 3 perks shown
- `chosen_perk_id` (INTEGER, nullable) — which was picked (null if dumped)
- `dumped` (BOOLEAN) — whether all 3 were rejected
- `drafted_at` (TIMESTAMP)
- UNIQUE(user_id, level)

**`user_perks` table (simplified):**
- Tracks which gameplay perks a user currently has active
- All picked perks are always active (no equip slots for gameplay perks)

**`cosmetic_unlocks` table (new):**
- `user_id` (FK → users.id)
- `cosmetic_type` enum: `body`, `hair`, `outfit`, `pose`, `accessory`, `skin_tone`, `animation`, `celebration`, `emote`, `frame`, `name_color`, `title`
- `cosmetic_id` (VARCHAR) — identifier of the specific item
- `unlocked_at` (TIMESTAMP)
- UNIQUE(user_id, cosmetic_type, cosmetic_id)

**`user_avatar` table (new):**
- `user_id` (FK → users.id, UNIQUE)
- `body_type` (VARCHAR)
- `skin_tone` (VARCHAR)
- `hairstyle` (VARCHAR)
- `hair_color` (VARCHAR)
- `outfit` (VARCHAR)
- `pose` (VARCHAR)
- `accessories` (JSONB) — array of equipped accessory IDs
- `updated_at` (TIMESTAMP)

### Backend Services

- **`PerkDraftService`** (new) — draft logic: generate 3 random perks, validate picks, handle dumps, full reset, re-draft flow
- **`PerkEffectService`** (new) — applies active perk effects during gameplay (modifies timer, score, streak logic)
- **`CosmeticService`** (new) — manages cosmetic unlocks and avatar composition
- **`ScoringService`** (modified) — check active perks before calculating scores
- **`GameService`** (modified) — apply time/info perks during question flow
- **`SocketService`** — new events: `perk:draft-offer`, `perk:drafted`, `perk:reset`, `avatar:updated`

### Frontend Components

- **`SkillTree.tsx`** (new) — linear path visualization, accessible from profile
- **`PerkDraftPanel.tsx`** (new) — 3-card selection UI for results screen
- **`CharacterCreator.tsx`** (new) — mix-and-match avatar builder
- **`AvatarRenderer.tsx`** (new) — composites SVG layers for display anywhere in the app
- **`ResultsPage.tsx`** (modified) — integrates draft panel on level-up
- **`gameStore`** (extended) — draft state and avatar data

### Assets

- 40 perk icons (flat vector SVG, one per perk, category-colored)
- Character parts (SVG layers): body types, hairstyles, outfits, poses, accessories, skin tones
- Skill tree path graphics

### Migration Strategy

1. Existing `user_perks` data archived
2. Old cosmetic perks become free cosmetic unlocks
3. Players keep levels and XP
4. On first login post-migration, players with level > 1 enter the respec flow to draft perks from level 1 to current level
5. Old perk definitions replaced with 40 new gameplay perks + cosmetic catalog
