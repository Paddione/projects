# Agent Coordination Guidelines

Rules for AI agents working in this repository. For full command references and architecture details, see CLAUDE.md and README.md.

## Task Management

Before starting work:
1. Check `.agent-tasks.md` at repo root
2. Add a task entry: `[YYYY-MM-DD HH:MM] [project] [STATUS] Description`
3. Update status between major steps; mark `[DONE]` immediately when complete

Status values: `IN_PROGRESS`, `BLOCKED`, `DONE`

Example:
```
[2025-12-27 14:30] [l2p] [IN_PROGRESS] Adding profile feature (frontend/src/components/Profile.tsx)
```

## Project Isolation

- Work in different projects or different subsystems when possible
- Avoid simultaneous edits to the same file
- Keep changes scoped to a single service unless the feature explicitly spans multiple apps

### Critical Sections (Exclusive Access Required)

- Git operations (commit, merge, branch)
- Docker operations (rebuild, restart containers)
- Database migrations
- Dependency updates
- Root-level config changes
- Deployments

If a critical section is in use, mark your task `[BLOCKED]` and yield.

## Coding Style

- TypeScript across projects; follow each project's ESLint config
- VideoVault uses Prettier; other projects rely on ESLint
- 2-space indentation, single quotes where the codebase uses them
- React components: `PascalCase`; hooks: `useThing`; tests: `__tests__/`, `test/`, or `e2e/`

## Commit and PR Guidelines

- Short, imperative commit messages with project name when targeting a single service
- Conventional prefixes: `feat:`, `fix:`, `chore:`
- PRs should list affected services, summarize changes, note tests run, and include screenshots for UI updates

## Testing

- Run the smallest relevant test suite for your change
- If tests are skipped, state why
- Do not skip tests silently

## Communication

- Provide a concise summary of work done
- List files modified
- Include commands run and assumptions made

## Scope Rules

- Confirm the target project before making changes
- Read the relevant project CLAUDE.md or README before changes
- Prefer small, targeted edits over sweeping refactors
- Do not add dependencies, run migrations, or change infrastructure without explicit approval
- Keep secrets out of the repo
- Update existing docs rather than creating new ones
