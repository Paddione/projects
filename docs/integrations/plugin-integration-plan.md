# Claude Code Plugin Integration Plan

**Generated**: 2026-01-10
**Monorepo**: l2p, VideoVault, payment, vllm, auth, reverse-proxy, shared-infrastructure

This document outlines actionable integration plans for each installed Claude Code plugin to maximize their utility across this multi-project monorepo.

---

## 1. frontend-design

**Purpose**: Create distinctive, production-grade frontend interfaces with high design quality

### Current Frontend Projects
- **l2p/frontend** - React multiplayer quiz platform
- **VideoVault/client** - React video management UI
- **payment** - Next.js 16 payment platform
- **auth/frontend** - Authentication UI

### Integration Opportunities

#### Immediate Wins
1. **L2P Game UI Enhancement**
   - Invoke when redesigning lobby, game room, or admin interfaces
   - Use for creating distinctive quiz question displays
   - Apply to leaderboard and results screens
   - Focus: Avoid generic Material-UI aesthetics, create memorable game experience

2. **VideoVault Grid & Player**
   - Use when improving video grid layout (currently uses virtualization)
   - Enhance video player controls and overlay UI
   - Redesign filter panel and bulk operation toolbar
   - Focus: Professional media management aesthetic

3. **Payment Checkout Flow**
   - Invoke for Stripe checkout UI improvements
   - Design payment history and invoice displays
   - Create subscription management interfaces
   - Focus: Trust-building, conversion-optimized design

#### Usage Pattern
```bash
# When user says: "Redesign the lobby interface"
# or "Make the video grid look more professional"
# Claude should invoke: frontend-design skill
```

#### Integration Checklist
- [ ] Identify low-quality or generic UI components in each project
- [ ] Create design system consistency across l2p modules
- [ ] Enhance VideoVault's admin panel aesthetics
- [ ] Review payment flows for design quality
- [ ] Document design patterns in each project's README

---

## 2. context7

**Purpose**: Advanced context management and codebase navigation

### Integration Opportunities

#### Monorepo Context Challenges
- **Multi-project awareness**: Context7 should track which project Claude is working in
- **Shared infrastructure**: Understanding database relationships across services
- **Cross-project dependencies**: Auth service integration with l2p/payment

#### Key Use Cases
1. **Cross-Service Tracing**
   - Track how auth tokens flow: auth → l2p/payment
   - Understand shared-postgres database isolation
   - Map Traefik routing to service endpoints

2. **Multi-Agent Coordination**
   - Use `.agent-tasks.md` to track concurrent work
   - Maintain context when switching between projects
   - Remember which services are running/modified

3. **Environment Variable Tracking**
   - Context awareness of which `.env` file is active
   - Track DATABASE_URL differences across services
   - Remember JWT_SECRET and session configurations

#### Implementation Steps
- [ ] Test context7's ability to track multi-project state
- [ ] Verify it can remember active service contexts
- [ ] Use for maintaining awareness during long refactoring sessions
- [ ] Integrate with .agent-tasks.md for multi-agent scenarios

---

## 3. github

**Purpose**: GitHub operations via gh CLI

### Current GitHub Usage
- **Workflows**: Each project has .github/workflows/ for CI/CD
- **PRs**: Currently manual via web UI
- **Issues**: Not systematically tracked

### Integration Opportunities

#### Automated PR Creation
1. **Per-Project PR Workflow**
   ```bash
   # After completing l2p feature work
   cd l2p
   gh pr create --title "Add lobby timeout feature" --body "..."
   ```

2. **Cross-Project PRs**
   - When changes span multiple services (e.g., auth + l2p)
   - Create linked PRs with references
   - Auto-link related issues

3. **Workflow Integration**
   - Check CI status before marking tasks complete
   - Auto-link to workflow runs in PR descriptions
   - Monitor test failures from failed workflows

#### Issue Management
1. **Automated Issue Creation**
   - When discovering bugs during development
   - Track TODOs that require separate implementation
   - Link issues to specific code locations

2. **Issue-Driven Development**
   - Fetch issues: `gh issue list --label "l2p"`
   - Auto-close on PR merge
   - Reference issues in commit messages

#### Usage Pattern
```bash
# When user says: "Create a PR for this feature"
# Claude should:
1. Run git status, git diff, git log
2. Analyze commits since branch diverged
3. Create comprehensive PR summary
4. Use gh pr create with proper formatting
```

