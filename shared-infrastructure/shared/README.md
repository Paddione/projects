# Shared Resources

This folder consolidates cross-service assets that used to live in separate `shared*` directories at the repo root or inside services.

## Contents

- `design-system/` - Global CSS design system and accessibility references.
- `postgres-mcp/` - MCP server that brokers access to the shared Postgres instance.
- `l2p/` - L2P shared tooling (test-config, error-handling, test-utils).
- `videovault/` - VideoVault shared schemas, errors, and API types.
- `videovault-design-system/` - Legacy VideoVault-specific CSS bundle.

## Usage

- Services reference these resources directly via relative paths or aliases.
- Docker builds mount or copy these paths into the container at `shared-infrastructure/shared/...`.
- Keep shared code here in sync with service-level imports and build configs.
- VideoVault relies on a `VideoVault/shared-infrastructure` symlink to resolve shared modules during Vite builds.
