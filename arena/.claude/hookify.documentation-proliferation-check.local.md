---
name: documentation-proliferation-check
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: git\s+add|git\s+commit
  - field: command
    operator: contains
    pattern: "\.md"
---

📚 **Documentation File Alert**

You're adding or committing `.md` files. This hook checks for documentation sprawl.

**Purpose:**
- Prevent multiple `.md` files in the same subdirectory (except in specific areas)
- Keep documentation centralized in Obsidian vault or at repository root
- Avoid scattered, unmaintained docs

---

## 📋 Allowed `.md` Files

✅ **At repo root:**
- `README.md`
- `CLAUDE.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/*.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

✅ **In service directories:**
- `service/CLAUDE.md` (one per service)
- `service/README.md` (optional)

✅ **In project subdirectories:**
- `.claude/` directory (hooks, config)
- `.github/workflows/` (workflow documentation)
- `scripts/` (script README files)

✅ **In Obsidian vault:**
- Any `.md` files in `/mnt/f/Obsidian/` (centralized docs)

---

## ❌ Anti-Patterns to Avoid

These are the patterns this hook prevents:

```
❌ BAD: Multiple scattered docs
arena/CLAUDE.md
arena/ARCHITECTURE.md        ← Separate architecture doc!
arena/QUICKSTART.md          ← Separate quickstart doc!
arena/CONTRIBUTING.md        ← Separate contributing doc!
arena/frontend/SETUP.md      ← Scattered docs!
arena/backend/API.md         ← Scattered docs!

✅ GOOD: Centralized docs
arena/CLAUDE.md              ← Single source of truth
/Obsidian/services/Arena.md  ← Detailed service docs
/Obsidian/Architecture.md    ← System architecture
/Obsidian/Workflows.md       ← Development workflows
```

---

## 🔍 How to Check Your Additions

Before committing, verify you're not creating sprawl:

### 1. List staged `.md` files

```bash
git diff --cached --name-only | grep "\.md$"
```

**Example output:**
```
arena/CLAUDE.md           ✅ GOOD (single per service)
arena/frontend/SETUP.md   ❌ BAD (scattered in subdirectory)
arena/ARCHITECTURE.md     ❌ BAD (duplicate of Obsidian vault doc)
```

### 2. Count `.md` files per directory

```bash
# Check arena directory for problematic patterns
find arena -maxdepth 2 -name "*.md" -type f | sort

# Check if any subdirectory has >1 .md file (besides allowed)
find arena -mindepth 1 -maxdepth 2 -name "*.md" | \
  sed 's|/[^/]*\.md$||' | sort | uniq -c | awk '$1 > 1 {print}'
```

### 3. Verify against allowed list

```bash
# Your staged .md files should ONLY be:
# ✅ {service}/CLAUDE.md
# ✅ {service}/README.md (optional)
# ✅ Root-level docs (README.md, CONTRIBUTING.md, etc.)
# ✅ .github/ directory files
# ✅ .claude/ directory files

# Anything else = documentation sprawl!
```

---

## 🚨 If You See This Hook Trigger

You're about to commit `.md` files. Here's how to respond:

### Scenario 1: Service-specific Documentation

**Problem:** You're creating `arena/ARCHITECTURE.md` or `l2p/DATABASE.md`

**Solution:** Add this content to `/Obsidian/services/Arena.md` or `/Obsidian/services/L2P.md` instead

```bash
# Before committing:

# 1. Copy your .md content to Obsidian
cp arena/ARCHITECTURE.md /mnt/f/Obsidian/services/Arena.md
# (Merge into existing file if it has content)

# 2. Remove the scattered doc
git rm arena/ARCHITECTURE.md

# 3. Update CLAUDE.md to reference Obsidian vault:
# "For detailed architecture, see /Obsidian/services/Arena.md"

git add arena/CLAUDE.md
git commit -m "docs: consolidate architecture docs to Obsidian vault"
```

### Scenario 2: Process or Workflow Documentation

**Problem:** You're creating `scripts/AUDIO_PIPELINE.md` or similar

**Solution:** Add to `/Obsidian/Workflows.md`

```bash
# 1. Append your documentation to Obsidian vault
cat arena/scripts/AUDIO_PIPELINE.md >> /mnt/f/Obsidian/Workflows.md

# 2. Remove the scattered doc
git rm arena/scripts/AUDIO_PIPELINE.md

# 3. Commit
git commit -m "docs: add workflow documentation to Obsidian vault"
```

### Scenario 3: Quick Reference (Temporary)

**Problem:** You want a quick README for a new script or tool

**Solution:** Use a brief section in `CLAUDE.md` instead

```markdown
## Quick Reference: New Tool

