# Arena NPC Enemy System — Design Spec

**Date**: 2026-03-15
**Status**: Approved
**Approach**: Extend existing NPC system in GameService (Approach A)

## Overview

Add up to 3 configurable NPC enemies to Arena that patrol the map and shoot at human players on sight. Enables solo play (1 human vs NPCs).

## Decisions

| Aspect | Decision |
|--------|----------|
| NPC type | Simple shooter — patrol, detect via LOS, stop and shoot with spread |
| Count | 0-3, configured in lobby settings |
| Difficulty | Fixed (HP 3, fire rate 600ms, ±15° spread) |
| Round participation | Full participants — count for round-end; if NPC is last alive, nobody wins |
| Targeting | Humans only — NPCs ignore each other |
| Solo play | Allowed when `npcEnemies >= 1` (relaxes 2-player minimum) |
| Spawning | At match start on spawn points; respawn each round |
| LOS | Grid raycast checking walls + cover with `blocksLineOfSight` |
| Frontend | Zombie sprite with red tint, HP pips, "Bot N" labels, kill feed |
| Lobby UI | Button group `0|1|2|3` alongside existing settings |

## Data Model

### NPC Interface (extended)

```typescript
export type NPCType = 'zombie' | 'enemy';
export type NPCState = 'wander' | 'chase' | 'patrol' | 'engage';

export interface NPC {
    id: string;
    type: NPCType;
    x: number;
    y: number;
    hp: number;
    speed: number;
    rotation: number;
    targetPlayerId: string | null;
    state: NPCState;
    wanderAngle: number;
    wanderChangeTime: number;
    lastDamageTime: number;
    // Enemy NPC fields:
    weapon?: WeaponState;
    lastShotTime?: number;
    engageRange?: number;
    patrolTarget?: { x: number; y: number };
    losLostTime?: number;       // timestamp when LOS was lost (for 2s grace)
    label?: string;             // "Bot 1", "Bot 2", etc.
}
```

### Lobby Settings (extended)

```typescript
export interface ArenaLobbySettings {
    maxPlayers: 2 | 3 | 4;
    bestOf: 1 | 3 | 5;
    shrinkingZone: boolean;
    shrinkInterval: number;
    itemSpawns: boolean;
    itemSpawnInterval: number;
    npcEnemies: 0 | 1 | 2 | 3;  // NEW
}
```

### Constants

```typescript
export const ENEMY_CONST = {
    SPEED_FACTOR: 0.5,
    AGGRO_RANGE: 192,           // 6 tiles
    DEAGGRO_RANGE: 256,         // 8 tiles
    FIRE_RATE_MS: 600,
    SPREAD_RAD: 0.26,           // ~15 degrees
    HP: 3,
    LOS_LOSS_MS: 2000,          // 2s grace before disengage
} as const;
```

## NPC Enemy AI

### State Machine

```
patrol ──(player in range + LOS)──> engage
engage ──(player out of range or LOS lost 2s)──> patrol
```

### Patrol Behavior

1. NPC picks a random walkable tile as patrol target
2. Moves toward it at `PLAYER_SPEED * ENEMY_CONST.SPEED_FACTOR`
3. Respects collision via `isValidPosition()`
4. On reaching target (within 16px), picks a new random target
5. Rotation follows movement direction

### Engage Behavior

1. Triggered when a human player enters LOS within `AGGRO_RANGE` (192px)
2. NPC stops moving, faces the player
3. Fires pistol every `FIRE_RATE_MS` (600ms) with `SPREAD_RAD` (±15°) random offset
4. Projectiles created via new `createNPCProjectile(game, npc, angle)` helper — accepts NPC position/rotation instead of `PlayerState`, produces identical `Projectile` objects (same speed, damage, collision)
5. If player leaves `DEAGGRO_RANGE` (256px) or breaks LOS for `LOS_LOSS_MS` (2s), return to patrol
6. If current target dies, immediately scan for next target or return to patrol

### Separation from Zombie NPCs

Enemy NPCs use a **separate update function** (`updateEnemyNPCs()`) from the existing `updateNPCs()`. The existing zombie AI only processes NPCs with `state === 'wander' | 'chase'`; the new function only processes NPCs with `state === 'patrol' | 'engage'`. Both iterate `game.npcs` but each filters by NPC type. This avoids modifying existing zombie behavior.

When `npcEnemies >= 1`, zombie spawning is **disabled** (skip the periodic `spawnNPC()` call). Enemy NPCs replace zombies as the PvE element — having both would be confusing. Zombie NPCs still function normally when `npcEnemies === 0`.

### Line-of-Sight Raycast

Grid-based stepping from NPC to target:

1. Start at NPC position, end at player position
2. Step along ray in increments of `TILE_SIZE / 2` (16px)
3. At each step check:
   - Is this tile a wall (`tile === 1`)? → blocked
   - Does any cover with `blocksLineOfSight: true` contain this point? → blocked
4. Reach player without obstruction → LOS confirmed

Performance: 3 NPCs × 4 players × ~70 step checks = ~840 point checks/tick at 20Hz — negligible.

## Spawning

