# Linear Workspace Setup Guide
**For**: Korczewski Monorepo (l2p, VideoVault, payment, vllm, auth)
**Date**: 2026-01-10
**Tool**: Claude Code - Linear Plugin

---

## Linear Workspace Structure

### Team Setup

```
Workspace: Korczewski Projects
└── Teams:
    ├── L2P (Learn2Play)
    ├── VideoVault
    ├── Payment
    ├── VLLM & AI
    ├── Auth & Infrastructure
    └── Cross-Cutting
```

---

## Project Configuration

### 1. L2P (Learn2Play) Team

**Description**: Multiplayer quiz platform with real-time gameplay

**Labels**:
- `frontend` - React frontend issues
- `backend` - Express/Socket.io backend
- `game-logic` - Core game mechanics
- `database` - PostgreSQL schema/migrations
- `socket.io` - WebSocket real-time features
- `e2e-tests` - Playwright test issues
- `performance` - Performance optimizations
- `bug` - Bug fixes
- `feature` - New features
- `refactor` - Code refactoring

**Workflows**:
```
Backlog → Todo → In Progress → In Review → Testing → Done
                                            ↓
                                        Blocked
```

**Issue Templates**:

**Bug Template**:
```markdown
## Description
[What's broken?]

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen?]

## Actual Behavior
[What actually happens?]

## Environment
- Browser: [Chrome/Firefox/Safari]
- Game State: [Lobby/In-game/Results]
- Players: [Solo/Multiplayer]

## Error Logs
[Paste any console errors]

## Priority
- [ ] Blocks deployment
- [ ] Degrades UX
- [ ] Minor issue
```

**Feature Template**:
```markdown
## Feature Summary
[What are we building?]

## User Story
As a [user type], I want [goal] so that [benefit]

## Acceptance Criteria
- [ ]
- [ ]
- [ ]

## Technical Approach
[High-level implementation plan]

## Dependencies
- Requires: [list dependencies]
- Blocks: [list blocked issues]

## Testing Plan
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

## Estimated Complexity
- [ ] Small (< 4 hours)
- [ ] Medium (1-2 days)
- [ ] Large (> 2 days)
```

---

### 2. VideoVault Team

**Description**: Client-first video management application

**Labels**:
- `client-side` - React client issues
- `server-side` - Express server issues
- `file-system-api` - File System Access API
- `filtering` - Filter engine features
- `bulk-ops` - Bulk operations
- `thumbnails` - Thumbnail generation
- `database` - PostgreSQL persistence
- `playwright-e2e` - E2E testing
- `bug`
- `feature`
- `performance`

**Workflows**: Same as L2P

**Issue Templates**:

**Browser Compatibility Bug**:
```markdown
## Browser
- [ ] Chrome
- [ ] Edge
- [ ] Opera
- [ ] Safari (limited support)
- [ ] Firefox (limited support)

## Issue
[What's not working?]

## File System Access API
- [ ] Permission issues
- [ ] Handle persistence
- [ ] Directory scanning

## Workaround Available?
[Yes/No - describe if yes]
```

---

### 3. Payment Team

**Description**: Payment platform with Stripe integration

**Labels**:
- `stripe` - Stripe API integration
- `nextauth` - Authentication issues
- `prisma` - Database/ORM
- `checkout` - Checkout flow
- `subscriptions` - Subscription management
- `invoices` - Invoice generation
- `security` - Security concerns
- `pci-compliance` - PCI compliance
- `bug`
- `feature`

**Workflows**:
```
Backlog → Todo → In Progress → Code Review → Security Review → Testing → Done
                                            ↓
                                        Blocked
```

**Issue Templates**:

**Security-Critical Feature**:
```markdown
## Feature Description
[What are we building?]

## Security Considerations
- [ ] PCI compliance review needed
- [ ] Sensitive data handling
- [ ] Authentication/authorization changes
- [ ] Rate limiting required
- [ ] Input validation

## Stripe Integration
- [ ] Webhook handling
- [ ] Test mode testing required
- [ ] Production keys needed
- [ ] Webhook signature validation

## Testing Checklist
- [ ] Unit tests
- [ ] Integration tests with Stripe test mode
- [ ] Security review completed
- [ ] OWASP Top 10 check
- [ ] Penetration testing (if applicable)
```

---

### 4. VLLM & AI Team

**Description**: MCP server for AI inference and RAG

**Labels**:
- `mcp-server` - MCP protocol issues
- `vllm` - vLLM inference engine
- `rag` - RAG stack (Qdrant, LlamaIndex)
- `dashboard` - Control panel (port 4242)
- `database-tools` - PostgreSQL tool constraints
- `model-management` - Model deployment
- `huggingface` - Hugging Face integration
- `bug`
- `feature`
- `performance`

