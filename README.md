# Patrick's Projects Monorepo

A collection of independent full-stack applications sharing centralized PostgreSQL infrastructure.

## Projects Overview

| Project | Description | Tech Stack | Port(s) |
|---------|-------------|------------|---------|
| [Learn2Play (l2p)](./l2p/README.md) | Multiplayer quiz platform | React, Express, Socket.io, PostgreSQL | 3000, 3001 |
| [VideoVault](./VideoVault/README.md) | Client-first video management | React, Vite, File System Access API | 5100 (dev), 5000 (k8s) |
| [Payment](./payment/README.md) | Payment platform with Stripe | Next.js 16, Prisma, NextAuth v5 | 3004 |
| [Auth](./auth/README.md) | Unified authentication service | Express, JWT, OAuth, PostgreSQL | 5500 |
| [Shared Infrastructure](./shared-infrastructure/README.md) | Centralized Postgres + shared assets | PostgreSQL, Docker | 5432 |
| Obsidian | Architecture docs, runbooks, service guides | Obsidian, Markdown, SVG diagrams | — |

## Quick Start

### Prerequisites

- Node.js (LTS)
- Docker and Docker Compose
- k3d (for Kubernetes deployments)

### Setup

```bash
# Install dependencies and seed env files
./scripts/setup.sh

# Start all services
npm run dev:all
```

### Per-Service Development

```bash
cd l2p && npm run dev:backend && npm run dev:frontend   # Ports 3000, 3001
cd VideoVault && npm run dev                            # Port 5100
cd payment && npm run dev                               # Port 3004
```

## Environment Setup

Each service follows a standard layout:

```
.env.example      # Template (committed)
.env-dev          # Development (gitignored)
.env-prod         # Production (gitignored)
```

Rules:
- Never commit `.env-dev` or `.env-prod`
- Use alphanumeric-only database passwords (avoid Docker/Postgres escaping issues)
- Secrets must be unique per environment

Generate secrets:
```bash
# JWT/session secrets
openssl rand -hex 32

# Alphanumeric DB passwords
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32 && echo
```

Validate environment files:
```bash
npm run validate:env
npm run validate:env:dev
npm run validate:env:prod
```

### API Keys

- Google Gemini AI: https://makersuite.google.com/app/apikey
- Stripe: https://dashboard.stripe.com
- Google OAuth: https://console.cloud.google.com/apis/credentials
- Hugging Face: https://huggingface.co/settings/tokens

## Deployment

### Kubernetes (k3d)

```bash
# Create local k3d cluster
./k8s/scripts/cluster/k3d-create.sh

# Generate secrets from root .env
./k8s/scripts/utils/generate-secrets.sh

# Deploy everything (namespaces → secrets → infra → services)
./k8s/scripts/deploy/deploy-all.sh

# Validate cluster health
./k8s/scripts/utils/validate-cluster.sh
```

Individual service deployment:
```bash
./k8s/scripts/deploy/deploy-postgres.sh     # PostgreSQL
./k8s/scripts/deploy/deploy-traefik.sh      # Traefik ingress
./k8s/scripts/deploy/deploy-nfs.sh          # NFS provisioner
./k8s/scripts/deploy/deploy-auth.sh         # Auth service
./k8s/scripts/deploy/deploy-l2p.sh          # L2P backend + frontend
./k8s/scripts/deploy/deploy-payment.sh      # Payment service
./k8s/scripts/deploy/deploy-videovault.sh   # VideoVault
```

Smart redeployment of only changed services:
```bash
./k8s/scripts/deploy/deploy-changed.sh              # Auto-detect and redeploy
./k8s/scripts/deploy/deploy-changed.sh --dry-run     # Preview what would deploy
```

Each service has exactly one production environment and one development environment. All deployments follow patterns defined in the k8s manifests.

### Key Deployment Docs

- [k8s/README.md](./k8s/README.md) - Kubernetes deployment guide
- [k8s/services/README.md](./k8s/services/README.md) - Service routing and ports
- [k8s/infrastructure/README.md](./k8s/infrastructure/README.md) - Infra components (Traefik, Postgres, SMB, NFS)
- [k8s/secrets/README.md](./k8s/secrets/README.md) - Secrets generation and handling
- [k8s/scripts/README.md](./k8s/scripts/README.md) - Cluster and deploy scripts

## Common Commands

```bash
# Build all services
npm run build:all

# Run all tests
npm run test:all

# Type check all projects
npm run typecheck:all

# Per-service tests
cd l2p && npm run test:all
cd VideoVault && npm test
cd payment && npm test
```

## Repository Structure

```
.
├── auth/                      # Auth service
├── k8s/                       # Kubernetes manifests and scripts
├── l2p/                       # Learn2Play quiz platform
│   ├── frontend/
│   └── backend/
├── payment/                   # Payment service (Next.js)
├── shared-infrastructure/     # Centralized Postgres + shared assets
│   └── shared/                # Design system, MCP tooling, per-service packages
├── VideoVault/                # VideoVault app
│   ├── client/
│   ├── server/
│   └── e2e/
├── Obsidian/                  # Architecture docs, runbooks, SVG diagrams (Obsidian vault)
├── Notion/                    # Notion-compatible mirror of Obsidian vault
├── scripts/                   # Root automation scripts
├── AGENTS.md                  # Multi-agent coordination guidelines
├── CLAUDE.md                  # Claude Code guidance
└── README.md
```

## Contributing

### Coding Style

- TypeScript across all projects; follow each project's ESLint config
- VideoVault uses Prettier (`VideoVault/.prettierrc.json`); other projects rely on ESLint
- 2-space indentation, single quotes where the codebase uses them
- React components in `PascalCase`, hooks as `useThing`

### Testing

- L2P: Jest unit/integration under `l2p/**/__tests__`, Playwright E2E under `l2p/frontend/e2e/`
- VideoVault: Vitest unit tests in `VideoVault/client/src/**.test.ts`, Playwright E2E in `VideoVault/e2e/`
- Payment: Vitest + Playwright in `payment/test/`
- Add or update tests with every functional change
- Prefer unit tests for logic, integration tests for service boundaries, E2E for workflows

### Commits and Pull Requests

- Short, imperative commit messages; include project name when targeting a single service
- Conventional commit prefixes recommended: `feat:`, `fix:`, `chore:`
- PRs should list affected services, summarize changes, note tests run, and include screenshots for UI updates

## Security

1. Never commit `.env-dev` or `.env-prod`
2. Use strong, unique secrets per environment
3. Keep DB passwords alphanumeric only
4. Store API keys in a password manager or secrets store
5. Rotate production secrets regularly

### Env Backup

```bash
tar -czf env-backup-$(date +%Y%m%d).tar.gz \
  shared-infrastructure/.env-prod \
  auth/.env-{dev,prod} \
  l2p/.env-{dev,prod} \
  VideoVault/.env-{dev,prod} \
  payment/.env-{dev,prod}
```

## Production URLs

- **Auth**: https://auth.korczewski.de
- **L2P**: https://l2p.korczewski.de
- **Payment**: https://payment.korczewski.de (alias: https://shop.korczewski.de)
- **VideoVault**: https://videovault.korczewski.de (alias: https://video.korczewski.de)
- **Traefik**: https://traefik.korczewski.de

## Troubleshooting

- If Postgres connections fail: verify `shared-infrastructure` is running and env passwords match
- If env vars are ignored: check file names and restart services
- If Docker can't find env files: use `docker-compose --env-file .env-prod up`
