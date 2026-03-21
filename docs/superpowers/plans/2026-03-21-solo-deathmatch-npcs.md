# Solo Deathmatch vs NPCs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow solo L2P players to gambit earned XP in Arena deathmatch vs 1-3 NPCs, with scaled Respect rewards.

**Architecture:** Extends the existing L2P→Auth escrow→Arena private match pipeline. L2P defers XP award when deathmatch is accepted, stores NPC count in escrow matchConfig. Arena auto-starts solo matches with configured NPCs. Auth settlement scales Respect by NPC count and supports forfeit (winnerId: null).

**Tech Stack:** L2P backend (Express/Socket.io), L2P frontend (React), Arena backend (Express/Socket.io), Auth (Express/Drizzle)

**Spec:** `docs/superpowers/specs/2026-03-21-solo-deathmatch-npcs-design.md`

---

## File Structure

### Pre-Existing Bug Fixes
| File | Action | Responsibility |
|------|--------|---------------|
| `auth/src/routes/internal.ts` | Modify | camelCase GET escrow response, nullable winnerId, scaled Respect, forfeit path |
| `arena/backend/src/services/SocketService.ts` | Modify | Fix snake_case escrow fields, Number() player ID comparison, solo auto-start |
| `arena/backend/src/services/GameService.ts` | Modify | parseInt winnerId in settle call, NPC-win forfeit detection, forfeitMatch method |

### New Feature
| File | Action | Responsibility |
|------|--------|---------------|
| `l2p/backend/src/services/GameService.ts` | Modify | Solo offer, npcCount in challenge state + escrow, bypass min-player gates |
| `l2p/backend/src/services/ScoringService.ts` | Modify | Defer XP award when deathmatch is accepted |
| `l2p/backend/src/services/SocketService.ts` | Modify | Accept npcCount in deathmatch-accept handler |
| `l2p/frontend/src/pages/ResultsPage.tsx` | Modify | NPC picker UI for solo offers |

---

## Task 1: Auth — Fix Escrow GET Response + Settle Schema

**Files:**
- Modify: `auth/src/routes/internal.ts:38-41,135-153,160-211`

- [ ] **Step 1: Update matchSettleSchema to allow nullable winnerId**

At line 40, change:
```typescript
winnerId: z.number().int().positive(),
```
to:
```typescript
winnerId: z.number().int().positive().nullable(),
```

- [ ] **Step 2: Add camelCase mapping to GET escrow endpoint**

At lines 135-153, the GET handler returns `rows[0]` raw. Replace `res.status(200).json(rows[0])` with a mapped response:

```typescript
const row = rows[0];
res.status(200).json({
  id: row.id,
  token: row.token,
  playerIds: row.player_ids,
  escrowedXp: row.escrowed_xp,
  matchConfig: row.match_config,
  status: row.status,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  settledAt: row.settled_at,
});
```

- [ ] **Step 3: Add scaled Respect by npcCount**

In the settle handler (after line 191), replace the flat respect calculation:

```typescript
// Before:
// const flatRespect = 50;

// After:
const matchConfig = escrow.match_config as Record<string, unknown> | null;
const npcCount = matchConfig?.npcCount as number | undefined;
const respectMap: Record<number, number> = { 1: 25, 2: 50, 3: 100 };
const respectAmount = npcCount !== undefined ? (respectMap[npcCount] ?? 50) : 50;
```

Update the variable usage below from `flatRespect` to `respectAmount`.

- [ ] **Step 4: Add forfeit path for winnerId: null**

Before the "Calculate total escrowed XP" block (line 188), add:

```typescript
if (winnerId === null) {
  // Forfeit: mark escrow settled, award nothing
  await db
    .update(matchEscrow)
    .set({ status: 'settled', settled_at: new Date() })
    .where(eq(matchEscrow.token, token));

  res.status(200).json({
    settled: true,
    winnerId: null,
    xpAwarded: 0,
    respectAwarded: 0,
    forfeited: true,
  });
  return;
}
```

- [ ] **Step 5: Verify auth builds**

