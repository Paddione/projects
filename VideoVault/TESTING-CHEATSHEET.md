# VideoVault Testing Cheat Sheet

## 🚀 Pre-Deployment Pipeline

Run this before deploying:
```bash
npm run test:all
```

Or run individual stages:
```bash
npm run test:1:types         # ⚡ Types     (~5-10s)
npm run test:2:unit          # 🧪 Unit      (~30-60s)
npm run test:3:integration   # 🔗 Integration (~10-20s)
npm run test:4:e2e           # 🎭 E2E       (~2-5m)
npm run test:5:build         # 📦 Build     (~30-60s)
npm run test:6:health        # ✅ Health    (instant)
```

**Total time: ~4-8 minutes**

---

## 📋 Quick Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run test:quick` | Types + Unit tests | During development |
| `npm run test:all` | Full pipeline | Before commit/PR/deploy |
| `npm run test:watch` | Watch mode | TDD workflow |
| `npm run test:coverage:full` | Coverage report | Check test quality |

---

## 🔍 Debugging Failed Tests

### Stage 1 Failed (Types)
```bash
npm run check  # See detailed type errors
```

### Stage 2 Failed (Unit)
```bash
npm run test:client  # Test client only
npm run test:server  # Test server only
npm run test -- path/to/test.ts  # Single file
```

### Stage 3 Failed (Integration)
```bash
npm run test:e2e -- --reporter=verbose
```

### Stage 4 Failed (E2E)
```bash
npm run docker:pw:ui  # Interactive debugging
npm run docker:logs   # Check container logs
```

### Stage 5 Failed (Build)
```bash
npm run build  # See detailed build errors
```

---

## 🎯 Common Workflows

### Before Every Commit
```bash
npm run test:quick
```

### Before Pull Request
```bash
npm run test:all
```

### Local E2E Development
```bash
npm run docker:dev:detached  # Start dev
npm run test:pw:ui           # Debug E2E
npm run docker:down          # Stop
```

### Check Coverage
```bash
npm run test:coverage:full
```

---

## 📦 What Each Stage Tests

| Stage | Tests | Catches |
|-------|-------|---------|
| **1. Types** | TypeScript compilation | Type errors, imports |
| **2. Unit** | Services, hooks, utilities | Logic bugs |
| **3. Integration** | API routes, DB operations | Integration issues |
| **4. E2E** | Full browser workflows | UI/UX bugs |
| **5. Build** | Production bundling | Build errors |
| **6. Health** | Final verification | Summary |

---

## ⏱️ Expected Runtimes

- **test:quick** → ~40-70 seconds (no E2E)
- **test:all** → ~4-8 minutes (full pipeline)
- **test:watch** → Continuous (development)
- **test:coverage:full** → ~1-2 minutes

---

## 💡 Tips

1. **Start with `test:1:types`** - Fastest way to catch issues
2. **Use `test:quick` often** - Fast feedback loop
3. **Run `test:all` before pushing** - Ensure quality
4. **Debug with UI mode** - `docker:pw:ui` for E2E issues
5. **Check coverage regularly** - Maintain quality standards

---

## 🆘 Emergency Debugging

### All Tests Failing
```bash
# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

### E2E Tests Hanging
```bash
# Reset Docker environment
npm run docker:down
npm run docker:clean
npm run docker:pw:all
```

### Coverage Failing
```bash
# Check which files are below threshold
npm run test:coverage:full
# Look for files with red coverage percentages
```

---

## 📚 Full Documentation

See [TESTING.md](./TESTING.md) for complete guide with troubleshooting.

---

**Remember: When all 6 stages pass, you're ready to deploy! ✅**