**Issue Templates**:

**Model Deployment**:
```markdown
## Model Information
- Model Name:
- Model Size:
- HuggingFace URL:
- Quantization: [Yes/No]

## Resource Requirements
- GPU Memory:
- Disk Space:
- Expected Latency:

## Deployment Checklist
- [ ] Download model from HuggingFace
- [ ] Verify vLLM compatibility
- [ ] Update docker-compose.yml
- [ ] Configure model parameters
- [ ] Test inference endpoint
- [ ] Update dashboard
- [ ] Document usage
```

---

### 5. Auth & Infrastructure Team

**Description**: Unified auth service and shared infrastructure

**Labels**:
- `auth-service` - Auth microservice
- `jwt` - JWT token issues
- `oauth` - OAuth integration
- `database` - Shared PostgreSQL
- `docker` - Docker orchestration
- `traefik` - Reverse proxy
- `networking` - Service networking
- `secrets` - Secret management
- `security` - Security issues
- `bug`
- `feature`

**Workflows**:
```
Backlog → Todo → Security Review → In Progress → Code Review → Testing → Staging → Production
                   ↓
               Blocked
```

**Issue Templates**:

**Infrastructure Change**:
```markdown
## Change Description
[What infrastructure component is changing?]

## Affected Services
- [ ] l2p
- [ ] VideoVault
- [ ] payment
- [ ] vllm
- [ ] auth
- [ ] shared-postgres
- [ ] traefik

## Downtime Required?
- [ ] Yes - Estimated: [duration]
- [ ] No - Rolling update possible

## Rollback Plan
[How to revert if something goes wrong]

## Testing Plan
- [ ] Test in development environment
- [ ] Verify all services connect
- [ ] Check database migrations
- [ ] Validate SSL certificates
- [ ] Test cross-service communication

## Deployment Checklist
- [ ] Update docker-compose files
- [ ] Update .env.example
- [ ] Document environment variables
- [ ] Notify team of changes
- [ ] Schedule deployment window
```

---

### 6. Cross-Cutting Team

**Description**: Issues spanning multiple projects

**Labels**:
- `multi-project` - Affects multiple services
- `documentation` - Documentation updates
- `ci-cd` - GitHub Actions workflows
- `monitoring` - Logging and monitoring
- `testing` - Test infrastructure
- `dependencies` - Dependency updates
- `security-audit` - Security reviews
- `performance` - Cross-service performance

---

## Linear + GitHub Integration

### Branch Naming Convention

```bash
# Linear creates branches automatically with pattern:
<team-key>-<issue-number>-<slug>

Examples:
l2p-123-add-lobby-timeout
vault-45-fix-thumbnail-generation
pay-67-stripe-webhook-validation
vllm-89-deploy-llama-model
auth-12-jwt-rotation
```

### Commit Message Format

