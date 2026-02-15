# Live Player Score Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show all players' scores live throughout each round with visual flash feedback when others answer, and fix the bug where plates vanish after picking an answer.

**Architecture:** Remove the `.slice(0, 2)` cap in GamePage so all opponents are visible. Add a defensive guard in socketService's `question-started` handler to prevent replacing the players array with empty data. Adjust CSS for the right pane to handle a variable number of player plates via `overflow-y: auto`.

**Tech Stack:** React 18, Zustand, Socket.io, CSS Modules

**Design doc:** `docs/plans/2026-02-15-live-player-scores-design.md`

---

### Task 1: Show all players in desktop right pane

**Files:**
- Modify: `l2p/frontend/src/pages/GamePage.tsx:343-345`

**Step 1: Remove `.slice(0, 2)` and update maxPlayers**

At line 345, the `sortedPlayersForPlates` is capped to 2 players. Remove the `.slice(0, 2)` call. Then at lines 607-609, change `maxPlayers={2}` to use the actual player count.

```tsx
// Line 345 — change FROM:
const sortedPlayersForPlates = playersForPlates.sort((a, b) => b.score - a.score).slice(0, 2)

// TO:
const sortedPlayersForPlates = [...playersForPlates].sort((a, b) => b.score - a.score)
```

Note: Use spread (`[...playersForPlates]`) to avoid mutating the derived array — `.sort()` mutates in-place.

Then at line 606-612, change the desktop PlayerGrid props:

```tsx
// FROM:
<PlayerGrid
  players={sortedPlayersForPlates}
  rankings={rankings}
  maxPlayers={2}
  showScores={true}
  showMultipliers={true}
/>

// TO:
<PlayerGrid
  players={sortedPlayersForPlates}
  rankings={rankings}
  maxPlayers={sortedPlayersForPlates.length}
  showScores={true}
  showMultipliers={true}
/>
```

**Step 2: Update mobile stats bar PlayerGrid**

At lines 416-421, apply the same changes to the mobile compact PlayerGrid:

```tsx
// FROM:
<PlayerGrid
  players={sortedPlayersForPlates}
  rankings={rankings}
  maxPlayers={2}
  compact
/>

// TO:
<PlayerGrid
  players={sortedPlayersForPlates}
  rankings={rankings}
  maxPlayers={sortedPlayersForPlates.length}
  compact
/>
```

**Step 3: Verify manually**

Start the dev frontend (`cd l2p && npm run dev:frontend`) and open a game with 2+ players. Confirm all opponent plates are visible in the right pane on desktop.

**Step 4: Commit**

```bash
git add l2p/frontend/src/pages/GamePage.tsx
git commit -m "feat(l2p): show all players in game score panel instead of top 2"
```

---

### Task 2: Add defensive guard for players array in socketService

**Files:**
- Modify: `l2p/frontend/src/services/socketService.ts:430-434`

**Step 1: Guard against empty players replacement**

At lines 431-434, the `question-started` handler replaces the entire players array if the backend sends one. Add a guard to prevent replacing with empty data:

```typescript
// FROM:
// Update players with current scores from server
if (data.players && Array.isArray(data.players)) {
  console.log('Updating players with server data:', data.players)
  setPlayers(data.players)
}

// TO:
// Update players with current scores from server (guard against empty replacement)
if (data.players && Array.isArray(data.players) && data.players.length > 0) {
  console.log('Updating players with server data:', data.players)
  setPlayers(data.players)
}
```

**Step 2: Commit**

```bash
git add l2p/frontend/src/services/socketService.ts
git commit -m "fix(l2p): guard against empty players array replacement in question-started"
```

---

### Task 3: Adjust right pane CSS for variable player count

**Files:**
- Modify: `l2p/frontend/src/styles/GamePage.module.css:149-153, 459-462`

**Step 1: Make right pane scrollable for many players**

The right pane needs to handle more than 2 player plates without overflowing the viewport. Add `overflow-y: auto` and constrain its height:

```css
/* Line 149-153 — change FROM: */
.rightPane {
  grid-area: right;
  display: flex;
  flex-direction: column;
}

/* TO: */
.rightPane {
  grid-area: right;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  max-height: calc(100dvh - 80px);
}
```

Also update `.playersCard` (lines 459-462) to allow the card to grow:

```css
/* FROM: */
.playersCard {
  /* Remove flex: 1 and overflow-y to allow content-based sizing */
  min-height: 0;
}

/* TO: */
.playersCard {
  min-height: 0;
  flex: 1;
}
```

**Step 2: Commit**

```bash
git add l2p/frontend/src/styles/GamePage.module.css
git commit -m "fix(l2p): make right pane scrollable for variable player count"
```

---

### Task 4: Manual verification and final commit

**Step 1: Test with multiple players**

Start the full dev stack (`cd l2p && npm run dev:frontend` + `npm run dev:backend`). Open multiple browser tabs logged in as different users. Create a lobby, join with 3+ players, start a game, and verify:

1. All opponent plates are visible in the right pane throughout the game
2. Plates do NOT vanish after picking an answer
3. When another player answers, their plate flashes green (correct) or red (wrong) via the existing glow animation
4. Score numbers update live on plates when others answer
5. Score bump animation plays when a player's score increases
6. On mobile (resize to <768px), the compact stats bar shows all players

**Step 2: If plates still disappear, check browser console**

Look for errors or unexpected state changes in the console. The `console.log` statements in `question-started` and `answer-received` handlers will show what data is being received. If the issue persists, add a temporary `console.log` before the `sortedPlayersForPlates` derivation in `GamePage.tsx` to trace the players array state.

**Step 3: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(l2p): resolve remaining player plate visibility issues"
```
