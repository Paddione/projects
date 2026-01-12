# Repository Index

A quick map of what lives in this monorepo. Click a repo name to open its page.

| Repo | Purpose | Stack | Ports |
| --- | --- | --- | --- |
| [[Repos/l2p|Learn2Play (l2p)]] | Multiplayer quiz platform | React, Express, Socket.io, PostgreSQL | 3000, 3001 |
| [[Repos/VideoVault|VideoVault]] | Client-first video management | React, Vite, File System Access API | 5100/5000 |
| [[Repos/payment|Payment]] | Payment platform with Stripe | Next.js 16, Prisma, NextAuth | 3004 |
| [[Repos/vllm|VLLM]] | MCP server for AI inference and analysis | TypeScript, vLLM, PostgreSQL | 4100 |
| [[Repos/auth|Auth]] | Unified authentication service | Node, JWT, OAuth, PostgreSQL | 5500 |
| [[Repos/reverse-proxy|Reverse Proxy]] | Traefik routing and TLS | Traefik, Docker | 443/80 |
| [[Repos/shared-infrastructure|Shared Infrastructure]] | Centralized Postgres | PostgreSQL, Docker | 5432 |
| [[Repos/shared-postgres-mcp|Shared Postgres MCP]] | MCP server for Postgres access | TypeScript, pg | - |
| [[Repos/shared-design-system|Shared Design System]] | CSS + accessibility references | CSS, Markdown | - |
| [[Repos/browser-control|Browser Control]] | Playwright helper scripts | Node, Playwright | - |
| [[Repos/docs|Docs]] | Consolidated documentation | Markdown | - |
| [[Repos/scripts|Scripts]] | Root utility scripts | Bash | - |
| [[Repos/logs|Logs]] | Local runtime logs | Text | - |

## Root files
- `README.md` is the canonical overview.
- `CLAUDE.md` contains working conventions for agents.
- `package.json` lists root-level scripts.
