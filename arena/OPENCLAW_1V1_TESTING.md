# OpenClaw Arena 1v1 Testing Guide

**Purpose:** Automated 1v1 gameplay testing to catch issues that pass E2E tests but appear in production.

---

## 🎯 Mission

After **all Arena E2E tests pass**, run continuous 1v1 matches to detect:
- ✅ Gameplay logic bugs (damage, spawning, collision)
- ✅ Socket.io sync issues (delayed/missing updates)
- ✅ State desynchronization (server vs client)
- ✅ Audio/visual glitches (asset loading, rendering)
- ✅ Regression issues (new features breaking old ones)

**Report every issue immediately.** If it's a **fast fix** (< 15 minutes to diagnose + deploy), fix it. Otherwise, **batch issues** and resolve in daily sessions.

---

## 🔧 Arena Setup

### Tunnel to OpenClaw Infrastructure

```bash
# Terminal 1: Establish SSH tunnel to openclaw container at 10.10.0.4
./scripts/openclaw-tunnel.sh

# Expected output:
#   Gateway:       localhost:18789
#   Browser Relay: localhost:18792
```

### Browser Relay Installation

```bash
# Terminal 2: Install Chrome extension (one-time)
openclaw browser extension install
RELAY_PATH=$(openclaw browser extension path)

# Open Chrome → chrome://extensions → enable "Developer mode"
# "Load unpacked" → paste $RELAY_PATH
# Pin extension → click icon to attach/detach
```

### Gateway Configuration

```bash
# In openclaw gateway config (on 10.10.0.4):
gateway:
  auth:
    token: <OPENCLAW_GATEWAY_TOKEN>
  browser:
    cdp_relay: localhost:18792
    headless: false
    timeout: 30000
```

---

## 🎮 Test Scenarios

### 1️⃣ Scenario: Basic 1v1 Lobby Creation & Fight

**Frequency:** Every 30 minutes (auto-loop)

**Steps:**
1. Load `https://arena.korczewski.de`
2. Create lobby (2 players, Best of 1)
3. Wait for both players ready
4. Start match → Game spawns
5. **Player 1** moves toward player 2
6. **Player 2** shoots when in range
7. One player dies
8. Match ends → Verify stats (damage dealt, kills, XP)

**Expected outcomes:**
- ✅ Both players spawn at opposite corners
- ✅ Damage is applied correctly (1 per shot, 2 shots = kill)
- ✅ Loser is marked dead, spectates winner
- ✅ Match summary shows correct stats
- ✅ Players can create new lobby immediately after

**Issue reporting template:**
```
[ARENA 1v1 FAILURE] [<timestamp>]
Scenario: <which step failed>
Error: <what went wrong>
Server logs: <tail -100 arena-backend logs>
Browser console: <screenshot or error message>
Reproduction: <steps to reproduce>
```

---

### 2️⃣ Scenario: Item Spawning & Pickup

**Frequency:** Every 2 hours (alternating with scenario 1)

**Steps:**
1. Create 1v1 lobby with `itemSpawns: true`
2. Start match
3. Wait 65 seconds for items to spawn
4. **Player 1** moves to an item
5. Verify item is removed from map
6. Verify **Player 1** HP/armor increased
7. Continue until match naturally ends

**Expected outcomes:**
- ✅ Items spawn near random locations after 60s
- ✅ Proximity detection works (pickup within ~50px)
- ✅ Health item adds 1 HP (max 2)
- ✅ Armor item adds 1 shield (max 2)
- ✅ Item visual feedback (sound, animation) present

---

### 3️⃣ Scenario: Melee Combat

**Frequency:** Every 4 hours

**Steps:**
1. Create 1v1 lobby
2. Start match
3. **Player 1** moves adjacent to **Player 2** (melee range ~40px)
4. **Player 1** presses MELEE key
5. Verify **Player 2** dies instantly (even with armor)
6. Match ends

**Expected outcomes:**
- ✅ Melee kills regardless of armor
- ✅ Animation plays (swing effect)
- ✅ Sound effect plays
- ✅ No delay (instant kill, not damage over time)

---

### 4️⃣ Scenario: Grenade Launcher (Rare Weapon)

**Frequency:** Every 6 hours

**Steps:**
1. Create 1v1 lobby with `itemSpawns: true`
2. Start match
3. Wait for items → collect until grenade launcher spawns (rare: ~5% of loot)
4. **Player 1** (with grenade launcher) fires at **Player 2**
5. Explosion affects all players within radius
6. Verify both take damage

**Expected outcomes:**
- ✅ Grenade spawns as rare drop
- ✅ Fire button triggers projectile with `explosionRadius: 150`
- ✅ On hit: explosion damages all nearby players
- ✅ Visual effect (explosion sprite) plays
- ✅ Sound effect (explosion audio) plays