#### Integration Checklist
- [ ] Configure gh CLI for this repo
- [ ] Create PR templates in .github/PULL_REQUEST_TEMPLATE.md
- [ ] Establish labeling convention (l2p, videovault, payment, etc.)
- [ ] Set up issue templates for each project type
- [ ] Document PR workflow in root README.md

---

## 4. feature-dev

**Purpose**: Guided feature development with codebase understanding and architecture focus

### Integration Opportunities

#### Architecture-Aware Development
1. **L2P Features**
   - Invoke when adding new game modes, lobby features
   - Use for Socket.io event planning
   - Guide database migration planning
   - Focus: Maintain workspace structure, respect layers (routes → services → repositories)

2. **VideoVault Features**
   - Use when adding filtering capabilities
   - Guide bulk operations implementation
   - Plan File System Access API integrations
   - Focus: Client-first architecture, localStorage persistence

3. **Payment Features**
   - Invoke for new Stripe integration features
   - Guide Prisma schema changes
   - Plan NextAuth integrations
   - Focus: Security, PCI compliance considerations

4. **VLLM Features**
   - Use when adding new MCP tools
   - Guide RAG stack enhancements
   - Plan vLLM API integrations
   - Focus: Tool architecture, security constraints

#### Monorepo-Specific Patterns
- **Shared Infrastructure**: Feature-dev should understand centralized postgres
- **Cross-Service Features**: Guide features spanning auth + l2p/payment
- **Docker Orchestration**: Plan features requiring docker-compose changes

#### Usage Pattern
```bash
# When user says: "Add real-time notifications to l2p"
# feature-dev should:
1. Explore existing Socket.io architecture
2. Identify notification storage (postgres schema)
3. Plan backend events, frontend listeners
4. Consider impact on existing game state sync
5. Present plan with file-level specifics
```

#### Integration Checklist
- [ ] Test feature-dev on small l2p feature (e.g., add lobby timer)
- [ ] Verify it respects workspace structure (frontend/backend)
- [ ] Check it considers testing requirements (unit/integration/e2e)
- [ ] Ensure it plans database migrations properly
- [ ] Document when to invoke feature-dev vs manual coding

---

## 5. typescript-lsp

**Purpose**: TypeScript language server integration for advanced type analysis

### Current TypeScript Setup
- All projects use TypeScript
- Multiple tsconfig.json files (per workspace)
- Path aliases configured differently per project

### Integration Opportunities

#### Type Safety Analysis
1. **Cross-Workspace Type Checking**
   - L2P: Ensure shared types between frontend/backend
   - Verify Socket.io event types match on both sides
   - Check shared error handling types

2. **Path Alias Resolution**
   - VideoVault uses `@/` and `@shared/`
   - L2P uses workspace-relative imports
   - typescript-lsp should resolve correctly per project

3. **Migration Safety**
   - Detect breaking type changes during refactoring
   - Find all usages of deprecated types
   - Verify interface contracts across boundaries

#### Refactoring Support
1. **Rename Symbol Across Monorepo**
   - Safely rename shared types (e.g., AuthToken)
   - Update imports across projects
   - Maintain type safety during rename

2. **Type Inference Improvements**
   - Suggest better type annotations
   - Detect `any` usage that should be typed
   - Recommend interface extraction

#### Usage Pattern
```bash
# When refactoring shared types:
1. typescript-lsp analyzes all references
2. Validates changes won't break contracts
3. Suggests type improvements
4. Detects circular dependencies
```

#### Integration Checklist
- [ ] Test on l2p workspace types (shared between frontend/backend)
- [ ] Verify it handles multiple tsconfig.json files
- [ ] Check path alias resolution for VideoVault (@/, @shared/)
- [ ] Test rename refactoring across project boundaries
- [ ] Document when to invoke for type safety

---

## 6. security-guidance

**Purpose**: Security review and vulnerability guidance

### Security-Critical Areas

#### High-Priority Review Targets
1. **Auth Service**
   - JWT token generation and validation
   - OAuth flow implementation
   - Session management
   - Password hashing and storage

2. **Payment Service**
   - Stripe webhook signature validation
   - PCI compliance for payment data
   - NextAuth session security
   - Database credential exposure

