---
name: deployment-reminder
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: git\s+commit\s+-m|git\s+push\s+origin\s+master
---

🚀 **Deployment Required**

You've just committed code to master or pushed to remote. Remember: **changes must be deployed to k3s immediately**.

---

## ⚠️ Deployment Discipline

From CLAUDE.md:

> **Always deploy changes to k3s after committing (don't leave changes undeployed)**

This is NOT optional. Undeployed code means:
- Production is out of sync with git
- Teammates don't see your changes
- Bugs in production are invisible to you
- Deploy drift makes debugging harder

---

## 📋 What You Must Do Next

### 1. Check What Changed

```bash
cd k8s/scripts/utils

./deploy-tracker.sh status

# Output shows which services have undeployed commits
# Example:
# arena:        2 undeployed commits (since 887ea9f)
# l2p:          up-to-date
# auth:         1 undeployed commit (since abc1234)
```

### 2. Deploy Changed Services

```bash
cd ../deploy

# Option A: Auto-detect and deploy changed services (RECOMMENDED)
./deploy-changed.sh --committed

# Option B: Deploy specific service
./deploy-arena.sh
./deploy-l2p.sh
./deploy-auth.sh

# Option C: Deploy all services (if you're sure)
./deploy-all.sh
```

### 3. What the Script Does

1. Builds Docker images for changed services
2. Pushes to private registry (`registry.local:5000`)
3. Applies updated Kubernetes manifests
4. Restarts affected deployments
5. Waits for rollout to complete
6. Runs health checks
7. **Records the SHA** in deploy tracker

### 4. Verify Deployment

```bash
# Check status
./../../utils/deploy-tracker.sh status

# Should show all services "up-to-date"
```

---

## 🎯 Typical Workflow

```bash
# 1. You committed code to master
git commit -m "feat(arena): add grenade launcher sounds"
git push origin master

# 2. Hook fires with this message ← YOU ARE HERE
# 3. You run deploy script
./k8s/scripts/deploy/deploy-changed.sh --committed

# 4. Deployment completes in ~5 minutes
# 5. You verify in production
curl https://arena.korczewski.de/api/health | jq .

# ✅ Done! Code is live.
```

---

## 🚨 Common Mistakes

### ❌ "I'll deploy later"
→ You won't remember. Deploy immediately after committing.

### ❌ "I only changed frontend files"
→ Still need to deploy! Build, push, restart.

### ❌ "I pushed but didn't deploy"
→ Push is just git. K8s doesn't know about it. Deploy the images.

### ❌ "Tests pass locally so production is fine"
→ Prod runs different code. Always deploy to verify.

### ❌ Leaving undeployed commits
→ Causes confusion: "Did the bug fix go live?" (You don't know!)

---

## ✅ Checklist

- [ ] All tests pass (`npm run test`, `npm run typecheck`)
- [ ] Code is committed and pushed to master
- [ ] Running deployment script now
- [ ] Waiting for rollout to complete
- [ ] Checking health endpoint: `curl https://service.korczewski.de/api/health | jq .`
- [ ] Running deploy tracker: `./deploy-tracker.sh status` (all up-to-date)

---

## Quick Reference Commands

```bash
# From arena directory:

# 1. Check what needs deploying
cd ../../k8s/scripts/utils
./deploy-tracker.sh status

# 2. Deploy changed services
cd ../deploy
./deploy-changed.sh --committed

# 3. Verify it worked
./../../utils/deploy-tracker.sh status

# 4. Check production health
curl https://arena.korczewski.de/api/health | jq .

# 5. View logs if needed
kubectl logs -n korczewski-services deployment/arena-backend -f
```

---

## When NOT to Deploy Immediately

Only skip immediate deployment if:

1. **You're still developing** — Working on multiple commits
   - Keep committing locally
   - Deploy when feature is complete

2. **Tests are failing** — Fix them first
   - `npm run test` must pass
   - `npm run typecheck` must pass

3. **Unmerged PRs** — Wait for review
   - Get code reviewed first
   - Then deploy

Otherwise: **Deploy immediately.**

---

## Troubleshooting

### Deployment Fails

```bash
# Check git state
git status
git log --oneline -5

# Check cluster health
kubectl get nodes
kubectl get deployments -n korczewski-services

# Check recent logs
kubectl logs -n korczewski-services deployment/arena-backend -f --tail=100

# If still failing, rollback
git revert <bad-commit>
git push origin master
./deploy-changed.sh --committed
```

### Health Check Fails

```bash
# Check the endpoint
curl -v https://arena.korczewski.de/api/health

# Check pod logs
kubectl logs -n korczewski-services deployment/arena-backend -f

# Check if pod restarted
kubectl get pods -n korczewski-services
```

### Deploy Script Hangs

```bash
# Press Ctrl+C to stop

# Check manually
kubectl rollout status deployment/arena-backend -n korczewski-services

# Or apply manually
kubectl apply -f k8s/services/arena-backend/
kubectl rollout restart deployment/arena-backend -n korczewski-services
```

---

## The Why

**Why immediate deployment?**

1. **Feedback loop** — You see production errors immediately
2. **Confidence** — You know code is live, not guessing
3. **Accountability** — You deployed it, you own it
4. **Debugging** — Logs + code match (same version)
5. **Discipline** — Clear: commit → deploy → verify

**Why not batch deployments?**

- Harder to debug (which commit broke it?)
- Larger blast radius (multiple changes at once)
- More time between code and feedback
- Easy to forget what you changed

---

## 🎓 Learn More

For complete deployment workflow, see:
→ `/Obsidian/Workflows.md` → "Deployment" section
→ `/Obsidian/Operations.md` → Deployment runbook

For specific service setup:
→ `/Obsidian/services/Arena.md`
→ `/Obsidian/services/L2P.md`
→ etc.

---

## Ready to Deploy?

```bash
# Navigate to deploy scripts
cd k8s/scripts/deploy

# Run deploy
./deploy-changed.sh --committed

# And you're done! 🎉
```

Don't forget:
1. Wait for rollout
2. Check health endpoint
3. Verify deploy tracker shows up-to-date
4. Test in production if it's a user-facing change