---

## 📋 Batching Strategy

### **Immediate Fix** (< 15 min)
Detected issues that are **critical** or **trivial**:
- ❌ Players can't spawn / lobby fails to start
- ❌ One player can't move
- ❌ Damage doesn't apply
- ❌ Match doesn't end

**Action:**
1. Create GitHub issue with reproduction steps
2. Investigate root cause (5 min)
3. Fix in code (5 min)
4. Test locally (3 min)
5. Deploy via `./k8s/scripts/deploy/deploy-arena.sh`
6. Verify fix in production (1 min)
7. Update OpenClaw logs: `[FIXED]` + issue link

### **Batch Fix** (Accumulate daily)
Non-critical issues:
- ⚠️ Audio glitches (sound delayed, doesn't play)
- ⚠️ Visual artifacts (sprites not centered, animation hitches)
- ⚠️ Minor stats tracking bugs
- ⚠️ Rare edge cases (happens in <5% of matches)

**Action:**
1. Log each issue with `[BATCH]` prefix
2. Continue testing (don't block)
3. At end-of-day, create single PR with all fixes
4. Deploy once + test suite passes

---

## 🚨 Issue Tracking

### Log Format

```
[ARENA AUTO-TEST] [<timestamp>] [<severity>]
═══════════════════════════════════════════════════════
Scenario: <name>
Status: PASS | FAIL
Details: <what happened>
Severity: CRITICAL | HIGH | MEDIUM | LOW
Action: IMMEDIATE | BATCH
═══════════════════════════════════════════════════════

[Optional: server logs, screenshots, reproduction steps]
```

### Reporting Location

1. **Real-time:** Log to stdout + file at `/var/log/arena-autotest.log`
2. **GitHub Issues:** Create issue per CRITICAL/HIGH with label `arena::autotest`
3. **Summary:** Daily digest email with stats (# passed, # failed, % uptime)

---

## 🔄 Schedule

```
Every 30 min  → Scenario 1 (Basic 1v1)
Every 2h      → Scenario 2 (Items)
Every 4h      → Scenario 3 (Melee)
Every 6h      → Scenario 4 (Grenades)

Continuous loop with staggered timing to ensure:
  - At least 48 matches/day
  - Balanced coverage across all mechanics
  - No resource contention
```

---

## 🛠️ Implementation Checklist

### Phase 1: Setup
- [ ] Install openclaw browser extension
- [ ] Establish tunnel to 10.10.0.4:18789
- [ ] Configure gateway token + relay port
- [ ] Verify browser control works (simple navigation test)

### Phase 2: Automation Scripts
- [ ] Create `arena-1v1-test.js` (scenario orchestration)
  - Detects lobby join success/failure
  - Verifies socket events (game-state, player-hit, etc.)
  - Takes screenshots on failure
  - Logs results to file
- [ ] Create `arena-batch-fixer.js` (issue aggregation)
  - Reads test logs
  - Groups by error type
  - Suggests fixes or creates PR

### Phase 3: Deployment
- [ ] Add test runner to k8s deployment
- [ ] Configure log persistence (PVC)
- [ ] Set up daily email digest (GitHub Issues + log summary)

### Phase 4: Monitoring
- [ ] Dashboard showing:
  - Last 50 test results
  - Pass rate over time
  - Most common failure modes
  - FIXED vs BATCH buckets

---

## 🎯 Success Criteria

✅ **Test is working if:**
- Daily runs 48+ matches without human intervention
- Issues detected within 1 hour of appearing in production
- CRITICAL issues fixed before next business day
- Test output readable (clear pass/fail, no log spam)

❌ **Stop and investigate if:**
- No test results for > 2 hours (infrastructure issue)
- Same issue appears 3+ times in one day (bad fix or new regression)
- Test suite hangs > 5 min (timeout/deadlock)

---

## 📞 Escalation

If you detect a **game-breaking issue** (players can't play):

1. **Stop testing immediately**
2. Create GitHub issue with `arena::critical` label
3. Notify Patrick via Slack + email
4. Await manual investigation/fix

Otherwise, **continue testing** and batch issues as described.

---

## 🔗 Related Docs

- **Arena CLAUDE.md:** `/home/patrick/projects/arena/CLAUDE.md`
- **Arena Service Docs:** `/mnt/f/Obsidian/services/Arena.md`
- **E2E Test Specs:** `arena/e2e/*.spec.ts`
- **Deploy Script:** `k8s/scripts/deploy/deploy-arena.sh`
- **Production URL:** https://arena.korczewski.de

---

**Last Updated:** 2026-03-09
**Status:** Ready for implementation