# In arena/CLAUDE.md

### New Tool: asset-validator

Validates asset files before commit.

Usage:
\`\`\`bash
./scripts/validate-assets.sh
\`\`\`
```

### Scenario 4: GitHub-Specific Docs

**Problem:** PR templates, issue templates, workflow docs

**Solution:** These go in `.github/` — that's fine!

```bash
# ✅ These are allowed:
.github/PULL_REQUEST_TEMPLATE.md
.github/ISSUE_TEMPLATE/bug_report.md
.github/workflows/README.md

git add .github/
git commit -m "docs: add issue templates"
```

---

## 📌 Golden Rules

1. **One `.md` per service** — `arena/CLAUDE.md`, `l2p/CLAUDE.md`, etc.
2. **Root-level docs** — `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md` (optional, prefer Obsidian)
3. **Obsidian is central** — All detailed service/architecture/workflow docs go there
4. **GitHub has its place** — `.github/` docs are fine for CI/PR templates
5. **Code docs stay in code** — Use comments, docstrings, type hints (not separate `.md` files)

---

## ✅ Checklist Before Committing

- [ ] Not creating `service/SOMETHING.md` (should be in Obsidian vault)
- [ ] Not creating scattered docs in subdirectories
- [ ] Not duplicating Obsidian vault content
- [ ] Only committing: `service/CLAUDE.md`, `README.md`, or `.github/` docs
- [ ] Running `find . -name "*.md" | wc -l` shows reasonable count
- [ ] CLAUDE.md is the source of truth for quick reference

---

## 🛠 How to Disable This Hook (If Needed)

If you have a legitimate `.md` file to add, you can disable this hook temporarily:

```bash
# Edit the hook file
nano /home/patrick/projects/arena/.claude/hookify.documentation-proliferation-check.local.md

# Change:
# enabled: true
# To:
# enabled: false

# Commit your .md file
git add [your-files]
git commit -m "..."

# Re-enable the hook
# (change enabled back to true)
```

**Important:** Only disable if you have a specific reason. Document why in your commit message.

---

## 📚 Recommended Practices

**For architecture docs:**
→ `/Obsidian/services/{Service}.md`
→ `/Obsidian/Architecture.md`

**For workflow docs:**
→ `/Obsidian/Workflows.md`
→ `/Obsidian/Operations.md`

**For quick reference:**
→ `{service}/CLAUDE.md`
→ Root `CLAUDE.md`

**For code docs:**
→ Comments in source code
→ Type annotations
→ Docstrings
→ JSDocs

**For GitHub:**
→ `.github/ISSUE_TEMPLATE/*.md`
→ `.github/PULL_REQUEST_TEMPLATE.md`

---

## Examples

### ✅ Good: Using CLAUDE.md

```bash
# File: arena/CLAUDE.md (single source of truth)

## Asset Pipeline

Procedural `Graphics` rendering is replaced by sprite-based `Sprite`/`AnimatedSprite`.

**Pipeline scripts** (in `scripts/`):
\`\`\`bash
./scripts/generate_all.sh               # Run full pipeline
./scripts/generate_all.sh --phase 3     # Sprite rendering only
\`\`\`

For detailed workflow, see `/Obsidian/Workflows.md` → Asset Pipeline Generation
```

### ❌ Bad: Scattered Docs

```
arena/CLAUDE.md                          ❌ Source of truth
arena/ASSET_PIPELINE.md                  ❌ Duplicate
arena/BLENDER_QUICK_REFERENCE.md         ❌ Scattered
arena/frontend/QUICK_START.md            ❌ Scattered
arena/backend/DATABASE_SCHEMA.md         ❌ Scattered
```

---

## FAQ

**Q: Can I have `service/README.md`?**
A: Yes, but prefer `service/CLAUDE.md`. If you need both, keep `README.md` minimal (installation only).

**Q: What about `scripts/README.md`?**
A: Add to `CLAUDE.md` "Scripts" section instead. Or use comments in the script itself.

**Q: Can I create `.github/workflows/README.md`?**
A: Yes, this is allowed. Workflow documentation is specific to CI/CD and OK in `.github/`.

**Q: I need step-by-step deployment docs**
A: Add to `/Obsidian/Workflows.md` or `/Obsidian/Operations.md`.

**Q: What if I disagree with this rule?**
A: Create a hook exception by setting `enabled: false` in this file and explain your use case in a comment.

---

## Related Documentation

- 📘 Central Workflows: `/Obsidian/Workflows.md`
- 🏗️ Architecture: `/Obsidian/Architecture.md`
- 🎯 Service Docs: `/Obsidian/Services/`
- 📋 Operations: `/Obsidian/Operations.md`
