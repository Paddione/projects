# Contributing to Patrick's Projects

Welcome! Thanks for your interest in contributing to this monorepo. Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

## Development Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x | Required for all services |
| npm | 10.x+ | Ships with Node 22 |
| Docker | 24+ | For container builds |
| k3s / kubectl | Latest | Only needed for infrastructure work |
| Git | 2.40+ | For conventional commits tooling |

## Getting Started

```bash
# Clone the repo
git clone git@github.com:Paddione/projects.git
cd projects

# Install root dependencies
npm install

# Install all service dependencies
npm run install:all

# Start a single service (pick one)
npm run dev:l2p
npm run dev:arena
npm run dev:videovault
npm run dev:shop
npm run dev:sos
```

Each service has its own README with service-specific setup. Check the table in the root [README.md](README.md) for links.

## Branch Naming Conventions

All branches must use one of these prefixes:

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, dependency updates |
| `docs/` | Documentation changes |

Examples:
- `feat/l2p-lobby-chat`
- `fix/auth-token-refresh`
- `chore/bump-vitest`
- `docs/arena-websocket-events`

## Commit Message Format (Conventional Commits)

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via commitlint in CI. Every commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Maintenance, deps, configs |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvements |

### Scopes

Scope should match the service or area you're changing:

`l2p`, `arena`, `auth`, `shop`, `videovault`, `sos`, `assetgenerator`, `k8s`, `docs`, `ci`, `deps`, `root`

### Examples

```bash
# Feature in L2P
git commit -m "feat(l2p): add lobby chat with Socket.io events"

# Bug fix in auth
git commit -m "fix(auth): refresh token rotation not clearing old tokens"

# CI change
git commit -m "ci(ci): add Trivy dependency scanning to pipeline"

# Documentation update
git commit -m "docs(arena): document WebSocket event payload shapes"

# Dependency update
git commit -m "chore(deps): bump vitest to 2.1.0 across all services"

# Refactor with body
git commit -m "refactor(videovault): extract filter engine into standalone module

Moves filter logic out of the SvelteKit load function into a pure
utility so it can be unit tested independently."
```

## Pull Request Process

1. **Create a branch** from `master` using the naming convention above
2. **Make your changes** with conventional commit messages
3. **Run tests** for the services you changed:
   ```bash
   cd l2p && npx vitest run        # L2P tests
   cd auth && npx vitest run       # Auth tests
   cd VideoVault && npx vitest run # VideoVault tests
   cd shop && npx vitest run       # Shop tests
   ```
4. **Push your branch** and open a PR against `master`
5. **Fill out the PR template** — it will be pre-populated when you create the PR
6. **CI must pass** before your PR can be merged. The pipeline runs type checks, unit tests, Docker build validation, and security scans automatically.

## Changesets (Versioning)

When your PR includes user-facing changes, add a changeset:

```bash
npx changeset
```

Follow the prompts to describe what changed. The changeset file is committed with your PR and used to automate versioning and changelogs.

## Code Style

- **TypeScript** is used across all services with strict mode where applicable
- **ESLint** rules are configured per service — run `npm run lint` in the relevant service directory
- Follow existing patterns in the service you're modifying
- Prefer small, targeted changes over sweeping refactors

## CI Must Pass

All PRs require the CI pipeline to pass before merge. The pipeline includes:
- Type checking and unit tests (per service, only for changed services)
- Docker build validation (master only)
- Kubernetes manifest validation
- Commitlint (conventional commits)
- GitLeaks (secret scanning)
- Semgrep (SAST)
- Trivy (dependency vulnerability scanning)

## Security Issues

**Do not open public issues for security vulnerabilities.** Please see [SECURITY.md](SECURITY.md) for responsible disclosure instructions.
