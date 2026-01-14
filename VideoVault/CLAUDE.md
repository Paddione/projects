# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

VideoVault is a client-first video management application with advanced filtering, bulk operations, and professional-grade organization features. Built with React, TypeScript, Vite, and optional PostgreSQL persistence.

**Key constraint**: Requires Chromium-based browsers for File System Access API. File handles are session-based; rescan required after browser reload.

## Common Commands

### Development

```bash
# Local development (port 5100)
npm run dev

# Docker development with hot reload (port 5000)
npm run docker:dev
npm run docker:down          # Stop environment
npm run docker:restart       # Restart environment
npm run docker:logs          # View logs
```

### Testing

```bash
# Full 6-stage test pipeline (recommended before deploy)
npm run test:all             # All stages: types → unit → integration → e2e → build → health

# Individual test stages
npm run test:1:types         # Stage 1: TypeScript type checking
npm run test:2:unit          # Stage 2: Unit tests (client + server)
npm run test:3:integration   # Stage 3: Integration tests
npm run test:4:e2e           # Stage 4: Playwright E2E tests
npm run test:5:build         # Stage 5: Production build
npm run test:6:health        # Stage 6: Health check

# Run specific test suites
npm run test:client          # Client-side tests only
npm run test:server          # Server-side tests only
npm run test:e2e             # Integration tests only
npm run docker:pw:all        # Playwright E2E tests only

# Run single test file
npx vitest run client/src/services/VideoDatabase.test.ts
FAST_TESTS=1 npx vitest run client/src/services/filter-engine.test.ts
```

**See [TESTING.md](./TESTING.md) for detailed testing guide and troubleshooting.**

### Build & Production

```bash
# Type checking
npm run check

# Build for production
npm run build

# Start production server
npm run start
```

## Architecture & Code Organization

### Client-First Architecture

VideoVault uses a **client-first** approach where the browser is the primary data store:
- **localStorage**: Primary persistence for video metadata
- **File System Access API**: Direct file access (Chromium browsers only)
- **Session-based handles**: File handles lost on reload, require rescan
- **Optional Postgres**: Server-side persistence for shared libraries

### Directory Structure

```
client/src/
  ├── components/         # React components (PascalCase)
  ├── hooks/              # Custom React hooks (useThing naming)
  │   └── use-video-manager.ts  # Central orchestration hook
  ├── pages/              # Route-level screens
  ├── services/           # Core business logic
  │   ├── video-database.ts           # localStorage persistence
  │   ├── file-scanner.ts             # Directory scanning
  │   ├── filter-engine.ts            # Standard filtering
  │   ├── enhanced-filter-engine.ts   # Advanced filtering (stubbed in tests)
  │   ├── bulk-operations.ts          # Multi-select operations
  │   ├── thumbnail-generator.ts      # Thumbnail generation
  │   ├── filesystem-ops.ts           # File operations
  │   ├── rename-engine.ts            # Batch rename logic
  │   └── directory-database.ts       # Directory metadata
  ├── test/               # Test setup and mocks
  └── types/              # TypeScript types

server/
  ├── routes/             # Express route handlers
  │   ├── persistence.ts   # Video/root/preset CRUD
  │   ├── errors.ts        # Error tracking
  │   ├── db.ts            # Database health
  │   ├── settings.ts      # App settings
  │   ├── thumbnails.ts    # Thumbnail generation
  │   ├── duplicates.ts    # Duplicate detection
  │   └── tag-ops.ts       # Tag management
  ├── middleware/         # Express middleware
  ├── lib/                # Server utilities
  └── routes.ts           # Route registration

shared-infrastructure/shared/videovault/
  ├── errors.ts           # Error codes and schemas
  ├── api.ts              # API payload schemas (Zod)
  └── ...                 # Other shared types

e2e/
  ├── playwright/         # Playwright E2E tests
  │   ├── bulk-and-filter.spec.ts
  │   ├── grid-performance.spec.ts
  │   ├── selection-workflows.spec.ts
  │   └── undo-operations.spec.ts
  └── server.*.e2e.test.ts  # Server E2E tests (Vitest)
```

### Core Services & Patterns

#### useVideoManager Hook
Central orchestration hook that coordinates all services. External components should interact with VideoVault through this hook's API rather than calling services directly.

**Key responsibilities**:
- Manages global video state
- Coordinates scanning, filtering, sorting
- Handles bulk operations
- Maintains scan state for multiple roots
- Provides undo/redo functionality

#### Service Layer Architecture

**VideoDatabase** (`video-database.ts`):
- localStorage-based metadata persistence
- Manages video records, categories, custom fields
- Provides CRUD operations for videos

**FileScanner** (`file-scanner.ts`):
- Directory scanning with concurrency control
- Uses `navigator.hardwareConcurrency` for parallel processing
- Handles permission errors, cancellation

**FilterEngine** (`filter-engine.ts`):
- Standard filtering: categories, search, date, size, duration
- Combines multiple filter types
- High test coverage requirement (90%+)

