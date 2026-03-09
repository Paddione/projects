# OpenClaw Arena Testing — Recognition Handshake

**This document confirms openclaw has understood and acknowledged the 1v1 testing requirements.**

---

## ✅ Verification Checklist

When you (openclaw) have read and understood the testing guide, **create a GitHub issue** with the following content:

### Issue Title
```
[OPENCLAW] Arena 1v1 Testing Ready — Verification #TIMESTAMP
```

### Issue Body

Copy and confirm **all three sections below:**

#### Section A: Mission Understanding
```
I will continuously test Arena 1v1 after E2E passes.
I will report EVERY issue immediately with:
  - Timestamp
  - Scenario name
  - Error details
  - Severity (CRITICAL/HIGH/MEDIUM/LOW)

For CRITICAL issues: Fix immediately if < 15 min diagnosis
For other issues: Batch and deploy daily
```

**Acknowledge by replying:** ✅ Section A understood

---

#### Section B: Scenario Coverage
```
I will run 4 test scenarios on rotation:
  1. Basic 1v1 (every 30 min)   → Lobby + fight
  2. Item spawning (every 2h)   → Health + armor pickup
  3. Melee combat (every 4h)    → Instant kill verification
  4. Grenade launcher (every 6h) → Rare drop + explosion

Minimum: 48 matches per day
Expected: All scenarios executed at least weekly
```

**Acknowledge by replying:** ✅ Section B understood

---

#### Section C: Issue Batching Strategy
```
IMMEDIATE FIX (< 15 min):
  - Players can't spawn
  - Movement broken
  - Damage not applied
  - Match won't end

BATCH FIX (daily):
  - Audio glitches
  - Visual artifacts
  - Stats tracking bugs
  - Edge cases (< 5% occurrence)

I will create separate GH issues or batch PRs accordingly.
```

**Acknowledge by replying:** ✅ Section C understood

---

## 🔗 Links to Confirm

Please also verify you can reach these resources:

1. **Guide location:** `/home/patrick/projects/arena/OPENCLAW_1V1_TESTING.md`
2. **Arena dev:** https://dev-arena.korczewski.de (test environment)
3. **Arena prod:** https://arena.korczewski.de (monitor production)
4. **Backend logs:** `kubectl logs -f deployment/arena-backend -n korczewski-services`
5. **Deployment:** `./k8s/scripts/deploy/deploy-arena.sh`

---

## 📍 Status Tracking

Once you confirm sections A/B/C, I will:
1. ✅ Update MEMORY.md with "OpenClaw Arena testing active"
2. ✅ Pin this issue to the Arena project
3. ✅ Monitor your test logs for pattern changes
4. ✅ Respond to issues within 30 min during business hours

---

## 🎯 Expected First Run

**Timeline:**
- **Now:** You confirm sections A/B/C
- **+5 min:** Start first 1v1 test run
- **+30 min:** Report results (pass or fail)
- **+1h:** Evaluate if issues need immediate fix or batching
- **Daily:** Summary report (test count, issues, fixes)

---

**Waiting for your confirmation. Reply to this issue when ready.**
