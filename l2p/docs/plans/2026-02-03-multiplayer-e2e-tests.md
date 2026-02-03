# Multiplayer Lobby & Game Sync E2E Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add proper Playwright E2E tests that exercise the full multiplayer lobby lifecycle and game synchronization with 2-4 players, including adding missing `data-testid` attributes to components that lack them.

**Architecture:** Two-part approach: (1) Add missing data-testid attributes to ResultsPage and PlayerGrid so tests can assert on game results and player state, (2) Write a comprehensive E2E spec suite using multiple browser contexts (one per player) to test real multiplayer flows end-to-end.

**Tech Stack:** Playwright, React (existing components), Socket.io (real connections, no mocks), test mode (`?test=true`) for lobby configuration.

---

## Important Context

### Actual data-testid attributes (verified in source)

**HomePage/GameInterface (`GameInterface.tsx`):**
- `create-lobby-button` - div (card), click opens lobby or test panel
- `join-lobby-button` - div (card), click opens join panel
- `lobby-code-input` - input for 6-char code (visible when join panel open)
- `join-lobby-confirm` - button to confirm join
- `confirm-create-lobby` - button inside test-mode panel
- `question-count-select`, `question-set-select`, `private-lobby-checkbox` - test mode only

**LobbyView (`LobbyView.tsx`):**
- `lobby-code` - span showing 6-char code
- `host-indicator` - div with "Master of Ceremony"
- `lobby-players` - wrapper div
- `player-list` - passed as data-testid prop to PlayerGrid
- `ready-toggle` - button (NOT `ready-button`)
- `start-game-button` - button (host only, disabled until 1+ ready)
- `lobby-settings`, `setting-question-count`, `setting-question-set`, `setting-private`, `setting-max-players` - hidden config spans
- `lobby-error` - error overlay

**GamePage (`GamePage.tsx`):**
- `sync-countdown` - div during syncing phase
- `question-number`, `total-questions` - spans
- `timer` - span (format: "⏱ Ns")
- `question-container` - div wrapping question card
- `question-text` - h3 element
- `answer-option-0` through `answer-option-3` - buttons
- `answer-feedback` - div ("Antwort gesendet!")
- `current-score` - div wrapper around ScoreDisplay

**PlayerGrid (`PlayerGrid.tsx`):**
- `player-{player.id}` - per-player slot (uses numeric ID, NOT username)
- `empty-slot-{index}` - empty player slots

**ResultsPage (`ResultsPage.tsx`):** - NO data-testid attributes exist. Must add them.

**Header (`Header.tsx`):**
- `user-menu`, `logout-button`, `profile-link`, `mute-toggle`

**AuthForm:**
- `login-tab`, `register-tab`, `username-input`, `email-input`, `password-input`, `confirm-password-input`, `login-button`, `register-button`

### Test mode requirement

The `GameInterface.tsx` create-lobby flow requires test mode to show configuration selectors. Enable via:
- URL: `?test=true`
- Or: `sessionStorage.setItem('test_mode', 'true')`

Without test mode, clicking "Create Lobby" immediately creates a lobby with defaults (no question count/set selection).

### Game flow timing

1. Sync countdown: 5 seconds (`game-syncing` events)
2. Question time limit: 60 seconds per question
3. Between questions: ~5 second delay
4. Answer feedback shown immediately on click

### Multi-player test pattern

Each player needs a separate browser context (`browser.newContext()`), each with its own page. Register + authenticate each player separately, then coordinate lobby join and game actions across pages.

---

## Task 1: Add data-testid attributes to ResultsPage

**Files:**
- Modify: `l2p/frontend/src/pages/ResultsPage.tsx`

**Step 1: Add test IDs to ResultsPage container and key elements**

Add these data-testid attributes to the ResultsPage component:

```tsx
// Line ~248: Results page container
<div className={styles.container} data-testid="results-page">

// Line ~249: Main results card
<div className={`${styles.card} ${styles.textCenter}`} style={{ marginBottom: 'var(--spacing-xl)' }} data-testid="final-results">

// Line ~257: Winner card
<div className={`${styles.card} ${styles.textCenter}`} style={{ marginBottom: 'var(--spacing-xl)' }} data-testid="winner-announcement">
  <h2>🎉 Winner: {winner.username}!</h2>

// Line ~277: Rankings card
<div className={styles.card} style={{ marginBottom: 'var(--spacing-xl)' }} data-testid="player-scores">

// Line ~281: Each player row (inside the map)
<div key={player.id} data-testid={`result-player-${player.id}`} className={...}>

// Line ~312: Each player's score display
<div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: 'var(--text-secondary)' }} data-testid={`final-score-${player.id}`}>
  {player.finalScore} pts
</div>

// Line ~421-434: Play Again and Back to Home buttons
<button className={styles.button} onClick={handlePlayAgain} data-testid="play-again-button">
  Play Again
</button>
<button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => navigate('/')} data-testid="back-to-home-button">
  Back to Home
</button>
```

**Step 2: Verify build compiles**