**EnhancedFilterEngine** (`enhanced-filter-engine.ts`):
- Advanced instant search with FlexSearch
- **Testing note**: Stubbed in tests via `vitest.config.ts` aliases to avoid heavy dependencies

**BulkOperationsService** (`bulk-operations.ts`):
- Multi-select video operations
- Batch category assignment, rename, move, delete
- Conflict handling and undo support

**ThumbnailGenerator** (`thumbnail-generator.ts`):
- On-demand thumbnail generation
- Worker-based encoding (OffscreenCanvas with fallback)
- Not persisted to avoid quota issues

**FilesystemOps** (`filesystem-ops.ts`):
- File/folder create, move, delete operations
- Uses File System Access API
- Conflict detection and resolution

**RenameEngine** (`rename-engine.ts`):
- Batch rename with patterns (prefix, suffix, numbering, case)
- Category-based filename generation
- High test coverage requirement (95%+)

**DirectoryDatabase** (`directory-database.ts`):
- Directory-level metadata and permissions
- Tracks scanned roots and hierarchies
- High test coverage requirement (95%+)

### Path Aliases

**Critical**: Always use path aliases for imports:
```typescript
import { VideoDatabase } from '@/services/video-database';
import { ErrorCodes } from '@shared/errors';
```

**Configured in**:
- `tsconfig.json` → `paths`
- `vite.config.ts` → `resolve.alias`
- `vitest.config.ts` → `resolve.alias` (includes test stubs)

**Shared path**: `VideoVault/shared-infrastructure` is a symlink to `../shared-infrastructure` so `@shared` and `@design-system` resolve with their dependencies during local and Docker builds.

## Testing Strategy

### Test Configuration

**vitest.config.ts**:
- **Test aliases**: Enhanced services are stubbed to avoid heavy FlexSearch/WebCodecs dependencies
- **Single-threaded**: `singleThread: true` to avoid race conditions
- **Bail on failure**: `bail: 1` for faster feedback
- **Coverage thresholds**: Per-file thresholds for core services (85-95%)

**Test setup**: `client/src/test/setup.ts`
- Mocks localStorage
- Mocks File System Access API
- Provides test utilities

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run single file
npm run test -- client/src/services/filter-engine.test.ts

# Fast mode (skips slow tests)
FAST_TESTS=1 npm test

# Watch mode
npm run test:watch
```

### Playwright E2E Tests

**Docker-based** (recommended):
```bash
# Full suite
npm run docker:pw:all

# Interactive UI
npm run docker:pw:ui  # http://localhost:9323
```

**Test environment**:
- Uses `videovault-dev` service on `l2p-network`
- Base URL: `http://videovault-dev:5000`
- Playwright version: `v1.55.0-jammy` (pinned)
- Test artifacts in container (not bind-mounted)

**Local Playwright**:
```bash
npm run test:pw
npm run test:pw:ui
```

### Coverage Requirements

**Core services** (high coverage required):
- `filter-engine.ts`: 90%+ branches, 95%+ functions/lines/statements
- `rename-engine.ts`: 85%+ branches, 95%+ functions/lines/statements
- `directory-database.ts`: 90%+ branches, 95%+ functions/lines/statements
- `video-database.ts`: 85%+ branches, 95%+ functions/lines/statements

**Excluded from coverage**:
- `components/ui/**` (auto-generated shadcn components)
- `components/admin/**`, `components/layout/**`, `pages/**`
- Enhanced services (tested via integration)
- Web workers

## Environment Configuration

### File Structure

```
.env.example                # Template
.env-dev                    # Development (not committed)
.env-prod                   # Production (not committed)
env/.env-postgres           # Postgres credentials
env/.env-app.local          # Local development overrides
env/.env-playwright         # E2E test configuration
```

### Required Variables

```bash
# Server
NODE_ENV=development
PORT=5100  # Local dev, 5000 for Docker

# Database (centralized PostgreSQL)
DATABASE_URL=postgresql://videovault_user:<password>@shared-postgres:5432/videovault_db

# Session (generate with: openssl rand -hex 32)
SESSION_SECRET=your-session-secret-here

# Admin auth
ADMIN_USER=admin
ADMIN_PASS=your-admin-password

# Media paths
MEDIA_ROOT=/path/to/media
PROCESSED_MEDIA_PATH=/path/to/processed  # Optional
THUMBNAILS_DIR=/path/to/thumbnails       # Optional

# CORS
CORS_ORIGINS=http://localhost:5100,http://localhost:5000

# Proxy
TRUST_PROXY=false  # Set true if behind Nginx/Traefik
```

### Database Password Requirements

**CRITICAL**: Use alphanumeric-only passwords (no special characters) to avoid Docker/Postgres escaping issues.

Generate password:
```bash
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32
```

### Development with Postgres

When using optional Postgres persistence:

1. Start services: `npm run docker:dev`
2. Apply schema: `docker exec videovault-dev npm run db:push`
3. Server uses Postgres if `DATABASE_URL` is set, otherwise falls back to in-memory

## Docker Deployment

### Development

```bash
# Start with hot reload
npm run docker:dev

# Access shell
npm run docker:shell

# View logs
npm run docker:logs
```

