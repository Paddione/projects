# Shared Postgres MCP

## Purpose
MCP server for connecting to Postgres (shared database tooling).

## Stack
TypeScript, @modelcontextprotocol/sdk, pg.

## Quick Start
```bash
cd shared-infrastructure/shared/postgres-mcp
npm run build
npm run start
```

## Key folders
- `shared-infrastructure/shared/postgres-mcp/src/` - TypeScript source
- `shared-infrastructure/shared/postgres-mcp/build/` - compiled output

## Build
```bash
cd shared-infrastructure/shared/postgres-mcp
npm run build
```

## Run
```bash
cd shared-infrastructure/shared/postgres-mcp
npm run start
```

## Key Scripts
- `npm run build` - compile TypeScript
- `npm run start` - start MCP server

## Ports
- MCP transport: stdio
