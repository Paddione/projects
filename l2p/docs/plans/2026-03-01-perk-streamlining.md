# Perk System Streamlining — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all 40 gameplay perks and relevant cosmetic perks fully functional end-to-end, cut audio perk progression in favor of one default sound pack, and clean up dead draft-system artifacts.

**Architecture:** The perk pipeline flows DB → PerkDraftService (level-based query) → PerkEffectEngine.buildModifiers() → GameplayModifiers object → ScoringService/GameService consumption. Most TIME/SCORING/RECOVERY/XP perks already work. The gaps are: (1) perfectionist bonus never applied, (2) INFO perk modifiers computed but never forwarded to the client, (3) cosmetic perk name mismatches in GamePage, (4) badge slot has no frontend rendering, (5) audio perks should be cut in favor of one default sound system, (6) dead draft-system artifacts linger.

**Tech Stack:** TypeScript, Express, Socket.io, React 18, Zustand, PostgreSQL, Vitest/Jest, CSS Modules

---

## Corrected Perk Status (Pre-Work)

| Category | Count | Status |
|----------|-------|--------|
| TIME | 8 | Working — ScoringService applies bonus_seconds, timer_speed, speed_threshold |
| SCORING (7) | 7 | Working — base_score_multiplier, speed_bonus_multiplier, streak, closer |
| SCORING: perfectionist | 1 | **BROKEN** — perfectGameBonus=500 computed in PerkEffectEngine but never applied |
| RECOVERY | 8 | Working — free_wrong_answers, partial_credit, bounce_back, phoenix all tracked |
| XP | 8 | Working — GameService.savePlayerResults() calls PerkEffectEngine.calculateModifiedXP() at line 1474 |
| INFO | 8 | **BROKEN** — modifiers (showCategory, showDifficulty, showHint, eliminateWrong, showAnswerStats) computed but never forwarded to client |
| Avatar | 3 | Working |
| Theme | 2 | Working |
| Title | 3 | Working |
| Badge | 3 | **PARTIAL** — active_badge stored in DB but no frontend rendering |
| Helper | 2 | **PARTIAL** — answer_previews CSS wired; smart_hints not wired |
| Display | 3 | **BROKEN** — GamePage checks `timer_styles` but DB perk name is `enhanced_timers` |
| Emote | 2 | **BROKEN** — GamePage checks `celebration_effects` but DB perk names are `chat_emotes_basic`/`chat_emotes_premium` |
| Audio | 3 | **CUT** — removing perk progression; one default sound pack instead |
| Booster | 3 | Working — streak_protector and time_extension feed PerkEffectEngine; experience_boost XP mod works |

---

## Task 1: Fix Perfectionist Perk

**Files:**
- Modify: `backend/src/services/GameService.ts` (~line 1444, `savePlayerResults` method)
- Test: `backend/src/services/__tests__/PerkEffectEngine.test.ts` (new test)

The `perfectionist` perk sets `GameplayModifiers.perfectGameBonus = 500` but no code ever reads it. The bonus should be added to `player.score` before XP calculation when the player has a perfect game.

**Step 1: Write the failing test**

Create a test in `backend/src/services/__tests__/PerkEffectEngine.test.ts` (or add to existing) that verifies: when a player has `perfectGameBonus > 0` and `correctAnswers === totalQuestions`, the bonus is added to their score.

```typescript
describe('perfectionist perk', () => {
  it('should add perfectGameBonus to score for perfect games', () => {
    const modifiers = PerkEffectEngine.getDefaultModifiers();
    modifiers.perfectGameBonus = 500;

    const result = PerkEffectEngine.applyEndGameBonuses(1000, modifiers, {
      correctAnswers: 10,
      totalQuestions: 10,
    });

    expect(result).toBe(1500);
  });

  it('should NOT add perfectGameBonus for imperfect games', () => {
    const modifiers = PerkEffectEngine.getDefaultModifiers();
    modifiers.perfectGameBonus = 500;

    const result = PerkEffectEngine.applyEndGameBonuses(1000, modifiers, {
      correctAnswers: 9,
      totalQuestions: 10,
    });

    expect(result).toBe(1000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && NODE_OPTIONS=--experimental-vm-modules npx jest src/services/__tests__/PerkEffectEngine.test.ts -v
```