**Features**:
- Hot reload via bind mounts (`./client`, `./server`, `./shared`)
- Preserves `node_modules` in container
- File watching via Vite
- Connects to centralized `shared-postgres` (external link)

### Production

```dockerfile
# Build production image
docker build -f Dockerfile.prod -t videovault .

# Run container
docker run -p 5000:5000 --env-file .env-prod videovault
```

**Production setup**:
- Uses `Dockerfile.prod`
- Connects to `shared-postgres:5432`
- Traefik reverse proxy integration
- Healthcheck: `/api/health`

### Networks

- `l2p-network` (external): Shared network for services
- `traefik-public` (external): Production reverse proxy

## Key Constraints & Patterns

### Browser Compatibility

**Chromium-based browsers only** for full functionality:
- File System Access API required
- Chrome, Edge, Opera supported
- Safari/Firefox: Limited functionality

### File Handle Management

**Session-based file handles**:
- Handles lost on browser reload
- Use "Rescan last root" to restore permissions
- Handles stored in `DirectoryDatabase`

### Thumbnail Strategy

**On-demand generation**:
- Not persisted to localStorage (quota management)
- Generated via worker threads
- Uses OffscreenCanvas with canvas fallback
- Cached in memory during session

### Virtualization

**Performance optimization**:
- Automatic for libraries with 100+ videos
- Uses `react-window` for efficient rendering
- Grid virtualization for large datasets

### Category Normalization

**Lowercase normalization**:
- All category values normalized to lowercase
- Case-insensitive de-duplication
- Applied automatically on save

### Error Handling

**Shared error codes**:
- Import from `@shared/errors`
- Consistent error types across client/server
- Zod schemas for validation

### State Management

**Centralized in useVideoManager**:
- Single source of truth for video state
- Services should be called through the hook
- Avoid direct service imports in components

## API Routes

### Persistence

- `GET /api/videos` — List all videos
- `POST /api/videos/bulk_upsert` — Upsert videos
- `PATCH /api/videos/:id` — Update video
- `DELETE /api/videos/:id` — Delete video
- `POST /api/videos/batch_delete` — Batch delete

### Roots

- `GET /api/roots` — List directory roots
- `POST /api/roots` — Set root directories
- `POST /api/roots/add` — Add directory to root
- `POST /api/roots/remove` — Remove directory from root
- `DELETE /api/roots/:rootKey` — Delete root
- `GET /api/roots/last` — Get last active root
- `POST /api/roots/last` — Set last active root

### Presets

- `GET /api/presets` — List filter presets
- `POST /api/presets` — Create preset
- `PATCH /api/presets/:id` — Update preset
- `DELETE /api/presets/:id` — Delete preset

### Tags

- `GET /api/tags` — List all tags
- `PATCH /api/tags/:id` — Update tag
- `POST /api/tags/rename` — Rename tag
- `POST /api/tags/merge` — Merge tags
- `POST /api/tags/synonyms` — Add synonym
- `GET /api/tags/synonyms` — List synonyms
- `DELETE /api/tags/synonyms/:id` — Delete synonym

### Other

- `GET /api/health` — Server health
- `GET /api/db/health` — Database health
- `POST /api/errors` — Report client error
- `GET /api/thumbnails/:id` — Generate thumbnail
- `POST /api/duplicates/compute` — Compute duplicates
- `GET /api/duplicates` — List duplicates

## Development Workflow

### Adding New Features

1. **Services first**: Implement business logic in `client/src/services/`
2. **Tests**: Write tests with high coverage for core logic
3. **Hook integration**: Add to `useVideoManager` if needed
4. **Components**: Build UI components
5. **Type safety**: Update types in `client/src/types/`

### Testing Workflow

1. **Write tests**: Colocate with services (`*.test.ts`)
2. **Run locally**: `npm run test:watch`
3. **Check coverage**: `npm run test:coverage`
4. **E2E validation**: `npm run docker:pw:all`

### Debugging

```bash
# Client logs
console.log('[VideoManager]', state)

# Server logs
import { logger } from './lib/logger'
logger.info('Message')

# Docker logs
npm run docker:logs

# Container shell
npm run docker:shell
```

## Common Pitfalls

1. **Path aliases**: Always use `@/` and `@shared/` imports
2. **Test stubs**: Enhanced services are stubbed in tests; add aliases in `vitest.config.ts`
3. **File handles**: Remember session-based nature; implement rescan functionality
4. **Thumbnails**: Don't persist to localStorage (quota issues)
5. **Postgres passwords**: Alphanumeric only, no special characters
6. **Coverage thresholds**: Check `vitest.config.ts` for per-file requirements
7. **Browser API**: Check for File System Access API support before use
8. **Centralized state**: Use `useVideoManager` hook, not direct service calls

## Additional Resources

- README.md: User-facing documentation
- package.json: Scripts and dependencies
- docker-compose.yml: Service definitions
- vitest.config.ts: Test configuration and coverage thresholds
- playwright.config.ts: E2E test configuration
