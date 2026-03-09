# Arena E2E Coverage Gap Analysis

**Date:** 2026-03-09
**Issue:** Multiple production failures not caught by E2E tests:
1. Loading screen stuck at 0% (asset loading failed silently)
2. Audio decoding errors (stubs instead of real files)
3. CSP violations (worker-src and data: blocked)

**Root Cause:** E2E tests use network-level API mocks and never verify real asset files.

---

## Current E2E Architecture

```
E2E Test Flow:
  Playwright → Arena Frontend (load)
           ↓
  mockApi.ts intercepts all API calls
           ↓
  Assets/Audio loading mocked/stubbed
           ↓
  Test passes ✓
```

**Problem:** This architecture masks real-world failures.

---

## What E2E Currently Tests

✅ Auth flow with mock user data
✅ Lobby creation/joining with mocked API
✅ Player ready + game start signals
✅ Basic touch events (mobile.spec.ts)
✅ UI navigation and error states

---

## What E2E **Doesn't** Test

❌ **LoadingScreen.tsx** - Never verifies progress reaches 100%
❌ **AssetService.loadAll()** - Doesn't load real sprite atlases
❌ **SoundService.loadAll()** - Doesn't decode real audio files
❌ **CSP headers** - Doesn't verify Content-Security-Policy allows operations
❌ **File existence** - Doesn't check if files actually exist in dist/
❌ **Game fallback logic** - Doesn't test Graphics rendering when sprites fail

---

## Evidence of Failures

| Failure | When Caught | Why E2E Missed It |
|---------|-------------|-------------------|
| Loading screen 0% forever | User reports | Mocked assets, no real loading |
| Audio decode errors | Console spam | Howler.js never instantiated with real files |
| Worker CSP violation | DevTools | No worker creation in mocked tests |
| Data: image CSP block | PixiJS bitmap check | No real image processing in mocks |

---

## Proposed Solution: Asset Integration Tests

Create a new test file: `arena/e2e/assets.spec.ts`

### Test 1: Verify All Files Exist
```typescript
test('all asset files exist in dist/', async () => {
  const atlases = ['characters', 'items', 'weapons', 'tiles', 'cover', 'ui'];
  for (const atlas of atlases) {
    // Check dist/assets/sprites/{atlas}.json exists
    // Check dist/assets/sprites/{atlas}.png exists
  }

  const sfx = ['grenade_launch', 'grenade_explode', 'gunshot', ...];
  for (const sound of sfx) {
    // Check dist/assets/sfx/{sound}.mp3 exists
    // Check dist/assets/sfx/{sound}.ogg exists
  }
});
```

### Test 2: Loading Screen Completes
```typescript
test('LoadingScreen progresses to 100%', async ({ page }) => {
  page.goto('http://localhost:3002');

  // Watch progress bar
  const progressBar = page.locator('[role="progressbar"]');
  await page.waitForFunction(() => {
    // Get computed width of progress bar
    // Verify it reaches 100%
  }, { timeout: 30000 });

  // Verify "Ready!" text appears
  await expect(page.getByText('Ready!')).toBeVisible();

  // Verify game renders (not fallback)
  await expect(page.getByRole('button', { name: /Create Lobby|Join/ })).toBeVisible();
});
```

### Test 3: Audio Files Decode
```typescript
test('all audio files decode without errors', async ({ page }) => {
  // Navigate to game
  // Intercept Howler.js onloaderror events
  // Verify zero errors during SoundService.loadAll()
});
```

### Test 4: CSP Headers Permit Assets
```typescript
test('CSP headers allow asset operations', async ({ page }) => {
  const response = await page.request.get('http://localhost:3002');
  const csp = response.headers()['content-security-policy'];

  expect(csp).toContain('worker-src');
  expect(csp).toContain("'self' blob:");
  expect(csp).toContain('img-src');
  expect(csp).toContain('connect-src');
  expect(csp).toContain('data:');
});
```

### Test 5: Sprite Atlas Validity
```typescript
test('sprite atlases are valid JSON with texture data', async () => {
  const atlases = ['characters', 'items', 'weapons', 'tiles', 'cover', 'ui'];

  for (const atlas of atlases) {
    const jsonPath = `frontend/dist/assets/sprites/${atlas}.json`;
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    expect(json.frames).toBeDefined();
    expect(Object.keys(json.frames).length).toBeGreaterThan(0);
    expect(json.meta).toBeDefined();
    expect(json.meta.image).toBeTruthy();
  }
});
```

---

## Implementation Checklist

- [ ] Create `arena/e2e/assets.spec.ts`
- [ ] Add test 1: File existence verification
- [ ] Add test 2: Loading screen completion
- [ ] Add test 3: Audio decoding validation
- [ ] Add test 4: CSP header validation
- [ ] Add test 5: Sprite atlas validity
- [ ] Run tests locally (docker-compose.test.yml)
- [ ] Add to CI/CD pipeline (playwright workflow)
- [ ] Document in arena/CLAUDE.md
- [ ] Run baseline to establish passing state
- [ ] Update E2E test checklist (this prevents regression)

---

## Why This Matters

**Before:** "All tests pass, ship to production, users see loading screen forever" ❌

**After:** "Tests verify assets exist, load, and decode before deploying" ✅

---

## Prevention Going Forward

1. **Always test with real assets** (not mocks) in at least one test suite
2. **Verify file existence** before deployment
3. **Check CSP headers** in CI/CD validation
4. **Monitor asset loading** in production (openclaw 1v1 tests will catch this)
5. **Require E2E pass + Asset tests pass** before merge

---

**Status:** Ready to implement
**Effort:** ~2 hours to write + integrate + verify
**ROI:** Prevents production outages from missing assets