3. **L2P Backend**
   - Socket.io authentication
   - Rate limiting on API endpoints
   - SQL injection prevention (pg queries)
   - XSS prevention in game content

4. **VideoVault**
   - File System Access API security boundaries
   - Admin authentication
   - Directory traversal prevention
   - CORS configuration

5. **VLLM**
   - MCP tool security constraints (SELECT-only queries)
   - vLLM API authentication
   - Database access controls

#### Environment Security
1. **Secrets Management**
   - Audit all .env files for exposed secrets
   - Verify JWT_SECRET, SESSION_SECRET uniqueness
   - Check database password strength
   - Review STRIPE_WEBHOOK_SECRET handling

2. **Docker Security**
   - Review docker-compose.yml for insecure defaults
   - Check network isolation between services
   - Audit exposed ports
   - Review Traefik TLS configuration

#### Usage Pattern
```bash
# Invoke security-guidance when:
1. Adding new authentication flows
2. Implementing payment processing
3. Exposing new API endpoints
4. Reviewing .env configurations
5. Before production deployment

# Proactive security audits:
- Weekly review of auth/* changes
- Pre-deployment payment/* review
- After adding new dependencies
```

#### Integration Checklist
- [ ] Run security audit on auth service JWT implementation
- [ ] Review payment Stripe webhook validation
- [ ] Audit l2p Socket.io authentication
- [ ] Check VideoVault admin authentication
- [ ] Review VLLM database query constraints
- [ ] Scan all .env.example files for sensitive defaults
- [ ] Audit CORS configurations across services
- [ ] Review rate limiting implementations

---

## 7. playwright

**Purpose**: Playwright test automation integration

### Current Playwright Setup
- **L2P**: `frontend/e2e/` with Playwright tests
- **VideoVault**: Docker-based Playwright (port 9323 UI)
- **Payment**: Playwright tests configured

### Integration Opportunities

#### Test Creation & Maintenance
1. **L2P E2E Scenarios**
   - Multiplayer game flows (lobby → game → results)
   - Socket.io real-time interactions
   - Admin panel operations
   - Use playwright plugin to generate tests from user stories

2. **VideoVault E2E**
   - File system permission flows
   - Bulk operations (select → tag → rename)
   - Filter preset workflows
   - Grid virtualization performance tests

3. **Payment E2E**
   - Checkout flow end-to-end
   - Stripe test mode integration
   - Subscription management
   - Invoice generation

#### Playwright Plugin Integration
```bash
# When user says: "Add E2E test for lobby creation"
# playwright plugin should:
1. Analyze existing test patterns in frontend/e2e/
2. Generate test using established selectors
3. Consider Socket.io event timing
4. Use proper data-testid attributes
5. Handle async game state transitions
```

#### Test Debugging & Analysis
1. **Failure Analysis**
   - Parse Playwright HTML reports
   - Identify flaky tests
   - Suggest timeout adjustments
   - Recommend better selectors

2. **Docker Integration**
   - Help debug Docker Playwright setup
   - Resolve version mismatches (Dockerfile vs npm)
   - Optimize test parallelization

#### Usage Pattern
```bash
# Proactive usage:
# After implementing new UI feature
# Claude should suggest: "Should I create E2E tests for this?"
# Then invoke playwright plugin to generate tests

# Reactive usage:
# When tests fail: "Analyze Playwright report at test-results/..."
# playwright plugin parses failures, suggests fixes
```

#### Integration Checklist
- [ ] Test playwright plugin on simple l2p scenario (login flow)
- [ ] Verify it generates tests matching existing patterns
- [ ] Check Docker Playwright integration (VideoVault)
- [ ] Test failure analysis on real failed test report
- [ ] Create E2E test for payment checkout flow
- [ ] Document when to invoke playwright vs manual test writing
- [ ] Set up CI integration for Playwright runs

---

## 8. linear

**Purpose**: Linear issue tracking integration

### Current Task Management
- **TASKS.md**: Manual task tracking
- **.agent-tasks.md**: Multi-agent coordination
- No formal issue tracker integration

### Integration Opportunities

#### Issue-Driven Development
1. **Create Linear Workspace Structure**
   ```
   Projects:
   - L2P (Learn2Play)
   - VideoVault
   - Payment
   - VLLM
   - Auth
   - Infrastructure
   ```

