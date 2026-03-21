# Single-Player Deathmatch vs NPCs

**Date:** 2026-03-21
**Status:** Approved
**Scope:** L2P (backend + frontend), Arena (backend), Auth (settlement)

## Problem

After a single-player L2P game, the player has no option to enter an Arena deathmatch because the deathmatch offer only fires for 2+ players. Arena already supports solo play with NPCs (1 human + 1-3 bots). We want solo L2P players to gambit their earned XP in an Arena match vs NPCs, with scaled Respect rewards based on difficulty.

## Decisions

| Aspect | Decision |
|--------|----------|
| Trigger | Deathmatch offer fires for 1+ players (was 2+) |
| Stakes | Solo player risks earned L2P XP |
| NPC count | Player chooses 1, 2, or 3 in ResultsPage |
| Respect reward | Scaled: 1 NPC = 25, 2 NPCs = 50, 3 NPCs = 100 |
| Win outcome | Keep XP + earn scaled Respect |
| Lose outcome | XP forfeited (destroyed), 0 Respect |
| Infrastructure | Reuses existing escrow system with `matchConfig.solo` + `matchConfig.npcCount` |
| Arena match | Auto-starts when solo player joins (no waiting), NPCs configured from escrow |
| UX | Same ResultsPage popup as multiplayer, with added NPC count picker |

## Architecture

### Flow Diagram

```
Solo L2P Game Ends (1 player, earned 200 XP)
    |
    v
deathmatch-offer { solo: true, earnedXp: 200 }
    |
    v
ResultsPage: "Gambit your 200 XP in Arena?"
  [1 NPC: 25 Respect] [2 NPCs: 50 Respect] [3 NPCs: 100 Respect]
  [Decline - keep XP]
    |
    v (player picks 2 NPCs)
deathmatch-accept { npcCount: 2 }
    |
    v
POST /api/internal/match/escrow {
  playerIds: [userId],
  escrowedXp: { "userId": 200 },
  matchConfig: { source: 'l2p', lobbyCode, solo: true, npcCount: 2 }
}
    |
    v
Token returned → deathmatch-start { url: arena.korczewski.de/match/{token} }
    |
    v
Arena: GET /api/internal/match/escrow/{token}
  → solo: true, npcCount: 2
  → Create lobby with npcEnemies: 2
  → Start immediately (don't wait for more players)
    |
    v
Match plays out (player vs 2 NPCs)
    |
    +-- WIN --> POST /api/internal/match/settle { token, winnerId: userId }
    |             → Return 200 XP + award 50 Respect
    |
    +-- LOSE --> POST /api/internal/match/settle { token, winnerId: null }
                  → Forfeit 200 XP (destroyed) + 0 Respect
```

## Service Changes

### 1. L2P Backend — GameService.ts

**Remove 2-player minimum for deathmatch offer:**

Currently `startDeathmatchOffer()` only fires when `≥2 players` finish. Change the condition to fire for `≥1 player`.

**Add `solo` flag to deathmatch-offer event:**

When only 1 player finished the game, emit `deathmatch-offer` with `solo: true`. The event payload becomes:
```typescript
{
  earnedXp: number,
  solo: boolean,        // NEW: true when 1 player
  playerIds: string[],
}
```

**Accept NPC count from solo player:**

The `deathmatch-accept` event currently just signals acceptance. For solo mode, it includes `npcCount`:
```typescript
// Client emits:
socket.emit('deathmatch-accept', { npcCount: 2 })
```

The handler reads `npcCount` from the event data (default to 2 if missing for backward compat).

**Pass NPC count into escrow matchConfig:**

In `resolveDeathmatchChallenge()`, when creating the escrow:
```typescript
matchConfig: {
  source: 'l2p',
  lobbyCode,
  solo: true,       // NEW
  npcCount: 2,      // NEW: from player's choice
}
```

**Auto-resolve for solo:**

When `solo: true`, skip the 60-second wait for other players. Resolve immediately after the solo player accepts.

### 2. L2P Frontend — ResultsPage.tsx

**Modified offer UI for solo games:**

When `deathmatch-offer` has `solo: true`, show:
- Heading: "Gambit your XP in Arena vs NPCs?"
- XP at stake: "You're risking {earnedXp} XP"
- NPC count picker with reward preview:
  - Button: "1 NPC — 25 Respect"
  - Button: "2 NPCs — 50 Respect"
  - Button: "3 NPCs — 100 Respect"
- Decline button: "Keep XP"

**Accept emits NPC count:**

Clicking an NPC button emits `deathmatch-accept` with `{ npcCount: 1|2|3 }`.

**Existing multiplayer offer unchanged:**