```bash
cd /home/patrick/projects/auth && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /home/patrick/projects && git add auth/src/routes/internal.ts
git commit -m "fix(auth): camelCase escrow GET, nullable winnerId, scaled Respect, forfeit path"
```

---

## Task 2: Arena — Fix Escrow Field Names + winnerId Type

**Files:**
- Modify: `arena/backend/src/services/SocketService.ts:393,400,459`
- Modify: `arena/backend/src/services/GameService.ts:1448`

- [ ] **Step 1: Fix escrow type cast in SocketService**

At line 393, the escrow response type uses camelCase (now correct after Task 1). But fix the `playerIds.includes` check at line 400 to compare numbers:

```typescript
// Line 400 — currently: if (!escrow.playerIds.includes(playerId))
// playerId is a string, playerIds are numbers
if (!escrow.playerIds.map(String).includes(playerId))
```

- [ ] **Step 2: Fix winnerId type in GameService settle call**

At line 1448, change:
```typescript
body: JSON.stringify({ token: game.escrowToken, winnerId }),
```
to:
```typescript
body: JSON.stringify({ token: game.escrowToken, winnerId: winnerId ? parseInt(winnerId) : null }),
```

- [ ] **Step 3: Verify Arena builds**

```bash
cd /home/patrick/projects/arena && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
cd /home/patrick/projects && git add arena/backend/src/services/SocketService.ts arena/backend/src/services/GameService.ts
git commit -m "fix(arena): fix escrow playerIds comparison + winnerId parseInt in settle call"
```

---

## Task 3: Arena — Solo Auto-Start + NPC Config from Escrow

**Files:**
- Modify: `arena/backend/src/services/SocketService.ts:409-535`

- [ ] **Step 1: Read solo config from escrow after fetch**

After line 393 (escrow type cast), add:
```typescript
const isSolo = escrow.matchConfig?.solo === true;
const escrowNpcCount = (escrow.matchConfig?.npcCount as number) || 2;
```

- [ ] **Step 2: Configure NPCs for solo lobby creation**

At line 462, change `npcEnemies: 0` to:
```typescript
npcEnemies: isSolo ? escrowNpcCount as 0 | 1 | 2 | 3 : 0,
```

- [ ] **Step 3: Set maxPlayers = 2 for solo matches**

At line 459, change:
```typescript
maxPlayers: escrow.playerIds.length as 2 | 3 | 4,
```
to:
```typescript
maxPlayers: (isSolo ? 2 : escrow.playerIds.length) as 2 | 3 | 4,
```

- [ ] **Step 4: Auto-start solo match immediately**

At lines 498-501, the current logic waits for all expected players. Add a solo bypass:

```typescript
// After line 501: const allJoined = ...
const shouldStart = isSolo || allJoined;

if (shouldStart) {
```

Replace the existing `if (allJoined) {` with this.

- [ ] **Step 5: Verify Arena builds**

```bash
cd /home/patrick/projects/arena && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /home/patrick/projects && git add arena/backend/src/services/SocketService.ts
git commit -m "feat(arena): auto-start solo private matches with NPC config from escrow"
```

---

## Task 4: Arena — Forfeit on NPC Win + Disconnect

**Files:**
- Modify: `arena/backend/src/services/GameService.ts:1444-1465`

- [ ] **Step 1: Detect NPC win and send null winnerId**

Replace the escrow settlement block (lines 1444-1465):

```typescript
// Settle escrow if this was a private deathmatch
if (game.escrowToken) {
    try {
        // winnerId is '' when all humans die (NPCs win)
        const isHumanWinner = winnerId !== '' && game.players.has(winnerId);
        const settleWinnerId = isHumanWinner ? parseInt(winnerId) : null;

        const settleRes = await authFetchInternal('/api/internal/match/settle', {
            method: 'POST',
            body: JSON.stringify({ token: game.escrowToken, winnerId: settleWinnerId }),
        });
        if (settleRes.ok) {
            const settlement = await settleRes.json();
            const loserIds = Array.from(game.players.keys()).filter(id => id !== winnerId);
            this.onDeathmatchSettled?.(game.matchId, {
                winnerId: isHumanWinner ? winnerId : null,
                xpAwarded: settlement.xpAwarded ?? 0,
                respectAwarded: settlement.respectAwarded ?? 0,
                losers: loserIds,
                forfeited: settlement.forfeited ?? false,
            });
        } else {
            console.error(`[Escrow] Settlement failed for token ${game.escrowToken}: ${settleRes.status}`);
        }
    } catch (err) {
        console.error('[Escrow] Settlement error:', err);
    }
}
```