- Enemy NPCs spawn at match start (not periodically)
- `getSpawnPoints()` is called with `players.length + npcEnemies` as the count, so all 4 spawn points are available when needed (e.g., 1 human + 3 NPCs = 4 → all corners used). Humans are assigned first, NPCs fill the remaining spawn points.
- If more entities than 4 spawn points, extra NPCs spawn at random walkable positions near map center (along the cross paths via `ITEM_SPAWN_POINTS`)
- On new rounds: `startNextRound()` currently sets `game.npcs = []`. Instead, enemy NPCs are **preserved and reset** (HP restored, position reset to spawn point, state reset to `patrol`). Only zombie NPCs are cleared.

## Round-End Logic

**Key structural change**: `checkRoundEnd()` currently checks `alivePlayers.length <= 1` where `alivePlayers` is a `string[]` of human player IDs only. This must change:

- `checkRoundEnd()` counts alive humans + alive enemy NPCs (via `game.npcs.filter(n => n.type === 'enemy' && n.hp > 0).length`)
- `aliveCount = aliveHumans.length + aliveEnemyNPCs.length`
- Round ends when `aliveCount <= 1`
- **Determining the winner**:
  - If last alive is a human player → normal `roundsWon++`, that player's ID is `winnerId`
  - If last alive is an NPC → `winnerId` is set to `null` (nobody wins the round)
  - The `alivePlayers` array is **not changed** to include NPC IDs — NPCs are counted separately to avoid contaminating player-specific logic
- Killing an NPC increments the killer's `kills` stat and earns XP (tracked via existing `player-killed` event with NPC label as killer/victim name)

## Solo Play

- When `npcEnemies >= 1`, `startGame()` validation: `players.length + settings.npcEnemies >= 2` (instead of `players.length >= 2`)
- Host still must be ready
- Solo matches persist to database — stats, XP, match results all recorded

### Database Persistence Edge Cases

- `endMatchWithResults()` resolves `winnerId` via `SELECT id FROM players WHERE auth_user_id = $2`. Since NPC IDs are UUIDs (not auth user IDs), the winner must be determined **before** calling save:
  - If winner is a human → use their player ID as normal
  - If winner is an NPC or nobody → `winnerId` is `null`, `matches.winner_id` is stored as NULL
- `match_results` rows are only inserted for **human players** (NPCs don't have DB player records)
- `roundScores` is only keyed by human player IDs — NPC IDs are never added

## Frontend

### NPC Rendering (`Game.tsx`)

- New `renderEnemyNPCs()` function in the PixiJS render loop
- Uses zombie character sprite with red tint (`sprite.tint = 0xFF4444`)
- Fallback: red circle (radius 14) with white direction indicator line
- Name label: "Bot 1" / "Bot 2" / "Bot 3" in red text above NPC
- HP pips: 3 pips above name (same style as player HP)
- Projectiles from NPCs render automatically (already in `projectiles[]` array)

### Lobby Settings UI (`Lobby.tsx`)

- New setting row below "Item Spawns": "NPC Enemies"
- Button group: `0 | 1 | 2 | 3` (same style as Best Of selector)
- When npcEnemies >= 1, "Waiting for player..." text adds "(optional)"
- Start Game button enabled for 1 player when NPCs >= 1

### Kill Feed

- NPC kills appear in feed: "Bot 1 killed PlayerName" / "PlayerName killed Bot 2"
- **Socket event change**: `player-killed` event payload gains an optional `killerName` and `victimName` field. When killer or victim is an NPC, these fields carry the NPC `label` (e.g., "Bot 1"). The frontend uses `killerName ?? killer?.username ?? killerId` for display — no need to look up NPC IDs in the game state.

## Files Modified

| File | Changes |
|------|---------|
| `backend/src/types/game.ts` | `NPCType` union, extended `NPCState`, NPC interface fields, `ENEMY_CONST`, `npcEnemies` in `ArenaLobbySettings`, optional `killerName`/`victimName` in `player-killed` event type |
| `backend/src/services/GameService.ts` | `spawnEnemyNPCs()`, `updateEnemyNPCs()`, `createNPCProjectile()`, `hasLineOfSight()`, `checkRoundEnd()` changes (count alive NPCs separately), `startNextRound()` (preserve+reset enemy NPCs), `endMatchWithResults()` (null winnerId for NPC wins), suppress zombie spawns when `npcEnemies >= 1`. Import `ENEMY_CONST`. |
| `backend/src/services/LobbyService.ts` | Relax 2-player minimum when `npcEnemies >= 1` |
| `backend/src/maps/campus-courtyard.ts` | Export `ITEM_SPAWN_POINTS` for NPC fallback spawn positions |
| `frontend/src/components/Game.tsx` | `renderEnemyNPCs()` function, kill feed uses `killerName`/`victimName` fields |
| `frontend/src/components/Lobby.tsx` | NPC count setting UI, optional player slot text |
| `frontend/src/stores/gameStore.ts` | Settings inline type: add `npcEnemies` field |

## Testing Strategy

- Unit tests for `hasLineOfSight()` — wall blocking, cover blocking, clear LOS
- Unit tests for enemy NPC state transitions (patrol → engage → patrol)
- Unit tests for round-end logic with NPCs (human wins, NPC last alive, mixed)
- Unit tests for solo play lobby validation
- Manual playtesting for difficulty tuning (spread, fire rate, HP)
