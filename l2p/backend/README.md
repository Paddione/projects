# Learn2Play Backend

Express + TypeScript API for Learn2Play. This service exposes REST + Socket.IO endpoints, manages authentication, and coordinates PostgreSQL storage.

## Quick Start

```bash
# install workspace deps
npm --prefix backend install

# run dev server with tsx (reloads on change)
npm --prefix backend run dev:tsx

# run standard build + start
npm --prefix backend run build && npm --prefix backend start
```

## Directory Layout

```
backend/src
├── routes/         # HTTP endpoints (auth, admin, lobbies, etc.)
├── services/       # Domain logic (AuthService, LobbyService, ...)
├── repositories/   # Data access abstractions
├── middleware/     # Express middleware (auth, validation, logging)
├── cli/            # tsx-powered scripts (migrations, tooling)
├── health/         # Health-check helpers
├── __tests__/      # Jest unit + integration specs
└── utils/, types/  # Shared helpers and type declarations
```

More global context lives in `../docs/PROJECT_STRUCTURE.md`.

## Common Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev:tsx` | Start Express via tsx with live reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Serve compiled build |
| `npm run test:unit` | Jest unit suite |
| `npm run test:integration` | Jest integration suite (Supertest) |
| `npm run db:migrate` | Run database migrations via CLI tooling |

## Testing

Integration tests boot the real Express app and hit routes through Supertest. Ensure Postgres is available (see `jest.setup.integration.mjs` for the expected `DATABASE_URL`). Run:

```bash
npm --prefix backend run test:unit
npm --prefix backend run test:integration
```

## Conventions

- Keep new HTTP endpoints under `src/routes` and wire them into `src/server.ts`.
- Put non-trivial logic in `src/services` to keep routes thin.
- Access the database only through repositories.
- Store tests under `src/__tests__` (unit) or `src/__tests__/integration`.

## Related Docs

- [Project Structure](../docs/PROJECT_STRUCTURE.md)
- [Contributing & Placement Rules](../docs/CONTRIBUTING.md)