- [ ] **Step 2: Add forfeitMatch method**

Add a new public method to GameService:

```typescript
/**
 * Forfeit a match (e.g., solo player disconnected). Settles escrow with no winner.
 */
async forfeitMatch(matchId: string): Promise<void> {
    const game = this.games.get(matchId);
    if (!game || !game.escrowToken) return;

    try {
        await authFetchInternal('/api/internal/match/settle', {
            method: 'POST',
            body: JSON.stringify({ token: game.escrowToken, winnerId: null }),
        });
        console.log(`[Escrow] Match ${matchId} forfeited`);
    } catch (err) {
        console.error('[Escrow] Forfeit error:', err);
    }

    // Clean up game state
    const interval = this.gameIntervals.get(matchId);
    if (interval) {
        clearInterval(interval);
        this.gameIntervals.delete(matchId);
    }
    this.games.delete(matchId);
}
```

- [ ] **Step 3: Call forfeitMatch on solo disconnect**

In `SocketService.ts`, find the disconnect handler (~line 551-578). Add after the existing lobby leave logic:

```typescript
// If player was in an active match, check for solo forfeit
if (playerInfo?.matchId) {
    const game = this.gameService.getGameState(playerInfo.matchId);
    if (game?.escrowToken) {
        // Check if any human players remain
        const remainingHumans = Array.from(game.players.values())
            .filter(p => this.playerToSocket.has(p.id));
        if (remainingHumans.length === 0) {
            await this.gameService.forfeitMatch(playerInfo.matchId);
        }
    }
}
```

- [ ] **Step 4: Verify Arena builds**

```bash
cd /home/patrick/projects/arena && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
cd /home/patrick/projects && git add arena/backend/src/services/GameService.ts arena/backend/src/services/SocketService.ts
git commit -m "feat(arena): forfeit on NPC win + disconnect for solo escrow matches"
```

---

## Task 5: L2P Backend — Solo Deathmatch Offer + NPC Count

**Files:**
- Modify: `l2p/backend/src/services/GameService.ts:1714-1845`
- Modify: `l2p/backend/src/services/SocketService.ts:257-263,868-881`

- [ ] **Step 1: Add npcCount to deathmatch challenge state**

Find the `deathmatchChallenges` Map type definition (around line 129). The challenge object has `{ earnedXp, acceptedPlayerIds, declinedPlayerIds, allPlayerIds, timer }`. Add `npcCount` and `solo`:

```typescript
this.deathmatchChallenges.set(lobbyCode, {
    earnedXp,
    acceptedPlayerIds: new Set(),
    declinedPlayerIds: new Set(),
    allPlayerIds,
    timer,
    solo: allPlayerIds.length === 1,  // NEW
    npcCount: undefined as number | undefined,  // NEW: set on accept
});
```

- [ ] **Step 2: Update startDeathmatchOffer to emit solo flag**

At line 1727, update the emit:

```typescript
this.getIo()?.to(lobbyCode)?.emit('deathmatch-offer', {
    earnedXp,
    timeoutSeconds: DEATHMATCH_TIMEOUT_SECONDS,
    solo: allPlayerIds.length === 1,  // NEW
});
```

- [ ] **Step 3: Remove 2-player minimum for deathmatch trigger**

Find where `startDeathmatchOffer` is called (search for the `≥2 players` condition, around line 1699). Change the condition to allow 1+ players. The condition likely checks `allPlayerIds.length >= 2` — change to `allPlayerIds.length >= 1`.

- [ ] **Step 4: Update handleDeathmatchAccept to receive npcCount**

Change the method signature at line 1738:
```typescript
async handleDeathmatchAccept(lobbyCode: string, playerId: string, npcCount?: 1 | 2 | 3): Promise<void> {
```

