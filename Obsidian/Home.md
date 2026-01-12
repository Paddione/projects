# Monorepo Vault

Comprehensive documentation for the monorepo with visual architecture diagrams, testing strategies, and deployment guides.

## Quick Start
- [[Repository Index]] - All services at a glance
- [[Operations]] - Common day-to-day commands
- [[Environment & Secrets]] - Environment setup guide

## First-Time Setup
1. Install prerequisites: Node.js (LTS), npm, Docker Desktop/Engine.
2. From the monorepo root, run `./scripts/start-all-services.sh`.
3. Confirm services are healthy with `./scripts/health-check.sh`.
4. Open the repo-specific page in `Repos/` for app URLs and local workflows.

## Architecture Documentation
- [[Architecture Overview]] - System architecture with visual diagrams
- [[Database Architecture]] - Centralized PostgreSQL architecture
- [[Testing Strategy]] - Testing approach across all services
- [[Deployment Architecture]] - Development and production deployment

## Individual Services
- [[Repos/l2p|Learn2Play (L2P)]] - Multiplayer quiz platform
- [[Repos/VideoVault|VideoVault]] - Client-first video management
- [[Repos/payment|Payment]] - Stripe payment integration
- [[Repos/vllm|VLLM]] - MCP server for AI inference
- [[Repos/auth|Auth]] - Centralized authentication
- [[Repos/reverse-proxy|Reverse Proxy]] - Traefik routing
- [[Repos/shared-infrastructure|Shared Infrastructure]] - Centralized Postgres

## Additional Resources
- [[Docs Library]] - Link to consolidated documentation
- [[Doc Update Checklist]] - Checklist for writing or updating docs
- [[Repos/shared-design-system|Design System]] - Shared CSS and accessibility
- [[Repos/shared-postgres-mcp|Postgres MCP]] - MCP server for database access
- [[Repos/browser-control|Browser Control]] - Playwright helpers
- [[Repos/scripts|Scripts]] - Utility scripts
- [[Repos/docs|Docs]] - Additional documentation
- [[Repos/logs|Logs]] - Runtime logs

## How to Navigate
- **Search**: Use the search bar in Obsidian (Ctrl/Cmd + O) for quick lookup
- **Visual Diagrams**: All architecture pages include Mermaid diagrams
- **Code Examples**: Copy-ready commands throughout
- **Cross-links**: Follow internal links to explore related topics

## Documentation Conventions
- Each service has a dedicated page in `Repos/`.
- Use `[[Wiki Links]]` for navigation across this vault.
- Commands assume you are in the monorepo root unless noted.
- Architecture pages favor diagrams, while service pages focus on workflows.

## Key Features
- **Visual Architecture**: System diagrams, data flows, and sequence diagrams
- **Testing Guides**: Complete testing strategies with examples
- **Deployment Guides**: Step-by-step deployment instructions
- **Troubleshooting**: Common issues and solutions
- **API References**: Endpoint documentation for each service

## Windows Access
- Open Obsidian and choose **Open folder as vault**
- If this repo is in WSL, the typical Windows path is:
  - `\\wsl$\\<YourDistro>\\home\\patrick\\projects\\Obsidian`
- If the repo is on a Linux-only host, sync or copy `Obsidian/` to a Windows-accessible folder, then open that folder as a vault

## Documentation Structure
```
Obsidian/
├── Home.md (you are here)
├── Architecture Overview.md
├── Database Architecture.md
├── Testing Strategy.md
├── Deployment Architecture.md
├── Repository Index.md
├── Operations.md
├── Environment & Secrets.md
├── Docs Library.md
└── Repos/
    ├── l2p.md
    ├── VideoVault.md
    ├── payment.md
    ├── vllm.md
    ├── auth.md
    └── ...
```