Run: `cd /home/patrick/projects/l2p && npm run build:frontend 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add l2p/frontend/src/pages/ResultsPage.tsx
git commit -m "feat(l2p): add data-testid attributes to ResultsPage for E2E testing"
```

---

## Task 2: Replace broken game-flow.spec.ts with proper multiplayer E2E tests

**Files:**
- Rewrite: `l2p/frontend/e2e/tests/integration/game-flow.spec.ts`

This is the core test file. It replaces the existing broken tests with working ones that use correct selectors.

**Step 1: Write the new test file**

The test file should use the `TestHelpers` from `../../utils/test-helpers` for registration and lobby operations, and standard `@playwright/test` imports.

Key design decisions:
- Each test registers fresh users (no shared state between tests)
- Uses `browser.newContext()` for each player (separate auth/cookies)
- Navigates with `?test=true` for test mode when lobby config needed
- Uses `page.waitForSelector()` and `expect().toBeVisible()` with adequate timeouts for socket events
- Test timeout increased to 120s for full game flows
- The `ready-toggle` selector is used (not `ready-button`)
- PlayerGrid uses `player-{id}` (numeric) not `player-{username}`, so we assert on player list text content rather than dynamic testid
- For results page, use the new `final-results`, `player-scores`, `final-score-{id}` testids

**Test cases to implement:**

### Test 1: `2-player complete game session`
- Register host + player in separate contexts
- Host creates lobby (non-test-mode, default settings)
- Player joins via lobby code
- Verify both see each other in player list
- Both toggle ready
- Host starts game
- Both see sync countdown
- Both see questions, answer them
- Both reach results page
- Verify scores displayed for both

### Test 2: `lobby player management (join, ready, leave)`
- Register host + 2 players in separate contexts
- Host creates lobby
- Player 1 joins - verify host sees 2 players
- Player 2 joins - verify all see 3 players
- Player 1 toggles ready - verify host sees ready state
- Player 2 leaves lobby - verify host and player 1 see 2 players
- Host can still start with 1 ready player

### Test 3: `game synchronization - same question shown to all players`
- Register host + player
- Create and join lobby, ready up, start game
- Wait for first question
- Read question text from both pages
- Assert both see identical question text
- Both answer, wait for next question
- Assert both see same second question

### Test 4: `player disconnection during game`
- Register host + player
- Start a game
- Close player's page (simulates disconnect)
- Host can continue answering questions
- Game completes for host

### Test 5: `4-player lobby and game`
- Register host + 3 players
- All join lobby
- Verify all 4 players visible
- All ready up, host starts
- All 4 answer first question
- Verify game continues with all players

### Test 6: `host leaves lobby - lobby destroyed`
- Register host + player
- Both in lobby
- Host clicks leave lobby
- Player should see error or be redirected (lobby deleted)

**Step 2: Run the tests (expect most to fail initially since test infra may not be running)**

Run: `cd /home/patrick/projects/l2p/frontend/e2e && npx playwright test tests/integration/game-flow.spec.ts --reporter=list 2>&1 | tail -20`

Note: Tests require the full stack running (`npm run test:setup` from l2p root). They will fail if the app isn't running, which is expected at this point. The goal is to verify the test file parses and the test runner picks up the tests.

**Step 3: Commit**

```bash
git add l2p/frontend/e2e/tests/integration/game-flow.spec.ts
git commit -m "feat(l2p): rewrite multiplayer E2E tests with correct selectors and 2-4 player scenarios"
```

---

## Task 3: Update Playwright config to include integration tests

**Files:**
- Modify: `l2p/frontend/e2e/playwright.config.ts`

**Step 1: Remove integration tests from testIgnore**

The current config ignores `**/tests/integration/**`. Remove that entry so the new tests run.

Change line ~29 from:
```ts
testIgnore: [
    '**/tests/error-handling/**',
    '**/tests/accessibility/**',
    '**/tests/performance/**',
    '**/tests/integration/**',  // REMOVE THIS LINE
    '**/tests/examples/**',
    ...
]
```

To:
```ts
testIgnore: [
    '**/tests/error-handling/**',
    '**/tests/accessibility/**',
    '**/tests/performance/**',
    '**/tests/examples/**',
    ...
]
```

**Step 2: Increase global timeout for multiplayer tests**

The default 30s timeout is too short for multiplayer flows with sync countdowns. Add a project-specific config or increase global timeout to 120s for integration tests. The simplest approach: add a second project entry for integration tests:

```ts
projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/tests/integration/**'],
    },
    {
      name: 'integration',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/tests/integration/**',
      timeout: 120000,
    },
],
```

**Step 3: Verify config is valid**

Run: `cd /home/patrick/projects/l2p/frontend/e2e && npx playwright test --list 2>&1 | head -20`
Expected: Lists the new integration test cases without errors.

**Step 4: Commit**

```bash
git add l2p/frontend/e2e/playwright.config.ts
git commit -m "feat(l2p): enable integration E2E tests in Playwright config with extended timeout"
```