```bash
# Linear auto-links commits with pattern:
<type>: <description> [<LINEAR-ISSUE-ID>]

Examples:
feat: Add lobby timeout functionality [L2P-123]
fix: Resolve thumbnail generation race condition [VAULT-45]
security: Validate Stripe webhook signatures [PAY-67]
chore: Deploy LLaMA 3.1 8B model [VLLM-89]
refactor: Implement JWT rotation [AUTH-12]
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `security` - Security improvement
- `perf` - Performance improvement
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `docs` - Documentation
- `chore` - Maintenance tasks
- `ci` - CI/CD changes

### PR Auto-Linking

Linear automatically:
1. Links PRs to issues when branch name matches
2. Updates issue status to "In Review" when PR opened
3. Moves to "Done" when PR merged
4. Adds PR link to issue comments

**PR Title Format**:
```
[L2P-123] Add lobby timeout functionality
```

---

## Issue Priority Matrix

### Priority Levels

| Priority | Description | SLA | Example |
|----------|-------------|-----|---------|
| 🔴 Urgent | Blocks production, security vulnerability | 4 hours | Auth service down, payment processing broken |
| 🟠 High | Degrades UX significantly | 1 day | Lobby crashes on 10+ players |
| 🟡 Medium | Important but not blocking | 1 week | Missing filter option, slow thumbnails |
| 🟢 Low | Nice to have, minor improvements | 2 weeks | UI polish, documentation updates |
| ⚪ Backlog | Future consideration | No SLA | Experimental features, refactoring ideas |

### Severity Levels (for bugs)

| Severity | Description | Example |
|----------|-------------|---------|
| Critical | Data loss, security breach, service down | Database corruption, XSS vulnerability |
| High | Major feature broken | Cannot join lobbies, payment fails |
| Medium | Feature partially broken | Some filters don't work |
| Low | Minor issue, workaround available | Typo in UI, minor layout issue |

---

## Linear Automation Rules

### 1. Auto-assign Based on Label

```
IF label = "frontend" THEN assign to @frontend-team
IF label = "backend" THEN assign to @backend-team
IF label = "security" THEN assign to @security-team
IF label = "database" THEN assign to @database-team
```

### 2. Auto-transition on PR Events

```
IF PR opened THEN move to "In Review"
IF PR merged THEN move to "Done"
IF PR closed (not merged) THEN move to "Backlog"
```

### 3. Auto-notify on Priority

```
IF priority = "Urgent" THEN notify @on-call
IF label = "security" AND priority = "High" THEN notify @security-team
```

### 4. SLA Warnings

```
IF priority = "Urgent" AND age > 4 hours THEN notify assignee
IF priority = "High" AND age > 24 hours THEN notify team lead
IF status = "Blocked" AND age > 48 hours THEN escalate to manager
```

---

## Issue Estimation

### T-Shirt Sizing

| Size | Hours | Description | Example |
|------|-------|-------------|---------|
| XS | 1-2 | Trivial change | Fix typo, update config |
| S | 2-4 | Simple feature | Add validation, simple UI component |
| M | 4-8 | Standard feature | New API endpoint, complex component |
| L | 8-16 | Large feature | New game mode, payment integration |
| XL | 16+ | Epic | Redesign architecture, major refactor |

### Story Points (Fibonacci)

```
1 point  = XS (1-2 hours)
2 points = S (2-4 hours)
3 points = M (4-8 hours)
5 points = L (8-16 hours)
8 points = XL (16+ hours)
13 points = Epic (break down into smaller issues)
```

---

## Sprint Planning

### Sprint Cadence

- **Duration**: 2 weeks
- **Planning**: Monday, Week 1 (1 hour)
- **Daily Standups**: 15 minutes (async in Linear comments)
- **Review**: Friday, Week 2 (30 minutes)
- **Retrospective**: Friday, Week 2 (30 minutes)

### Sprint Goals Template

```markdown
## Sprint [Number] Goals
**Dates**: [Start] - [End]
**Theme**: [What's the focus?]

### Team: L2P
- [ ] [L2P-123] Add lobby timeout
- [ ] [L2P-124] Fix game disconnection bug
- [ ] [L2P-125] E2E tests for new features

### Team: VideoVault
- [ ] [VAULT-45] Thumbnail performance optimization
- [ ] [VAULT-46] New filter: video duration

### Team: Payment
- [ ] [PAY-67] Stripe webhook hardening
- [ ] [PAY-68] Invoice PDF generation

### Cross-Cutting
- [ ] [INFRA-12] Upgrade shared-postgres to v16
- [ ] [DOC-5] Update all README files

### Success Metrics
- All urgent issues resolved
- 80% of planned story points completed
- Zero production incidents
- Test coverage > 85%
```

---

## Claude Code + Linear Workflow

### Starting Work on an Issue

```bash
# User: "What should I work on next?"
# Claude with Linear plugin:
1. Fetches issues assigned to user
2. Filters by priority and status
3. Suggests highest priority item
4. Auto-creates branch: l2p-123-add-lobby-timeout
5. Transitions issue to "In Progress"
```

### Completing Work

```bash
# User: "I'm done with L2P-123"
# Claude with Linear plugin:
1. Runs tests
2. Creates commit: "feat: Add lobby timeout [L2P-123]"
3. Pushes branch
4. Creates PR via GitHub plugin
5. Transitions Linear issue to "In Review"
6. Adds PR link to Linear issue
```

### Daily Standup (Async)

```bash
# User: "/standup"
# Claude with Linear plugin:
1. Summarizes work completed yesterday
2. Lists issues in progress today
3. Identifies blockers
4. Posts update to Linear issue comments
```

---

## Migration from TASKS.md

### Step 1: Export Existing Tasks

```bash
# Review current TASKS.md
cat /home/patrick/projects/TASKS.md

# Identify active tasks
# Categorize by project (l2p, VideoVault, etc.)
```

### Step 2: Create Linear Issues

```bash
# For each task in TASKS.md:
1. Create Linear issue in appropriate team
2. Set priority based on task importance
3. Add relevant labels
4. Assign if owner is clear
5. Add to current sprint or backlog
```

### Step 3: Archive TASKS.md

```bash
# Move to historical record
mv TASKS.md TASKS_ARCHIVED_20260110.md

# Update README to reference Linear
echo "## Task Tracking\nIssues are tracked in Linear: [link]" >> README.md
```

---

## .agent-tasks.md Integration

Keep `.agent-tasks.md` for multi-agent coordination:

```markdown
# .agent-tasks.md

## Active Agent Tasks (Real-time coordination)
[YYYY-MM-DD HH:MM] [l2p] [IN_PROGRESS] Agent-1: Refactoring LobbyService
[YYYY-MM-DD HH:MM] [videovault] [IN_PROGRESS] Agent-2: Optimizing FilterEngine

## Linear Issues Reference
- Agent-1 working on: L2P-123, L2P-124
- Agent-2 working on: VAULT-45
```

**Use .agent-tasks.md for**:
- Real-time agent coordination
- Git operation locking
- Docker rebuild coordination

**Use Linear for**:
- Persistent issue tracking
- Sprint planning
- Team collaboration
- Historical record

---

## Linear API Integration Examples

### Create Issue via API

```typescript
// Using Linear SDK
import { LinearClient } from '@linear/sdk';

const linear = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });

async function createIssue(title: string, description: string, teamId: string) {
  const issue = await linear.issueCreate({
    title,
    description,
    teamId,
    priority: 2, // High priority
    labelIds: ['label-id-1', 'label-id-2'],
  });

  return issue.issue;
}

// Claude would call this when user says:
// "Create a Linear issue for the lobby timeout bug"
```

### Query Issues

```typescript
async function getMyIssues(userId: string) {
  const issues = await linear.issues({
    filter: {
      assignee: { id: { eq: userId } },
      state: { type: { in: ['started', 'unstarted'] } }
    },
    orderBy: 'priority'
  });

  return issues.nodes;
}

// Claude would call this when user says:
// "What should I work on next?"
```

### Update Issue Status

```typescript
async function transitionIssue(issueId: string, stateId: string) {
  await linear.issueUpdate(issueId, {
    stateId,
  });
}

// Claude would call this when:
// - PR is opened → "In Review"
// - PR is merged → "Done"
// - Work starts → "In Progress"
```

---

## Reporting & Metrics

### Team Velocity Dashboard

Track weekly:
- Story points completed
- Average cycle time (Todo → Done)
- Bug resolution time
- Deployment frequency
- Test coverage trends

### Issue Metrics

- **Throughput**: Issues closed per sprint
- **Lead Time**: Time from creation to done
- **Cycle Time**: Time from in-progress to done
- **Bug Escape Rate**: Bugs found in production vs testing

### Sprint Report Template

```markdown
## Sprint [Number] Report
**Team**: [L2P/VideoVault/Payment/etc.]
**Dates**: [Start] - [End]

### Completed
- [L2P-123] Add lobby timeout (3 points) ✅
- [L2P-124] Fix disconnection bug (2 points) ✅

### Carried Over
- [L2P-125] E2E tests (5 points) → Next sprint

### Metrics
- Planned: 15 points
- Completed: 12 points (80%)
- Velocity: 12 points/sprint
- Bugs fixed: 4
- Bugs created: 1

### Blockers Encountered
- None this sprint

### Learnings
- Need better E2E test infrastructure
- Socket.io testing requires more time than estimated

### Next Sprint Goals
- Complete E2E tests
- Focus on performance optimization
```

---

## Best Practices

### Issue Writing

✅ **Good Issue Title**:
```
[L2P] Lobby crashes when 10th player joins
```

❌ **Bad Issue Title**:
```
Bug
```

✅ **Good Description**:
```markdown
## Problem
Lobby crashes consistently when the 10th player attempts to join.

## Steps to Reproduce
1. Create lobby with host
2. Join 9 additional players
3. Attempt to join 10th player
4. Server crashes with error: "Maximum call stack size exceeded"

## Root Cause
LobbyService doesn't validate max player count before adding to lobby.

## Proposed Fix
Add validation in LobbyService.joinLobby() to check player count.
```

❌ **Bad Description**:
```
Lobby doesn't work with too many people. Fix it.
```

---

## Conclusion

This Linear workspace setup provides:

1. **Clear project structure** with dedicated teams
2. **Automated workflows** reducing manual overhead
3. **GitHub integration** for seamless development
4. **Claude Code integration** for AI-assisted project management
5. **Consistent issue templates** for quality tracking
6. **Sprint planning structure** for predictable delivery

**Next Steps**:
1. Create Linear workspace at linear.app
2. Set up teams and projects
3. Configure GitHub integration
4. Import issues from TASKS.md
5. Train team on workflows
6. Start first sprint

---

🤖 Generated with [Claude Code](https://claude.com/claude-code) - Linear Plugin