Expected: FAIL — `applyEndGameBonuses` doesn't exist yet.

**Step 3: Implement `applyEndGameBonuses` in PerkEffectEngine**

Add to `backend/src/services/PerkEffectEngine.ts`:

```typescript
/**
 * Apply end-of-game bonuses (perfectionist perk, etc.)
 * Returns the adjusted score with bonuses added.
 */
static applyEndGameBonuses(
  baseScore: number,
  modifiers: GameplayModifiers,
  context: { correctAnswers: number; totalQuestions: number }
): number {
  let score = baseScore;

  // Perfectionist: bonus for perfect game (all correct)
  if (modifiers.perfectGameBonus > 0 && context.correctAnswers === context.totalQuestions) {
    score += modifiers.perfectGameBonus;
  }

  return score;
}
```

**Step 4: Wire it into GameService.savePlayerResults()**

In `backend/src/services/GameService.ts`, inside `savePlayerResults()`, BEFORE the XP calculation (~line 1470), add:

```typescript
// Apply end-game score bonuses (perfectionist perk)
if (player.perkModifiers) {
  player.score = PerkEffectEngine.applyEndGameBonuses(player.score, player.perkModifiers, {
    correctAnswers: player.correctAnswers,
    totalQuestions: gameState.totalQuestions,
  });
}
```

This must come BEFORE the `modifiedXP = ... player.score` line so the bonus score also feeds into XP.

**Step 5: Run tests**

```bash
cd backend && NODE_OPTIONS=--experimental-vm-modules npx jest src/services/__tests__/PerkEffectEngine.test.ts -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/services/PerkEffectEngine.ts backend/src/services/GameService.ts backend/src/services/__tests__/PerkEffectEngine.test.ts
git commit -m "fix(perks): apply perfectionist bonus for perfect games"
```

---

## Task 2: Fix Cosmetic Perk Name Mismatches in GamePage

**Files:**
- Modify: `frontend/src/pages/GamePage.tsx` (lines 392-417)

The GamePage checks for perk names that don't exist in the database. The CSS classes are fine — only the JS perk name strings are wrong.

**Name mapping (GamePage check → actual DB perk name):**
- Line 393: `'timer_styles'` → `'enhanced_timers'`
- Line 400: `'celebration_effects'` → `'chat_emotes_basic'` OR `'chat_emotes_premium'`
- Lines 407/412: `'score_multiplier_visual'` / `'streak_counter_style'` → these are visual decorations for the booster slot perks (`experience_boost`, `streak_protector`, `time_extension`). Since boosters are gameplay perks, not visual, **remove the multiplier visual effect block** (lines 406-417). Booster perks should have gameplay effects only, not visual CSS. These CSS classes can remain in the stylesheet as dead CSS for now.

**Step 1: Fix display slot name**

In `frontend/src/pages/GamePage.tsx`, change line 393:

```typescript
// Before:
if (effects.display?.perk_name === 'timer_styles') {
// After:
if (effects.display?.perk_name === 'enhanced_timers') {
```

**Step 2: Fix emote slot name**

Change line 400:

```typescript
// Before:
if (effects.emote?.perk_name === 'celebration_effects') {
// After:
if (effects.emote?.perk_name === 'chat_emotes_basic' || effects.emote?.perk_name === 'chat_emotes_premium') {
```

**Step 3: Remove multiplier visual block**

Remove lines 406-417 (the `score_multiplier_visual` and `streak_counter_style` checks). These attempted to apply visual CSS to gameplay booster perks, which is a design confusion.

**Step 4: Run typecheck**

```bash
cd /home/patrick/projects/l2p && npm run typecheck
```

