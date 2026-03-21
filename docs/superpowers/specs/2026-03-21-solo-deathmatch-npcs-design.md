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
| Win outcome | Earn escrowed XP amount (fresh award) + scaled Respect |
| Lose outcome | 0 XP awarded, 0 Respect. Escrowed XP never awarded. |
| Infrastructure | Reuses existing escrow system with `matchConfig.solo` + `matchConfig.npcCount` |
| XP timing | L2P does NOT award XP before deathmatch. XP is held in escrow metadata and only awarded on win via settlement. |
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
    |             → Award 200 XP (from escrow) + 50 Respect
    |
    +-- LOSE --> POST /api/internal/match/settle { token, winnerId: null }
                  → 0 XP awarded, 0 Respect. Escrow marked settled.
```

## Pre-Existing Bugs to Fix

These bugs exist in the current multiplayer deathmatch flow and must be fixed for both solo and multiplayer to work correctly.

### Bug 1: Arena SocketService uses camelCase but GET escrow returns snake_case

`SocketService.ts:393` casts the escrow response as `{ playerIds, escrowedXp, matchConfig }` but the auth GET endpoint returns raw DB column names: `player_ids`, `escrowed_xp`, `match_config`. Fix: update Arena's cast to use snake_case, or add camelCase mapping in the auth GET endpoint. **Recommendation:** Add camelCase mapping in auth's GET `/api/internal/match/escrow/:token` response (consistent with other auth endpoints that return camelCase).

### Bug 2: Arena uses string player IDs but escrow stores integer arrays

`escrow.playerIds.includes(playerId)` fails because `playerIds` contains numbers (from `z.array(z.number())`) but Arena's `playerId` is a string. Fix: convert to number before comparison: `escrow.playerIds.includes(Number(playerId))`.

### Bug 3: Arena sends string winnerId but auth expects number

`GameService.ts:1449` sends `winnerId` as a string in the settle call, but `matchSettleSchema` expects `z.number()`. Fix: use `parseInt(winnerId)` in the Arena settle call. This is the single prescribed approach (no alternatives).

## Service Changes

### 1. L2P Backend — GameService.ts

**Remove 2-player minimum for deathmatch offer:**

Currently `startDeathmatchOffer()` only fires when `≥2 players` finish (line ~1699). Change the condition to fire for `≥1 player`.

**Add `solo` flag to deathmatch-offer event:**

When only 1 player finished the game, emit `deathmatch-offer` with `solo: true`. The current event payload at line 1727 is `{ earnedXp, timeoutSeconds }`. Update to:
```typescript
{
  earnedXp: Record<string, number>,  // existing
  timeoutSeconds: number,            // existing
  solo: boolean,                     // NEW: true when 1 player
}
```

**Update `DeathmatchOfferData` types:**

The frontend type at `DeathmatchModal.tsx` line 5 and `socketService.ts` line 66 must both be updated to include `solo: boolean`.

**Accept NPC count from solo player:**

The `deathmatch-accept` handler in `SocketService.ts` line 257 currently receives `{ lobbyCode: string }`. Update to accept optional `npcCount`:
```typescript
{ lobbyCode: string, npcCount?: 1 | 2 | 3 }
```

`GameService.handleDeathmatchAccept()` (line 1738) currently takes `(lobbyCode, playerId)`. Add `npcCount` parameter:
```typescript
handleDeathmatchAccept(lobbyCode: string, playerId: string, npcCount?: 1 | 2 | 3)
```

Store `npcCount` in the `deathmatchChallenges` map entry (line 129) — add `npcCount?: number` to the challenge state.

**Validate npcCount:**

Server-side validate `npcCount` is in `[1, 2, 3]`. Reject invalid values.

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

When `solo: true`, skip the 60-second wait for other players. Two `DEATHMATCH_MIN_PLAYERS` gates need bypassing for solo:

1. **In `handleDeathmatchAccept()` (line ~1759):** The early-resolve path checks `challenge.acceptedPlayerIds.size >= DEATHMATCH_MIN_PLAYERS`. For solo, 1 acceptance should trigger immediate resolution. Bypass this gate when `solo: true`.

2. **In `resolveDeathmatchChallenge()` (line ~1796):** Also checks `acceptedIds.length >= DEATHMATCH_MIN_PLAYERS`. Same bypass needed for solo.

**Defer XP award:**

When the player accepts a deathmatch, L2P must NOT award the earned XP via `CharacterService.awardExperience()`. The XP amount is recorded in the escrow only. If the player declines, XP is awarded normally. This requires checking whether a deathmatch was accepted before calling `awardExperience` in `ScoringService.savePlayerResult()` (line ~248).

### 2. L2P Frontend — ResultsPage.tsx / DeathmatchModal.tsx

**Update `DeathmatchOfferData` interface:**

In `DeathmatchModal.tsx` (line 5), add `solo: boolean` to the interface. In `socketService.ts` (line 66), update the socket event type to match.

**Modified offer UI for solo games:**

When `deathmatch-offer` has `solo: true`, show:
- Heading: "Gambit your XP in Arena vs NPCs?"
- XP at stake: "You're risking {xpAmount} XP" — extract from `earnedXp` Record: `const xpAmount = Object.values(earnedXp)[0]`
- NPC count picker with reward preview:
  - Button: "1 NPC — 25 Respect"
  - Button: "2 NPCs — 50 Respect"
  - Button: "3 NPCs — 100 Respect"
- Decline button: "Keep XP"

**Accept emits NPC count:**

Clicking an NPC button emits `deathmatch-accept` with `{ lobbyCode, npcCount: 1|2|3 }`.

**Existing multiplayer offer unchanged:**

When `solo: false` (or absent), the existing Accept/Decline UI works as before. No NPC picker shown for multiplayer deathmatches.

### 3. Arena Backend — SocketService.ts

**Read solo config from escrow:**

In the `join-private-match` handler, after fetching the escrow. Note: the DB column is `match_config` (snake_case) — verify whether Drizzle returns it as `match_config` or `matchConfig`. Use the correct key:
```typescript
const config = escrow.match_config || escrow.matchConfig || {};
const isSolo = config.solo === true;
const npcCount = config.npcCount || 2;
```

**Auto-configure lobby for solo:**

When creating the lobby from escrow:
```typescript
if (isSolo) {
  lobby.settings.npcEnemies = npcCount;
}
```

**Update `maxPlayers` type for solo:**

The `ArenaLobbySettings.maxPlayers` type in `types/game.ts` line 192 is `2 | 3 | 4`. For solo matches, we need to allow `1`. Either:
- Widen the type to `1 | 2 | 3 | 4`
- Or set `maxPlayers = 2` for solo matches (1 human + NPCs don't count as players)

Recommendation: Set `maxPlayers = 2` for solo matches since NPCs are managed separately from the players array. This avoids a type change.

**Skip waiting for other players:**

Currently the private match handler waits for all `expectedPlayerIds` to join. When `isSolo`, start the match immediately once the single player joins — don't wait for anyone else.

**Existing character ownership check applies:**

The ownership validation added in the earlier character gating feature works for solo matches too (same `join-private-match` code path).

### 4. Auth — internal.ts (Settlement)

**Update `matchSettleSchema` to allow null winnerId:**

The current Zod schema at line 40 validates `winnerId: z.number().int().positive()`. Update to:
```typescript
winnerId: z.number().int().positive().nullable(),
```

**Scaled Respect by NPC count:**

In the `POST /api/internal/match/settle` handler, read `npcCount` from the escrow's `match_config` (snake_case DB column):
```typescript
const npcCount = escrow.match_config?.npcCount;
let respectAmount = 50; // default for multiplayer
if (npcCount !== undefined) {
  const respectMap: Record<number, number> = { 1: 25, 2: 50, 3: 100 };
  respectAmount = respectMap[npcCount] ?? 50;
}
```

**Forfeit path (winnerId: null):**

Add handling for `winnerId === null` before the existing winner logic:
```typescript
if (winnerId === null) {
  // Forfeit: mark escrow settled, award nothing
  await tx.update(matchEscrow)
    .set({ status: 'settled', settled_at: new Date() })
    .where(eq(matchEscrow.token, token));

  return { xpAwarded: 0, respectAwarded: 0, forfeited: true };
}
```

**XP is never debited at escrow creation.** The escrow system records XP amounts as metadata only — it does not debit XP from profiles. Therefore:
- **Win:** Settlement awards escrowed XP to the winner via `ProfileService.awardXp()` (same as multiplayer)
- **Forfeit:** Settlement does nothing — XP was never awarded in the first place. L2P deferred the XP award when the deathmatch was accepted (see Section 1).

This means the "gambit" works because L2P withholds XP until settlement, not because auth debits it.

**Backward compatibility:**

- Multiplayer matches (no `npcCount` in config) → 50 Respect as before
- `winnerId: null` only valid when `matchConfig.solo === true`
- Existing multiplayer settlement unchanged

**winnerId type coercion:**

Arena must call `parseInt(winnerId)` before sending to the settle endpoint (see Pre-Existing Bug 3). This applies to both solo and multiplayer paths.

### 5. Arena Backend — GameService.ts (Loss Detection)

**Solo loss = all humans dead:**

When all human players die, `checkRoundEnd` (line 1314) sets `winnerId = ''` (empty string), not an NPC ID. The match end logic needs to detect this:

```typescript
// In endMatchWithResults, after determining winnerId:
if (game.escrowToken) {
  // winnerId is '' when all humans die (NPCs win)
  const isHumanWinner = winnerId !== '' && game.players.some(p => p.id === winnerId);
  await settleMatch(game.escrowToken, isHumanWinner ? parseInt(winnerId) : null);
}
```

**Player disconnect during solo match:**

If the solo player disconnects mid-match, treat it as a forfeit. The current disconnect handler (`SocketService.ts:551-578`) only handles lobby leave — it does not handle active match disconnects. Add a new method `GameService.forfeitMatch(gameId: string)` that:
1. Checks if the game has an `escrowToken`
2. Calls settle with `winnerId: null`
3. Ends the game

The disconnect handler should call `forfeitMatch` when:
- The disconnecting player is in an active game (not just a lobby)
- The game has `matchConfig.solo === true` in its escrow
- No human players remain connected

For multiplayer escrow matches, the existing behavior (remaining player wins) already works.

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
- **Modify:** `l2p/backend/src/services/GameService.ts` (remove 2-player min, solo flag, npcCount in escrow, auto-resolve, defer XP)
- **Modify:** `l2p/backend/src/services/SocketService.ts` (accept npcCount in deathmatch-accept handler)
- **Modify:** `l2p/backend/src/services/ScoringService.ts` (defer XP award when deathmatch accepted)

### L2P Frontend
- **Modify:** `l2p/frontend/src/pages/ResultsPage.tsx` (NPC picker UI for solo offers)
- **Modify:** `l2p/frontend/src/components/DeathmatchModal.tsx` (update DeathmatchOfferData interface)
- **Modify:** `l2p/frontend/src/services/socketService.ts` (update socket event type for solo flag)

### Arena Backend
- **Modify:** `arena/backend/src/services/SocketService.ts` (read solo/npcCount from escrow, auto-start, configure NPCs)
- **Modify:** `arena/backend/src/services/GameService.ts` (detect NPC winner → forfeit settlement, disconnect handling)

### Auth
- **Modify:** `auth/src/routes/internal.ts` (update matchSettleSchema for nullable winnerId, scaled Respect, forfeit path, camelCase GET escrow response)