After line 1745 (`challenge.acceptedPlayerIds.add(playerId)`), store npcCount:
```typescript
if (npcCount && [1, 2, 3].includes(npcCount)) {
    challenge.npcCount = npcCount;
}
```

- [ ] **Step 5: Bypass DEATHMATCH_MIN_PLAYERS for solo in handleDeathmatchAccept**

At line 1759, the early-resolve condition is:
```typescript
if (pendingPlayers.length === 0 && challenge.acceptedPlayerIds.size >= DEATHMATCH_MIN_PLAYERS) {
```
Change to:
```typescript
if (pendingPlayers.length === 0 && (challenge.solo || challenge.acceptedPlayerIds.size >= DEATHMATCH_MIN_PLAYERS)) {
```

- [ ] **Step 6: Bypass DEATHMATCH_MIN_PLAYERS for solo in resolveDeathmatchChallenge**

At line 1796, change:
```typescript
if (acceptedIds.length < DEATHMATCH_MIN_PLAYERS) {
```
to:
```typescript
const challenge_ref = this.deathmatchChallenges.get(lobbyCode) || challenge;
if (!challenge.solo && acceptedIds.length < DEATHMATCH_MIN_PLAYERS) {
```

Note: `challenge` was already retrieved at line 1790 before the delete at 1792. We need the solo flag — save it before delete or read it before the check. The challenge object is available since it was `const challenge = this.deathmatchChallenges.get(lobbyCode)` at line 1790. Move the `solo` flag read before the delete:

```typescript
const challenge = this.deathmatchChallenges.get(lobbyCode);
if (!challenge) return;
const isSolo = challenge.solo;
const challengeNpcCount = challenge.npcCount;
this.deathmatchChallenges.delete(lobbyCode);
// ... later:
if (!isSolo && acceptedIds.length < DEATHMATCH_MIN_PLAYERS) {
```

- [ ] **Step 7: Pass npcCount + solo in escrow matchConfig**

At line 1816, update the matchConfig:
```typescript
matchConfig: {
    source: 'l2p',
    lobbyCode,
    solo: isSolo,                    // NEW
    npcCount: challengeNpcCount,     // NEW
}
```

- [ ] **Step 8: Defer XP award in ScoringService when deathmatch accepted**

In `l2p/backend/src/services/ScoringService.ts`, find `savePlayerResult()` (around line 248) where it calls `CharacterService.awardExperience()`. The method already has a `skipExperienceAward` flag. The GameService needs to set this flag when a deathmatch is accepted.

In `GameService.ts`, after `resolveDeathmatchChallenge` successfully creates the escrow, set a flag on the game session or emit an event that tells ScoringService to skip XP award for the accepted players. The simplest approach:

- Add a `deathmatchAccepted: Set<string>` to the GameService instance (track which lobby's players accepted)
- In `resolveDeathmatchChallenge`, after successful escrow creation, add all accepted player IDs to this set
- Expose a method `isDeathmatchAccepted(playerId: string): boolean`
- In ScoringService, check this before awarding XP:

```typescript
// In ScoringService.savePlayerResult, before awardExperience call:
const skipXp = this.gameService?.isDeathmatchAccepted?.(userId.toString()) ?? false;
if (!skipXp) {
    await this.characterService.awardExperience(userId, finalScore, true);
}
```

Note: XP for deathmatch-accepted players is held in the escrow and awarded by auth on settlement.

- [ ] **Step 9: Update SocketService to pass npcCount**

In `SocketService.ts` line 257, update the data type:
```typescript
socket.on('deathmatch-accept', (data: { lobbyCode: string; npcCount?: number }) => {
```

In `handleDeathmatchAccept` at line 876, pass npcCount:
```typescript
await this.gameService.handleDeathmatchAccept(lobbyCode, userId, data.npcCount as 1 | 2 | 3 | undefined);
```

- [ ] **Step 10: Verify L2P backend builds**

```bash
cd /home/patrick/projects/l2p/backend && npx tsc --noEmit
```

- [ ] **Step 11: Commit**

```bash
cd /home/patrick/projects && git add l2p/backend/src/services/GameService.ts l2p/backend/src/services/SocketService.ts l2p/backend/src/services/ScoringService.ts
git commit -m "feat(l2p): solo deathmatch offer with NPC count, bypass min-player gates, defer XP"
```

---

## Task 6: L2P Frontend — Solo NPC Picker UI

**Files:**
- Modify: `l2p/frontend/src/pages/ResultsPage.tsx:189-252`

- [ ] **Step 1: Update deathmatch-offer handler to capture solo flag**

The `onOffer` handler at line 200 receives `data`. The `DeathmatchOfferData` type needs `solo?: boolean`. Check where this type is defined (likely in a types file or DeathmatchModal.tsx) and add `solo?: boolean`.

- [ ] **Step 2: Update handleDeathmatchAccept to send npcCount**

At line 239, the current handler emits:
```typescript
socketService.emit('deathmatch-accept', { lobbyCode })
```

Change to accept npcCount parameter:
```typescript
const handleDeathmatchAccept = useCallback((npcCount?: number) => {
    if (!lobbyCode) return
    socketService.emit('deathmatch-accept', { lobbyCode, npcCount })
}, [lobbyCode])
```

- [ ] **Step 3: Add NPC picker UI for solo offers**

Find where the DeathmatchModal is rendered (search for `deathmatchOffer &&` or `<DeathmatchModal`). When `deathmatchOffer.solo` is true, replace the standard Accept button with NPC picker buttons:

```tsx
{deathmatchOffer.solo ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ color: '#ccc', marginBottom: '8px' }}>
            Gambit {Object.values(deathmatchOffer.earnedXp)[0]} XP in Arena vs NPCs?
        </p>
        {[
            { count: 1, respect: 25 },
            { count: 2, respect: 50 },
            { count: 3, respect: 100 },
        ].map(({ count, respect }) => (
            <button
                key={count}
                onClick={() => handleDeathmatchAccept(count)}
                style={{ padding: '10px 16px', background: '#1a3a1a', border: '1px solid #3eff8b', borderRadius: '8px', color: '#3eff8b', cursor: 'pointer', fontSize: '0.9rem' }}
            >
                {count} NPC{count > 1 ? 's' : ''} — {respect} ⭐ Respect
            </button>
        ))}
        <button onClick={handleDeathmatchDecline} style={{ padding: '8px 16px', background: '#333', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer' }}>
            Decline — Keep XP
        </button>
    </div>
) : (
    /* existing multiplayer Accept/Decline UI */
)}
```

Note: The exact JSX depends on whether a DeathmatchModal component is used or if the UI is inline. Read the file to determine the pattern and follow it.

- [ ] **Step 4: Commit**

```bash
cd /home/patrick/projects && git add l2p/frontend/src/pages/ResultsPage.tsx
git commit -m "feat(l2p): add NPC picker UI for solo deathmatch offers in ResultsPage"
```

---

## Task 7: Build Verification + Deploy

- [ ] **Step 1: Typecheck all services**

```bash
cd /home/patrick/projects/auth && npx tsc --noEmit
cd /home/patrick/projects/l2p/backend && npx tsc --noEmit
cd /home/patrick/projects/arena && npm run typecheck
```

- [ ] **Step 2: Deploy**

```bash
./k8s/scripts/deploy/deploy-auth.sh
./k8s/scripts/deploy/deploy-arena.sh
./k8s/scripts/deploy/deploy-l2p.sh --manifests-only
```

- [ ] **Step 3: Verify deployment**

```bash
./k8s/scripts/utils/deploy-tracker.sh status
```

- [ ] **Step 4: Test escrow with solo config**

```bash
# Create solo escrow
curl -s -X POST https://auth.korczewski.de/api/internal/match/escrow \
  -H 'Content-Type: application/json' \
  -d '{"playerIds":[3],"escrowedXp":{"3":200},"matchConfig":{"source":"l2p","lobbyCode":"SOLO01","solo":true,"npcCount":2}}'

# Verify camelCase response on GET
# Test settlement with winnerId: null (forfeit)
# Test settlement with winnerId: 3 (win)
```