Expected: PASS (no type errors — we're only changing string literals and removing code)

**Step 5: Commit**

```bash
git add frontend/src/pages/GamePage.tsx
git commit -m "fix(perks): correct cosmetic perk name checks in GamePage"
```

---

## Task 3: INFO Perks — Passive Display (Category, Difficulty, Answer Stats)

**Files:**
- Modify: `backend/src/services/GameService.ts` (question-started emission, ~line 303)
- Modify: `frontend/src/services/socketService.ts` (question-started handler, ~line 312)
- Modify: `frontend/src/stores/gameStore.ts` (add perkEffects state)
- Modify: `frontend/src/pages/GamePage.tsx` (render category/difficulty badges, answer stats)
- Modify: `frontend/src/styles/GamePage.module.css` (styles for info perk UI elements)
- Test: `backend/src/services/__tests__/PerkEffectEngine.test.ts`

### Architecture Decision: Per-Player Perk Data Delivery

The `question-started` event is broadcast to all players in a lobby room. INFO perks are per-player (player A might see category, player B might not). Two approaches:

**Option chosen: Include `playerPerkEffects` map in the broadcast payload.** Each player's client reads their own effects by player ID. In a quiz game, knowing another player can see the category gives no advantage. This avoids the complexity of per-socket emission.

```typescript
// question-started payload addition
playerPerkEffects: {
  [playerId: string]: {
    showCategory?: boolean;
    showDifficulty?: boolean;
    showAnswerStats?: boolean;
  }
}
```

### Step 1: Write backend test for perk effect extraction

```typescript
describe('INFO perk effects in question payload', () => {
  it('should extract passive info perk flags from modifiers', () => {
    const modifiers = PerkEffectEngine.getDefaultModifiers();
    modifiers.showCategory = true;
    modifiers.showDifficulty = true;
    modifiers.showAnswerStats = true;

    const effects = PerkEffectEngine.extractInfoEffects(modifiers);

    expect(effects).toEqual({
      showCategory: true,
      showDifficulty: true,
      showAnswerStats: true,
    });
  });

  it('should return empty object when no info perks active', () => {
    const modifiers = PerkEffectEngine.getDefaultModifiers();
    const effects = PerkEffectEngine.extractInfoEffects(modifiers);
    expect(effects).toEqual({});
  });
});
```

### Step 2: Run test to verify it fails

```bash
cd backend && NODE_OPTIONS=--experimental-vm-modules npx jest src/services/__tests__/PerkEffectEngine.test.ts -v
```

### Step 3: Implement `extractInfoEffects` in PerkEffectEngine

```typescript
/**
 * Extract passive INFO perk flags for client-side rendering.
 * Only includes truthy values to keep payload minimal.
 */
static extractInfoEffects(modifiers: GameplayModifiers): Record<string, boolean> {
  const effects: Record<string, boolean> = {};
  if (modifiers.showCategory) effects.showCategory = true;
  if (modifiers.showDifficulty) effects.showDifficulty = true;
  if (modifiers.showAnswerStats) effects.showAnswerStats = true;
  return effects;
}
```

### Step 4: Run test to verify pass

### Step 5: Add `playerPerkEffects` to question-started emission

In `GameService.ts`, where `question-started` is emitted (~line 303), build the perk effects map and include it:

```typescript
// Build per-player INFO perk effects
const playerPerkEffects: Record<string, Record<string, boolean>> = {};
for (const player of gameState.players) {
  if (player.perkModifiers) {
    const effects = PerkEffectEngine.extractInfoEffects(player.perkModifiers);
    if (Object.keys(effects).length > 0) {
      playerPerkEffects[player.id] = effects;
    }
  }
}

this.getIo()?.to(lobbyCode)?.emit('question-started', {
  question: currentQuestion,
  questionIndex: gameState.currentQuestionIndex,
  totalQuestions: gameState.totalQuestions,
  timeRemaining: gameState.timeRemaining,
  gameMode: gameState.gameMode,
  ...(Object.keys(playerPerkEffects).length > 0 && { playerPerkEffects }),
});
```

Also update the secondary emission site (wager mode, ~line 1336) and the duel-question-started emission if applicable.

### Step 6: Frontend — Store perk effects in gameStore

Add to `gameStore.ts`:

```typescript
// In state
myPerkEffects: Record<string, boolean> | null;

// Action
setMyPerkEffects: (effects: Record<string, boolean> | null) => void;
```

### Step 7: Frontend — Extract perk effects in socketService question-started handler

In the `question-started` handler (~line 312 of socketService.ts), after processing the question:

```typescript
// Extract this player's INFO perk effects
const { setMyPerkEffects } = useGameStore.getState();
const myPlayerId = useAuthStore.getState().user?.id?.toString();
if (data.playerPerkEffects && myPlayerId && data.playerPerkEffects[myPlayerId]) {
  setMyPerkEffects(data.playerPerkEffects[myPlayerId]);
} else {
  setMyPerkEffects(null);
}
```

### Step 8: Frontend — Render category and difficulty badges on GamePage

In `GamePage.tsx`, add a small info bar above or near the question text:

```tsx
{/* INFO perk indicators */}
{myPerkEffects?.showCategory && currentQuestion && (
  <span className={gameStyles.perkInfoBadge}>
    {/* question.category comes from the question DB record */}
    {(currentQuestion as any).category || 'Allgemein'}
  </span>
)}
{myPerkEffects?.showDifficulty && currentQuestion && (
  <span className={gameStyles.perkInfoBadge}>
    {'★'.repeat((currentQuestion as any).difficulty || 1)}
  </span>
)}
```

**Note:** The `question` object in `question-started` is the raw DB question record. Check if `category` and `difficulty` fields are included. If not, add them to the question payload in GameService where the question is fetched.

### Step 9: Render answer stats after answering

Answer stats show "X% picked A, Y% picked B..." after the player answers. This requires:
1. Backend: After all players answer (or timer expires), compute answer distribution
2. Backend: Emit an `answer-stats` event with the distribution to players who have `showAnswerStats`
3. Frontend: Display the distribution on each answer button

This can be deferred to a follow-up task if the distribution requires tracking all player answers first (which `GameService._submitAnswerInner` already does in `player.currentAnswer`).

### Step 10: Add CSS for perk info badges

```css
/* In GamePage.module.css */
.perkInfoBadge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  font-size: 0.75rem;
  border-radius: 4px;
  background: rgba(0, 242, 255, 0.1);
  border: 1px solid rgba(0, 242, 255, 0.3);
  color: var(--cv-cyan);
  margin-right: 0.5rem;
}
```

### Step 11: Run typecheck + visual verification

```bash
cd /home/patrick/projects/l2p && npm run typecheck
```

### Step 12: Commit

```bash
git add backend/src/services/PerkEffectEngine.ts backend/src/services/GameService.ts \
  frontend/src/services/socketService.ts frontend/src/stores/gameStore.ts \
  frontend/src/pages/GamePage.tsx frontend/src/styles/GamePage.module.css \
  backend/src/services/__tests__/PerkEffectEngine.test.ts
git commit -m "feat(perks): forward INFO perk effects to client (category, difficulty, answer stats)"
```

---

## Task 4: INFO Perks — Hint System

**Files:**
- Modify: `backend/src/services/GameService.ts` (add perk:use-hint handler registration, hint logic)
- Modify: `backend/src/services/SocketService.ts` (add perk:use-hint event handler)
- Modify: `frontend/src/services/socketService.ts` (emit perk:use-hint, handle response)
- Modify: `frontend/src/pages/GamePage.tsx` (hint button UI)
- Modify: `frontend/src/stores/gameStore.ts` (hint state)

The `hint_master` perk sets `showHint = true` and `hintUsesPerGame` (default 2). The question DB records already have a `hint` field. Currently hints are only shown in practice mode (hardcoded). The perk should allow hints in all modes with limited uses.

### Architecture

- Backend tracks `hintUsesRemaining` per player in a Map on GameState (or on the GamePlayer object)
- Client sends `perk:use-hint` event
- Server validates: player has hint perk, uses remaining > 0, game is active, hasn't answered yet
- Server responds with `perk:hint-revealed` containing the hint text
- Frontend shows the hint, decrements local counter

### Step 1: Add `hintUsesRemaining` to GamePlayer

In `GameService.ts`, when loading perk modifiers at game start (~line 577), if `player.perkModifiers.showHint`:

```typescript
if (player.perkModifiers.showHint) {
  player.hintUsesRemaining = player.perkModifiers.hintUsesPerGame;
}
```

Add `hintUsesRemaining?: number` to the `GamePlayer` interface.

### Step 2: Add perk:use-hint socket handler

In `SocketService.ts`, register:

```typescript
socket.on('perk:use-hint', ({ lobbyCode }) => {
  // Delegate to GameService
  this.gameService.handleUseHint(lobbyCode, playerId, socket);
});
```

### Step 3: Implement `handleUseHint` in GameService

```typescript
handleUseHint(lobbyCode: string, playerId: string, socket: Socket): void {
  const gameState = this.activeGames.get(lobbyCode);
  if (!gameState?.isActive) return;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.hintUsesRemaining || player.hintUsesRemaining <= 0) {
    socket.emit('perk:use-error', { message: 'No hint uses remaining' });
    return;
  }
  if (player.hasAnsweredCurrentQuestion) {
    socket.emit('perk:use-error', { message: 'Already answered' });
    return;
  }

  const hint = gameState.currentQuestion?.hint;
  if (!hint) {
    socket.emit('perk:use-error', { message: 'No hint available for this question' });
    return;
  }

  player.hintUsesRemaining--;
  socket.emit('perk:hint-revealed', { hint, usesRemaining: player.hintUsesRemaining });
}
```

### Step 4: Frontend — Hint button and state

Add to `gameStore.ts`:

```typescript
hintUsesRemaining: number;
currentHint: string | null;
setHintUsesRemaining: (n: number) => void;
setCurrentHint: (hint: string | null) => void;
```

In `socketService.ts`, listen for `perk:hint-revealed`:

```typescript
socket.on('perk:hint-revealed', ({ hint, usesRemaining }) => {
  const { setCurrentHint, setHintUsesRemaining } = useGameStore.getState();
  setCurrentHint(hint);
  setHintUsesRemaining(usesRemaining);
});
```

Initialize `hintUsesRemaining` from `playerPerkEffects` when game starts (include in the perk effects payload from Task 3).

In `GamePage.tsx`, render a hint button when `myPerkEffects?.showHint` and `hintUsesRemaining > 0`:

```tsx
{myPerkEffects?.showHint && hintUsesRemaining > 0 && !hasAnswered && (
  <button className={gameStyles.hintButton} onClick={handleUseHint}>
    Hinweis ({hintUsesRemaining})
  </button>
)}
{currentHint && <div className={gameStyles.hintText}>{currentHint}</div>}
```

### Step 5: Reset hint state on new question

In the `question-started` handler, reset `currentHint` to null.

### Step 6: Run typecheck

```bash
cd /home/patrick/projects/l2p && npm run typecheck
```

### Step 7: Commit

```bash
git add backend/src/services/GameService.ts backend/src/services/SocketService.ts \
  frontend/src/services/socketService.ts frontend/src/stores/gameStore.ts \
  frontend/src/pages/GamePage.tsx frontend/src/styles/GamePage.module.css
git commit -m "feat(perks): implement hint perk with limited uses per game"
```

---

## Task 5: INFO Perks — Fifty-Fifty / Answer Elimination

**Files:**
- Modify: `backend/src/services/GameService.ts`
- Modify: `backend/src/services/SocketService.ts`
- Modify: `frontend/src/services/socketService.ts`
- Modify: `frontend/src/pages/GamePage.tsx`
- Modify: `frontend/src/stores/gameStore.ts`
- Modify: `frontend/src/styles/GamePage.module.css`

Three perks use `eliminate_wrong`: `fifty_fifty` (eliminate 1, 3 uses), `double_eliminate` (eliminate 2, 2 uses), `oracle_vision` (eliminate 2, 4 uses). They stack via `eliminateWrongCount` (max) and `eliminateWrongUses` (sum).

### Architecture

Similar to hints:
- Backend tracks `eliminateUsesRemaining` per player on GamePlayer
- Client sends `perk:use-eliminate`
- Server picks N random wrong answers to hide (never eliminates the correct answer)
- Server responds with `perk:answers-eliminated` containing indices to disable
- Frontend grays out / hides eliminated answers

### Step 1: Add `eliminateUsesRemaining` to GamePlayer

At game start, when loading perk modifiers:

```typescript
if (player.perkModifiers.eliminateWrongUses > 0) {
  player.eliminateUsesRemaining = player.perkModifiers.eliminateWrongUses;
}
```

Add `eliminateUsesRemaining?: number` to GamePlayer interface.

### Step 2: Implement `handleUseEliminate` in GameService

```typescript
handleUseEliminate(lobbyCode: string, playerId: string, socket: Socket): void {
  const gameState = this.activeGames.get(lobbyCode);
  if (!gameState?.isActive) return;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.eliminateUsesRemaining || player.eliminateUsesRemaining <= 0) {
    socket.emit('perk:use-error', { message: 'No eliminate uses remaining' });
    return;
  }
  if (player.hasAnsweredCurrentQuestion) {
    socket.emit('perk:use-error', { message: 'Already answered' });
    return;
  }

  const question = gameState.currentQuestion;
  if (!question || !question.answers || !question.correctAnswer) return;

  const correctIndex = question.answers.indexOf(question.correctAnswer);
  const wrongIndices = question.answers
    .map((_, i) => i)
    .filter(i => i !== correctIndex);

  // Shuffle and pick N wrong answers to eliminate
  const count = Math.min(player.perkModifiers?.eliminateWrongCount || 1, wrongIndices.length);
  const shuffled = wrongIndices.sort(() => Math.random() - 0.5);
  const eliminatedIndices = shuffled.slice(0, count);

  player.eliminateUsesRemaining--;
  socket.emit('perk:answers-eliminated', {
    eliminatedIndices,
    usesRemaining: player.eliminateUsesRemaining,
  });
}
```

### Step 3: Frontend — Handle eliminated answers

In `gameStore.ts`:

```typescript
eliminatedAnswerIndices: number[];
eliminateUsesRemaining: number;
setEliminatedAnswerIndices: (indices: number[]) => void;
setEliminateUsesRemaining: (n: number) => void;
```

In `socketService.ts`:

```typescript
socket.on('perk:answers-eliminated', ({ eliminatedIndices, usesRemaining }) => {
  const { setEliminatedAnswerIndices, setEliminateUsesRemaining } = useGameStore.getState();
  setEliminatedAnswerIndices(eliminatedIndices);
  setEliminateUsesRemaining(usesRemaining);
});
```

In `GamePage.tsx`, render answer buttons with eliminated state:

```tsx
// On each answer button:
const isEliminated = eliminatedAnswerIndices.includes(index);
<button
  disabled={isEliminated || hasAnswered}
  className={clsx(gameStyles.answerButton, isEliminated && gameStyles.answerEliminated)}
>
  {answer}
</button>
```

Add eliminate button next to hint button:

```tsx
{eliminateUsesRemaining > 0 && !hasAnswered && (
  <button className={gameStyles.eliminateButton} onClick={handleUseEliminate}>
    50:50 ({eliminateUsesRemaining})
  </button>
)}
```

### Step 4: CSS for eliminated answers

```css
.answerEliminated {
  opacity: 0.3;
  text-decoration: line-through;
  pointer-events: none;
}
```

### Step 5: Reset eliminated state on new question

In `question-started` handler, reset `eliminatedAnswerIndices` to `[]`.

### Step 6: Include interactive perk state in question-started payload

Extend the `playerPerkEffects` from Task 3 to include interactive perk availability:

```typescript
// In PerkEffectEngine.extractInfoEffects, also include:
if (modifiers.showHint) effects.showHint = true;
if (modifiers.eliminateWrongUses > 0) effects.hasEliminate = true;
```

And in the question-started payload, include current uses remaining per player:

```typescript
playerPerkEffects[player.id] = {
  ...PerkEffectEngine.extractInfoEffects(player.perkModifiers),
  ...(player.hintUsesRemaining != null && { hintUsesRemaining: player.hintUsesRemaining }),
  ...(player.eliminateUsesRemaining != null && { eliminateUsesRemaining: player.eliminateUsesRemaining }),
};
```

### Step 7: Run typecheck + test

```bash
cd /home/patrick/projects/l2p && npm run typecheck
```

### Step 8: Commit

```bash
git add backend/src/services/GameService.ts backend/src/services/SocketService.ts \
  frontend/src/services/socketService.ts frontend/src/stores/gameStore.ts \
  frontend/src/pages/GamePage.tsx frontend/src/styles/GamePage.module.css
git commit -m "feat(perks): implement fifty-fifty answer elimination perk"
```

---

## Task 6: Badge Rendering

**Files:**
- Modify: `frontend/src/components/PerksManager.tsx` (badge display in loadout)
- Modify: `frontend/src/pages/GamePage.tsx` or a shared player display component (show badge)
- Create: `frontend/src/components/PlayerBadge.tsx` (badge renderer component)
- Modify: `frontend/src/styles/` (badge CSS)

The `active_badge` field is stored on the `users` table and updated by PerksManager. Three badge perks exist: `starter_badge` (Lv2), `scholar_badge` (Lv8), `quiz_master_badge` (Lv15).

### Step 1: Create PlayerBadge component

A simple component that renders a badge icon based on the badge name. Since we don't have custom badge image assets, use CSS-styled badges with emoji or Unicode characters:

```tsx
const BADGE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  starter_badge: { icon: '🥉', color: '#cd7f32', label: 'Starter' },
  scholar_badge: { icon: '🥈', color: '#c0c0c0', label: 'Scholar' },
  quiz_master_badge: { icon: '🥇', color: '#ffd700', label: 'Quiz Master' },
};

export function PlayerBadge({ badgeName }: { badgeName: string }) {
  const config = BADGE_CONFIG[badgeName];
  if (!config) return null;
  return <span className={styles.badge} title={config.label}>{config.icon}</span>;
}
```

### Step 2: Show badge in game lobby player list and results screen

Where player names are displayed (lobby, scoreboard, results), append `<PlayerBadge badgeName={player.active_badge} />`.

This requires `active_badge` to be included in the player data sent to clients. Check if `player.active_badge` is part of the lobby/game state payload. If not, add it alongside `player.title` in GameService at line 582.

### Step 3: Run typecheck

### Step 4: Commit

```bash
git commit -m "feat(perks): render player badges in lobby and game UI"
```

---

## Task 7: Default Sound System

**Files:**
- Create: `frontend/src/services/soundService.ts`
- Create: `frontend/public/sounds/` (sound files — generate or source)
- Modify: `frontend/src/pages/GamePage.tsx` (trigger sounds)
- Modify: `frontend/src/stores/audioStore.ts` (if exists — volume/mute controls)

**Philosophy:** One default sound pack. Subtle, non-dominating. No perk progression for audio — everyone gets the same sounds. Controllable via existing audio settings (mute/volume).

### Sound Events

| Event | Sound | Character |
|-------|-------|-----------|
| Correct answer | Short positive chime | Subtle, ~0.3s |
| Wrong answer | Soft low tone | Non-punishing, ~0.3s |
| Streak reached (3+) | Quick ascending notes | Brief, celebratory |
| Timer warning (5s left) | Soft tick | Barely noticeable |
| Game end | Short completion jingle | 1-2s max |

### Step 1: Create soundService

```typescript
// frontend/src/services/soundService.ts

class SoundService {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private volume = 0.3; // Default low volume — sounds should not dominate
  private muted = false;

  init() {
    const soundFiles = {
      correct: '/sounds/correct.mp3',
      wrong: '/sounds/wrong.mp3',
      streak: '/sounds/streak.mp3',
      tick: '/sounds/tick.mp3',
      complete: '/sounds/complete.mp3',
    };
    for (const [name, path] of Object.entries(soundFiles)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = this.volume;
      this.sounds.set(name, audio);
    }
  }

  play(name: string) {
    if (this.muted) return;
    const sound = this.sounds.get(name);
    if (sound) {
      sound.currentTime = 0;
      sound.volume = this.volume;
      sound.play().catch(() => {}); // Ignore autoplay restrictions
    }
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setMuted(m: boolean) { this.muted = m; }
}

export const soundService = new SoundService();
```

### Step 2: Source or generate sound files

Place minimal MP3/OGG files in `frontend/public/sounds/`. Keep each under 20KB. Options:
- Use a free sound library (freesound.org, mixkit.co)
- Generate with Web Audio API synthesis at build time

### Step 3: Integrate with GamePage

In the answer submission handler and result display:

```typescript
// On correct answer
soundService.play('correct');
if (newStreak >= 3) soundService.play('streak');

// On wrong answer
soundService.play('wrong');

// On game end
soundService.play('complete');
```

### Step 4: Connect to audioStore

Wire `soundService.setMuted()` and `soundService.setVolume()` to the existing `audioStore` state so the settings panel controls the sound.

### Step 5: Initialize in app startup

Call `soundService.init()` once in the app entry point or lazily on first game join.

### Step 6: Commit

```bash
git add frontend/src/services/soundService.ts frontend/public/sounds/ \
  frontend/src/pages/GamePage.tsx frontend/src/stores/audioStore.ts
git commit -m "feat(audio): add subtle default sound pack for game events"
```

---

## Task 8: Cut Audio Perk Slot

**Files:**
- Create: `backend/migrations/YYYYMMDD_HHMMSS_remove_audio_perks.sql`
- Modify: `backend/src/services/PerksManager.ts` (remove sound slot handling)
- Modify: `frontend/src/components/PerksManager.tsx` (remove sound slot from loadout UI)

### Step 1: Write migration to deactivate audio perks

```sql
-- Deactivate audio perks (keep rows for data integrity, just mark inactive)
UPDATE perks SET is_active = false WHERE name IN ('sound_packs_basic', 'sound_packs_premium', 'audio_reactions');
```

### Step 2: Remove sound slot from PerksManager loadout

In the backend `PerksManager`, remove the `sound` slot from the loadout slot configuration. In the frontend `PerksManager.tsx`, remove the sound slot from the 9-slot grid (now 8 slots).

### Step 3: Commit

```bash
git commit -m "chore(perks): deactivate audio perk slot in favor of default sound pack"
```

---

## Task 9: Dead Code Cleanup

**Files:**
- Create: `backend/migrations/YYYYMMDD_HHMMSS_cleanup_draft_artifacts.sql`
- Modify: `backend/src/services/PerkDraftService.ts` (rename to PerkQueryService)
- Modify: `frontend/src/services/socketService.ts` (remove dead perk:draft-* event types)
- Modify: `frontend/src/stores/gameStore.ts` (remove DraftOfferResult type)
- Modify: all imports referencing PerkDraftService

### Step 1: Rename PerkDraftService → PerkQueryService

Rename the file and class. Update all imports in:
- `GameService.ts`
- `CharacterService.ts`
- `perks.ts` routes
- `perkDraft.ts` routes

### Step 2: Remove dead socket event types

In `socketService.ts`, remove:
- `perk:draft-available` event type
- `perk:draft-result` event type
- `perk:pool-exhausted` event type

### Step 3: Remove DraftOfferResult from gameStore

Remove the `DraftOfferResult` type and any state fields referencing draft offers.

### Step 4: Remove perk:pick and perk:dump from CLAUDE.md

Update `l2p/CLAUDE.md` socket events list: remove `perk:pick` and `perk:dump` from client events, remove `perk:draft-result` and `perk:pool-exhausted` from server events.

Add `perk:use-hint`, `perk:use-eliminate` to client events.
Add `perk:hint-revealed`, `perk:answers-eliminated`, `perk:use-error` to server events.

### Step 5: Migration to drop user_perk_drafts table

```sql
-- Only drop if no application code references it
-- PerkDraftService.getActiveGameplayPerks queries the 'perks' table directly, not user_perk_drafts
-- Verify no queries reference user_perk_drafts before running
DROP TABLE IF EXISTS user_perk_drafts;

-- Remove unused column
ALTER TABLE users DROP COLUMN IF EXISTS needs_perk_redraft;
```

**WARNING:** Verify with `grep -r 'user_perk_drafts' backend/src/` that no code references this table before dropping it.

### Step 6: Run all tests

```bash
cd /home/patrick/projects/l2p && npm run test:unit
```

### Step 7: Commit

```bash
git commit -m "chore(perks): remove dead draft system artifacts, rename PerkDraftService to PerkQueryService"
```

---

## Summary: Perks Fixed Per Task

| Task | Perks Fixed | Effort |
|------|-------------|--------|
| 1: Perfectionist | 1 gameplay perk | Small |
| 2: Cosmetic names | 3-4 cosmetic slots | Small |
| 3: INFO passive | 3 gameplay perks (category, difficulty, answer_stats) | Medium |
| 4: Hints | 1 gameplay perk (hint_master) + smart_hints cosmetic | Medium |
| 5: Fifty-fifty | 3 gameplay perks (fifty_fifty, double_eliminate, oracle_vision) | Medium |
| 6: Badges | 3 cosmetic perks | Small |
| 7: Default sounds | Replaces 3 audio perks | Medium |
| 8: Cut audio slot | Cleanup of 3 perks | Small |
| 9: Dead code cleanup | 0 (maintenance) | Small |

**Total: 14+ perks go from broken/stub → functional. 3 audio perks cut and replaced. Dead code removed.**

After all tasks, every remaining perk in the system will have a working end-to-end pipeline.