2. **Automated Issue Creation**
   - When discovering bugs during development
   - Convert TASKS.md items to Linear issues
   - Create issues from failed tests
   - Track technical debt

3. **Development Workflow**
   ```bash
   # linear plugin workflow:
   1. User: "Start work on login bug"
   2. linear plugin fetches issue details
   3. Claude creates branch: `fix/linear-123-login-bug`
   4. Implements fix
   5. linear plugin updates issue status
   6. Creates PR linked to Linear issue
   ```

#### Cross-Project Tracking
1. **Dependencies**
   - Track features requiring auth + l2p changes
   - Link issues across projects
   - Manage shared infrastructure dependencies

2. **Sprint Planning**
   - Organize work by project
   - Balance workload across services
   - Track multi-service features

#### Usage Pattern
```bash
# When user says: "What should I work on next?"
# linear plugin should:
1. Fetch issues for current project (based on cwd)
2. Filter by priority, assignee
3. Suggest next task with context
4. Auto-update issue when work starts

# When completing work:
1. linear plugin transitions issue to "Done"
2. Adds PR link to issue
3. Updates time tracking
```

#### Integration Checklist
- [ ] Set up Linear workspace with project structure
- [ ] Configure Linear API token
- [ ] Test issue creation from Claude
- [ ] Test issue fetching and filtering
- [ ] Create branch naming convention (linear-ISSUE_ID-description)
- [ ] Set up Linear ↔ GitHub PR linking
- [ ] Migrate high-priority TASKS.md items to Linear
- [ ] Document linear plugin workflow in root README

---

## 9. huggingface-skills

**Purpose**: Hugging Face API integration, model training, dataset management

### Integration Opportunities

#### VLLM Project Enhancement
1. **Model Management**
   - Use `hugging-face-cli` to download models for vLLM
   - Automate model caching
   - Manage model versions

2. **Evaluation Integration**
   - Use `hugging-face-evaluation` for model performance tracking
   - Integrate with vLLM dashboard (port 4242)
   - Track inference metrics

3. **Training Workflows**
   - Use `hugging-face-model-trainer` for fine-tuning
   - Integrate with Trackio monitoring
   - Deploy trained models to vLLM

#### L2P Quiz Content Generation
1. **Dataset Creation**
   - Use `hugging-face-datasets` to create quiz question datasets
   - Store quiz variations
   - Version quiz content

2. **Content Generation**
   - Generate quiz questions using HF models
   - Create difficulty-graded content
   - Multi-language quiz support

#### Auth & Security
1. **Token Management**
   - Securely manage HF_TOKEN in .env files
   - Use `hugging-face-cli` for authentication
   - Store tokens in docker secrets

#### Usage Pattern
```bash
# VLLM model deployment:
# User: "Deploy LLaMA 3.1 8B to vLLM"
# huggingface-skills should:
1. Use hugging-face-cli to download model
2. Verify model compatibility with vLLM
3. Update vllm/docker-compose.yml with model path
4. Deploy container with new model

# L2P content generation:
# User: "Generate 100 science quiz questions"
# huggingface-skills should:
1. Use hugging-face-datasets to create dataset
2. Generate questions using fine-tuned model
3. Validate question format
4. Export to l2p database format
```

#### Integration Checklist
- [ ] Configure HF_TOKEN in vllm/.env
- [ ] Test model download with hugging-face-cli
- [ ] Create quiz dataset schema with hugging-face-datasets
- [ ] Test model deployment to vLLM infrastructure
- [ ] Integrate Trackio with vLLM dashboard
- [ ] Document HF workflow in vllm/README.md
- [ ] Create example quiz generation pipeline

---

## Cross-Plugin Workflows

### Workflow 1: Feature Development End-to-End

```bash
User: "Add user profile pictures to l2p"

1. linear plugin: Create Linear issue "Add profile pictures"
2. feature-dev: Plan implementation
   - Database schema changes (postgres)
   - File upload endpoint (backend)
   - Avatar component (frontend)
   - Socket.io sync for live updates
3. typescript-lsp: Validate type changes across frontend/backend
4. security-guidance: Review file upload security
5. frontend-design: Design avatar UI component
6. playwright: Create E2E test for upload flow
7. github: Create PR with Linear issue link
8. linear: Transition issue to "Done"
```

### Workflow 2: Security Audit

