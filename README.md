# Korczewski Projects

Monorepo containing independent full-stack applications sharing centralized PostgreSQL infrastructure, deployed to a bare-metal k3s cluster.

## Services

| Service | Description | Stack | Ports | Docs |
|---------|-------------|-------|-------|------|
| [L2P](l2p/) | Multiplayer quiz platform | React, Express, Socket.io, Drizzle | 3000, 3001 | [README](l2p/README.md) |
| [Arena](arena/) | Battle royale game | React, PixiJS, Express, Socket.io, Drizzle | 3002, 3003 | [README](arena/README.md) |
| [VideoVault](VideoVault/) | Video management app | React, Vite, Express, File System Access API | 5100/5000 | [README](VideoVault/README.md) |
| [Shop](shop/) | E-commerce platform | Next.js 16, Prisma, Stripe | 3004 | [README](shop/README.md) |
| [Auth](auth/) | Unified authentication | Express, Passport.js, JWT/OAuth | 5500 | [README](auth/README.md) |
| [SOS](SOS/) | Mental health companion | Express, Static HTML | 3005 | [README](SOS/README.md) |
| [Assetgenerator](Assetgenerator/) | AI asset generation | Express, WebSocket, GPU worker | 5200 | [README](Assetgenerator/README.md) |

## Infrastructure

| Component | Description | Docs |
|-----------|-------------|------|
| [DB](DB/) | Centralized PostgreSQL init and management scripts | — |
| [k8s](k8s/) | Kubernetes manifests and deploy scripts | [README](k8s/README.md) |
| [SMB-Symlinks](SMB-Symlinks/) | SMB share symlinks for NAS storage | [README](SMB-Symlinks/README.md) |

## Production URLs

| Service | URL |
|---------|-----|
| L2P | https://l2p.korczewski.de |
| Arena | https://arena.korczewski.de |
| Shop | https://shop.korczewski.de |
| VideoVault | https://videovault.korczewski.de |
| Auth | https://auth.korczewski.de |
| SOS | https://sos.korczewski.de |
| Assetgenerator | https://assetgen.korczewski.de |
| Traefik | https://traefik.korczewski.de |
| Registry | https://registry.korczewski.de |

## Documentation

Detailed documentation lives in [`docs/`](docs/README.md):

- **[Architecture](docs/architecture/)** -- System design, networking, database, storage
- **[Guides](docs/guides/)** -- Getting started, testing, deployment, environment variables
- **[Infrastructure](docs/infrastructure/)** -- Kubernetes, CI/CD, registry, secrets, PXE boot
- **[Services](docs/services/)** -- Per-service deep dives (only what's unique to each)

## Quick Start

```bash
# 1. Clone and install
npm run install:all

# 2. Start PostgreSQL (see DB/ for init scripts)
# Production uses k8s StatefulSet; local dev uses existing PostgreSQL instance

# 3. Start any service
npm run dev:l2p          # L2P frontend + backend
npm run dev:arena        # Arena frontend + backend
npm run dev:videovault   # VideoVault
npm run dev:shop         # Shop
npm run dev:sos          # SOS
```

See [Getting Started](docs/guides/getting-started.md) for the full setup guide.

## Common Commands

```bash
# Development
npm run dev:all              # Start all services

# Build & Test
npm run build:all            # Build all services
npm run test:all             # Run all test suites
npm run typecheck:all        # Type check all projects

# Deployment (k3s)
./k8s/scripts/deploy/deploy-all.sh            # Full stack deploy
./k8s/scripts/deploy/deploy-changed.sh        # Auto-detect and redeploy changes
./k8s/scripts/utils/deploy-tracker.sh status  # Check deploy state
```

See [Deployment Guide](docs/guides/deployment.md) for the full reference.