When `solo: false` (or absent), the existing Accept/Decline UI works as before. No NPC picker shown for multiplayer deathmatches.

### 3. Arena Backend — SocketService.ts

**Read solo config from escrow:**

In the `join-private-match` handler, after fetching the escrow:
```typescript
const isSolo = escrow.matchConfig?.solo === true;
const npcCount = escrow.matchConfig?.npcCount || 2;
```

**Auto-configure lobby for solo:**

When creating the lobby from escrow:
```typescript
if (isSolo) {
  lobby.settings.npcEnemies = npcCount;
}
```

**Skip waiting for other players:**

Currently the private match handler waits for all `expectedPlayerIds` to join. When `isSolo`, start the match immediately once the single player joins — don't wait for anyone else.

**Existing character ownership check applies:**

The ownership validation added in the earlier character gating feature works for solo matches too (same `join-private-match` code path).

### 4. Auth — internal.ts (Settlement)

**Scaled Respect by NPC count:**

In the `POST /api/internal/match/settle` handler, read `npcCount` from the escrow's `matchConfig`:
```typescript
const npcCount = escrow.match_config?.npcCount;
let respectAmount = 50; // default for multiplayer
if (npcCount !== undefined) {
  const respectMap: Record<number, number> = { 1: 25, 2: 50, 3: 100 };
  respectAmount = respectMap[npcCount] ?? 50;
}
```

**Forfeit path (winnerId: null):**

Currently settlement always expects a valid `winnerId`. Add handling for `winnerId: null`:
```typescript
if (!winnerId) {
  // Forfeit: mark escrow settled, do NOT return XP, award 0 Respect
  await tx.update(matchEscrow)
    .set({ status: 'settled', settled_at: new Date() })
    .where(eq(matchEscrow.token, token));

  return { xpAwarded: 0, respectAwarded: 0, forfeited: true };
}
```

The escrowed XP is simply not returned — it's effectively destroyed. The player's auth profile XP was already debited when the escrow was created (the XP was "locked away").

**Backward compatibility:**

- Multiplayer matches (no `npcCount` in config) → 50 Respect as before
- `winnerId` is still required for multiplayer matches
- `winnerId: null` only valid when `matchConfig.solo === true`

### 5. Arena Backend — GameService.ts (Loss Detection)

**Solo loss = all rounds lost:**

The existing `endMatchWithResults()` determines a winner. When the solo player dies in all rounds (NPCs win), `winnerId` will be an NPC ID (not a real user). The match end logic needs to:
- Detect that the winner is an NPC (not in `escrow.playerIds`)
- Call settle with `winnerId: null` (forfeit)

```typescript
// In endMatchWithResults, after determining winnerId:
if (game.escrowToken) {
  const isHumanWinner = game.players.some(p => p.id === winnerId);
  await settleMatch(game.escrowToken, isHumanWinner ? winnerId : null);
}
```

## Testing Strategy

### L2P Backend
- Unit test: deathmatch offer fires for 1-player game with `solo: true`
- Unit test: `resolveDeathmatchChallenge` passes `npcCount` in escrow matchConfig
- Unit test: solo auto-resolves without 60-second wait

### L2P Frontend
- Component test: ResultsPage shows NPC picker when `solo: true`
- Component test: NPC button emits `deathmatch-accept` with correct `npcCount`
- Component test: multiplayer offer unchanged (no NPC picker)

### Arena Backend
- Unit test: solo private match auto-starts with 1 player
- Unit test: lobby created with `npcEnemies` from escrow config
- Unit test: NPC death triggers forfeit settlement

### Auth
- Unit test: scaled Respect (1→25, 2→50, 3→100)
- Unit test: forfeit path (`winnerId: null`) → 0 XP, 0 Respect, escrow settled
- Unit test: multiplayer settlement unchanged (50 Respect)

### Integration
- E2E: Solo L2P game → accept deathmatch (2 NPCs) → win → verify XP kept + 50 Respect earned
- E2E: Solo L2P game → accept deathmatch → lose → verify XP forfeited

## Files to Create/Modify

### L2P Backend
- **Modify:** `l2p/backend/src/services/GameService.ts` (remove 2-player min, solo flag, npcCount in escrow, auto-resolve)

### L2P Frontend
- **Modify:** `l2p/frontend/src/pages/ResultsPage.tsx` (NPC picker UI for solo offers)

### Arena Backend
- **Modify:** `arena/backend/src/services/SocketService.ts` (read solo/npcCount from escrow, auto-start, configure NPCs)
- **Modify:** `arena/backend/src/services/GameService.ts` (detect NPC winner → forfeit settlement)

### Auth
- **Modify:** `auth/src/routes/internal.ts` (scaled Respect, forfeit path for winnerId: null)