```bash
User: "Security audit payment service"

1. security-guidance: Comprehensive security review
   - Stripe webhook validation
   - NextAuth session security
   - Database query safety
2. typescript-lsp: Check for `any` types in payment logic
3. github: Create issues for findings
4. linear: Create security backlog items
5. feature-dev: Plan security improvements
```

### Workflow 3: UI Redesign

```bash
User: "Redesign VideoVault grid interface"

1. frontend-design: Create new grid design
2. playwright: Update E2E tests for new selectors
3. typescript-lsp: Ensure type safety during refactor
4. github: Create PR with before/after screenshots
5. linear: Close "Improve grid UX" issue
```

### Workflow 4: VLLM Model Deployment

```bash
User: "Deploy new model to vLLM for quiz generation"

1. huggingface-skills (hugging-face-cli): Download model
2. feature-dev: Plan vLLM integration
3. security-guidance: Review API security
4. github: Document model deployment
5. linear: Track model performance metrics
```

---

## Implementation Priority

### Phase 1: Immediate Integration (Week 1)
- [ ] Configure **github** plugin (gh CLI setup, PR templates)
- [ ] Test **playwright** plugin on existing test
- [ ] Run **security-guidance** audit on auth service
- [ ] Set up **linear** workspace structure

### Phase 2: Development Workflow (Week 2)
- [ ] Integrate **feature-dev** into standard workflow
- [ ] Configure **typescript-lsp** for type safety
- [ ] Use **frontend-design** for one UI improvement
- [ ] Test **context7** for multi-project awareness

### Phase 3: Advanced Integration (Week 3-4)
- [ ] Integrate **huggingface-skills** with VLLM
- [ ] Create cross-plugin workflows (examples above)
- [ ] Document plugin usage in CLAUDE.md
- [ ] Train on optimal plugin invocation patterns

---

## Plugin Usage Guidelines

### When to Invoke Plugins vs Direct Tool Use

**Use Plugins When**:
- Task matches plugin specialization
- Need guided, multi-step workflows
- Require domain expertise (security, design, testing)
- Working on complex features requiring planning

**Use Direct Tools When**:
- Simple, one-off operations
- Quick file reads/edits
- Ad-hoc bash commands
- Exploratory codebase navigation

### Proactive Plugin Invocation

Claude should **automatically invoke** plugins when:
1. **frontend-design**: User mentions "design", "UI", "redesign", "improve appearance"
2. **security-guidance**: User mentions "auth", "payment", "security", before deployment
3. **playwright**: After implementing new UI features
4. **feature-dev**: User requests new features (not bug fixes)
5. **github**: User says "create PR", "open issue"
6. **linear**: User asks "what to work on", references issue numbers

### Plugin Composition

**Combine plugins** for complex workflows:
- `feature-dev` + `security-guidance`: Secure feature implementation
- `frontend-design` + `playwright`: Design + test new UI
- `linear` + `github`: Issue-driven development with PRs
- `typescript-lsp` + `feature-dev`: Type-safe architecture planning

---

## Success Metrics

### Plugin Effectiveness Tracking

1. **Code Quality**
   - Reduced security vulnerabilities (security-guidance)
   - Higher test coverage (playwright)
   - Fewer type errors (typescript-lsp)

2. **Development Speed**
   - Faster feature development (feature-dev)
   - Reduced PR review cycles (github)
   - Better task prioritization (linear)

3. **Design Quality**
   - Improved UI consistency (frontend-design)
   - User feedback on redesigns

4. **Process Efficiency**
   - Fewer context switches (context7)
   - Better multi-agent coordination
   - Streamlined workflows

### Review Cadence

- **Weekly**: Plugin usage analysis, identify underutilized plugins
- **Bi-weekly**: Workflow optimization, cross-plugin coordination
- **Monthly**: Success metrics review, plugin configuration updates

---

## Next Steps

1. **User Decision**: Review this plan, prioritize which plugins to integrate first
2. **Configuration**: Set up API tokens (Linear, GitHub, HuggingFace)
3. **Testing**: Run through example workflows for each plugin
4. **Documentation**: Update CLAUDE.md with plugin usage patterns
5. **Training**: Practice optimal plugin invocation for various scenarios

**Ready to proceed?** Let's start with Phase 1 plugins or pick specific integrations to implement.
