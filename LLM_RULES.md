# LLM Rules

Read this file first before making changes. It applies to any LLM working in this repository.

## Scope & Context

- This is a monorepo with independent projects: `l2p/`, `VideoVault/`, `payment/`, `vllm/`.
- Confirm the target project and work only in its directory unless asked otherwise.
- After this file, read the relevant project README and `CLAUDE.md` for deeper details.

## Multi-Agent Task Coordination

When multiple agents work simultaneously in this repository, follow these coordination rules:

### Task Declaration
- Before starting work, check if `.agent-tasks.md` exists at repository root
- If it exists, read it to see what other agents are working on
- Add your task with: timestamp, project scope, brief description, and status
- Format: `[YYYY-MM-DD HH:MM] [project-name] [IN_PROGRESS|BLOCKED|DONE] Description`
- Remove or mark tasks as DONE when completed

### Project-Level Isolation
- **Preferred**: Work in different projects to minimize conflicts (e.g., Agent A on `l2p/`, Agent B on `VideoVault/`)
- If working in the same project, coordinate on different subsystems (e.g., frontend vs backend, different features)
- Avoid simultaneous edits to the same file; check task file for file-level conflicts

### Critical Sections (Require Exclusive Access)
These operations should NOT be performed simultaneously by multiple agents:
- **Git operations**: commits, branch operations, merges (coordinate via task file)
- **Docker operations**: rebuilding/restarting containers, docker-compose changes
- **Database migrations**: schema changes, migration runs (per-project databases are safer)
- **Dependency updates**: package.json, requirements.txt modifications
- **Root-level changes**: setup scripts, shared configs, monorepo infrastructure
- **Deployments**: production deployments, environment changes

Before performing a critical operation:
1. Check `.agent-tasks.md` for conflicting operations
2. Declare your intent to perform the operation
3. Wait a moment (if interactive) or proceed cautiously
4. Update status when complete

### Conflict Resolution
- If you detect a potential conflict, add `[BLOCKED]` status and describe the blocker
- Prefer yielding to an agent already in progress on a critical operation
- Communicate conflicts to the user if resolution is unclear
- After completing a blocking operation, check if any other agent was blocked and could proceed

### Status Communication
- Update your task status in `.agent-tasks.md` when transitioning between major steps
- Mark tasks `[DONE]` immediately upon completion
- Include relevant output (e.g., "tests passing", "container restarted", "migration applied")

### Example Task File Entry
```markdown
[2025-12-27 14:30] [l2p] [IN_PROGRESS] Adding user profile feature (frontend/src/components/Profile.tsx)
[2025-12-27 14:35] [vllm] [DONE] Updated MCP server configuration, container restarted
[2025-12-27 14:40] [l2p] [BLOCKED] Waiting for Git commit to complete before running migrations
```

## Change Discipline

- Prefer small, targeted edits; avoid sweeping refactors or mass formatting.
- Match existing patterns, linting, and formatting rules in the touched project.
- Do not add new dependencies, run migrations, or change infra without explicit approval.
- Keep secrets out of the repo; use `.env.example` as the template.
- If a change requires reloading a component (e.g., Docker container), reload it afterwards and verify the update took effect.
- Use existing documentation files (README.md, CLAUDE.md, AGENTS.md, etc.) instead of creating new ones; update existing docs rather than fragmenting information.

## Safety & Reliability

- Avoid destructive operations unless explicitly requested.
- If a task risks breaking behavior, add or update tests alongside the change.
- When unsure about behavior or scope, ask a short clarifying question.

## Testing Expectations

- Run the smallest relevant test suite for the change (project-specific).
- If tests are not run, state that clearly and explain why.

## Communication

- Provide a concise summary and list of files modified.
- Include commands run and notable assumptions.
- Link to specific files when referencing changes.