---

## Task 4: Add multiplayer test helper utilities

**Files:**
- Modify: `l2p/frontend/e2e/utils/test-helpers.ts`

**Step 1: Add multiplayer-specific helper methods to TestHelpers class**

Add these methods:

```ts
/**
 * Register a user and return to authenticated home page.
 * Uses test mode for full control.
 */
static async registerAndAuthenticate(
  page: Page,
  userData?: Partial<UserData>
): Promise<{ user: UserData; token: string }> {
  return await this.registerUser(page, userData);
}

/**
 * Create a lobby and return its code.
 * Does NOT require test mode - clicks create which uses defaults.
 */
static async createLobbySimple(page: Page): Promise<string> {
  await page.click('[data-testid="create-lobby-button"]');
  await expect(page.locator('[data-testid="lobby-code"]')).toBeVisible({ timeout: 15000 });
  const code = await page.locator('[data-testid="lobby-code"]').textContent();
  if (!code) throw new Error('Failed to get lobby code');
  return code.trim();
}

/**
 * Wait for game to start (handles sync countdown + first question).
 */
static async waitForGameReady(page: Page, timeout = 30000): Promise<void> {
  // Wait for either sync countdown or question container
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="sync-countdown"]') ||
           document.querySelector('[data-testid="question-container"]');
  }, { timeout });

  // If we see sync countdown, wait for it to finish and question to appear
  const syncVisible = await page.locator('[data-testid="sync-countdown"]').isVisible().catch(() => false);
  if (syncVisible) {
    await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 15000 });
  }
}

/**
 * Setup a multi-player game: register N players, create lobby, join all, ready all.
 * Returns { pages, lobbyCode, users } for further interaction.
 */
static async setupMultiPlayerLobby(
  browser: import('@playwright/test').Browser,
  playerCount: number
): Promise<{
  pages: Page[];
  contexts: import('@playwright/test').BrowserContext[];
  lobbyCode: string;
  users: UserData[];
}> {
  const pages: Page[] = [];
  const contexts: import('@playwright/test').BrowserContext[] = [];
  const users: UserData[] = [];

  // Create host
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const { user: hostUser } = await this.registerUser(hostPage);
  pages.push(hostPage);
  contexts.push(hostContext);
  users.push(hostUser);

  // Host creates lobby
  const lobbyCode = await this.createLobbySimple(hostPage);

  // Create and join additional players
  for (let i = 1; i < playerCount; i++) {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    const { user } = await this.registerUser(pg);
    await this.joinLobby(pg, lobbyCode);
    pages.push(pg);
    contexts.push(ctx);
    users.push(user);
  }

  return { pages, contexts, lobbyCode, users };
}

/**
 * Toggle ready for a player on their page.
 */
static async toggleReady(page: Page): Promise<void> {
  await page.click('[data-testid="ready-toggle"]');
}

/**
 * Wait for results page to be visible.
 */
static async waitForResults(page: Page, timeout = 60000): Promise<void> {
  // Results can appear via navigation to /results/:lobbyId
  await page.waitForFunction(() => {
    return document.querySelector('[data-testid="final-results"]') ||
           window.location.pathname.includes('/results/');
  }, { timeout });
}
```

**Step 2: Commit**

```bash
git add l2p/frontend/e2e/utils/test-helpers.ts
git commit -m "feat(l2p): add multiplayer test helper utilities for E2E lobby/game setup"
```

---

## Task 5: Verify tests parse and list correctly

**Step 1: Verify Playwright can list all test cases**

Run: `cd /home/patrick/projects/l2p/frontend/e2e && npx playwright test tests/integration/game-flow.spec.ts --list 2>&1`
Expected: All 6 test cases listed without parse errors.

**Step 2: If there are TypeScript errors, fix them**

Common issues: missing imports, type mismatches. Fix and re-run.

**Step 3: Final commit if fixes needed**

```bash
git add -A l2p/frontend/e2e/
git commit -m "fix(l2p): resolve E2E test compilation issues"
```

---

## Running the Tests

To actually run these tests, the full L2P stack must be running:

```bash
# Terminal 1: Start test infrastructure
cd /home/patrick/projects/l2p
npm run test:setup

# Terminal 2: Run E2E tests
cd /home/patrick/projects/l2p
npm run test:e2e -- --project=integration

# Or headed mode for debugging:
npm run test:e2e:headed -- --project=integration

# Or single test:
cd /home/patrick/projects/l2p/frontend/e2e
npx playwright test tests/integration/game-flow.spec.ts --headed --reporter=list
```

---

## Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `frontend/src/pages/ResultsPage.tsx` | Modify | Add data-testid attrs for E2E assertions |
| `frontend/e2e/tests/integration/game-flow.spec.ts` | Rewrite | Replace broken tests with 6 working multiplayer scenarios |
| `frontend/e2e/playwright.config.ts` | Modify | Enable integration tests, add timeout config |
| `frontend/e2e/utils/test-helpers.ts` | Modify | Add multiplayer setup/teardown helpers |
