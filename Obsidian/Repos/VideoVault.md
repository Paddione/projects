# VideoVault

## Purpose
Client-first video management application optimized for large local media libraries. Uses the File System Access API for direct file access without uploading, with optional PostgreSQL persistence.

## Stack
- **Frontend**: React, Vite, TypeScript
- **Backend**: Express, Vite dev middleware
- **Storage**: IndexedDB (primary), PostgreSQL (optional)
- **File Access**: File System Access API (Chromium only)
- **Testing**: Vitest, Playwright

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Browser"
        UI[React UI]
        FSA[File System Access API]
        IDB[(IndexedDB)]
    end

    subgraph "Client Services"
        VM[VideoManager]
        VDB[VideoDatabase]
        FS[FileScanner]
        FE[FilterEngine]
        BO[BulkOperations]
    end

    subgraph "Server :5100"
        Express[Express Server]
        Vite[Vite Middleware]
    end

    subgraph "Optional"
        PG[(PostgreSQL)]
    end

    subgraph "Local Files"
        Media[Video Files]
    end

    UI --> VM
    VM --> VDB
    VM --> FS
    VM --> FE
    VM --> BO

    VDB --> IDB
    VDB -.-> PG

    FSA --> Media
    FS --> FSA

    UI --> Express
    Express --> Vite

    style FSA fill:#ffe1e1
    style IDB fill:#e1f5ff
    style PG fill:#e1f5ff
```

### Client Architecture

```mermaid
graph LR
    subgraph "Components"
        Grid[VideoGrid]
        Player[VideoPlayer]
        Filters[FilterPanel]
        Toolbar[Toolbar]
    end

    subgraph "Hooks"
        UseVM[useVideoManager]
    end

    subgraph "Services"
        VDB[VideoDatabase]
        Scanner[FileScanner]
        Filter[FilterEngine]
        Bulk[BulkOperations]
    end

    subgraph "Storage"
        IDB[(IndexedDB)]
        Cache[Thumbnail Cache]
    end

    Grid --> UseVM
    Player --> UseVM
    Filters --> UseVM
    Toolbar --> UseVM

    UseVM --> VDB
    UseVM --> Scanner
    UseVM --> Filter
    UseVM --> Bulk

    VDB --> IDB
    Scanner --> IDB
    Bulk --> IDB

    Player --> Cache

    style IDB fill:#e1f5ff
```

**Key Directories:**
- `client/src/components/` - React UI components
- `client/src/services/` - Core business logic
- `client/src/hooks/` - Custom React hooks
- `server/` - Express server with Vite
- `server/db/` - Drizzle ORM schema

### Service Layer

```mermaid
graph TB
    subgraph "VideoManager"
        Init[Initialize]
        Scan[Scan Directory]
        Filter[Apply Filters]
        Bulk[Bulk Operations]
    end

    subgraph "VideoDatabase"
        Add[Add Video]
        Query[Query Videos]
        Update[Update Video]
        Delete[Delete Video]
    end

    subgraph "FileScanner"
        ReadDir[Read Directory]
        Extract[Extract Metadata]
        Hash[Generate Hash]
        Cache[Cache Results]
    end

    subgraph "FilterEngine"
        Search[Text Search]
        Sort[Sort Videos]
        Tag[Filter by Tags]
        Duration[Filter by Duration]
    end

    Init --> Scan
    Scan --> ReadDir
    ReadDir --> Extract
    Extract --> Add
    Add --> Query
    Query --> Filter
    Filter --> Search

    style Add fill:#e1f5ff
    style Query fill:#e1f5ff
```

## File Access Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant FSA as File System API
    participant Scanner as FileScanner
    participant DB as VideoDatabase
    participant IDB as IndexedDB

    User->>UI: Click "Select Folder"
    UI->>FSA: showDirectoryPicker()
    FSA-->>UI: DirectoryHandle

    UI->>Scanner: scanDirectory(handle)

    loop For each file
        Scanner->>FSA: getFileHandle()
        FSA-->>Scanner: FileHandle
        Scanner->>Scanner: Extract metadata
        Scanner->>DB: addVideo(metadata)
        DB->>IDB: Store video data
    end

    Scanner-->>UI: Scan complete
    UI-->>User: Display video grid

    style FSA fill:#ffe1e1
    style IDB fill:#e1f5ff
```

**Critical Constraint:** File handles are session-based. After page reload, users must re-grant folder access.

## Key Features

### Directory Scanning
- Recursive directory traversal
- Metadata extraction (duration, resolution, codec)
- Duplicate detection via file hashing
- Progress tracking

### Filtering & Search
- Full-text search across filenames and metadata
- Tag-based filtering
- Duration range filtering
- File size filtering
- Custom sort options

### Bulk Operations
- Batch tagging
- Batch deletion
- Export metadata
- Playlist generation

### Video Playback
- Native HTML5 video player
- Thumbnail generation on-demand
- Playback history tracking
- Resume from last position

### Storage Strategy
- **Primary**: IndexedDB for session persistence
- **Optional**: PostgreSQL for cross-session persistence
- **Thumbnails**: Generated on-demand, quota-managed

## Run Locally

### Development Mode

```bash
cd VideoVault

# Local dev server (hot reload)
npm run dev        # http://localhost:5100
```

### Docker Development

```bash
cd VideoVault

# Docker with hot reload
npm run docker:dev # http://localhost:5000

# Background mode
npm run docker:dev:detached

# Stop
npm run docker:down
```

## Build & Production

```bash
cd VideoVault

# Build for production
npm run build

# Start production server
npm run start        # http://localhost:5100
```

## Testing

### Unit Tests

```bash
cd VideoVault

# Run all unit tests
npm test

# Watch mode
npm run test:watch

# Single test file
npm run test -- client/src/services/VideoDatabase.test.ts

# Type checking
npm run check

# Full verification (types + tests + build)
npm run verify
```

### E2E Tests with Docker

```mermaid
flowchart TB
    A[Start Docker Stack] --> B[Build Test Environment]
    B --> C[Mount Test Videos]
    C --> D[Run Playwright Tests]
    D --> E[Test Video Selection]
    D --> F[Test Filtering]
    D --> G[Test Playback]
    E --> H[Cleanup]
    F --> H
    G --> H

    style C fill:#e1f5ff
```

```bash
cd VideoVault

# Complete E2E suite
npm run docker:pw:all

# Or step by step:
npm run docker:pw:up     # Start test environment
npm run docker:pw:run    # Run Playwright tests
npm run docker:down      # Cleanup
```

## Database

### IndexedDB Schema

```
Database: videovault
├── videos
│   ├── id (key)
│   ├── filePath
│   ├── fileName
│   ├── fileSize
│   ├── duration
│   ├── resolution
│   ├── codec
│   ├── hash
│   └── metadata (JSON)
└── thumbnails
    ├── videoId (key)
    └── blob
```

### PostgreSQL Schema (Optional)

See `server/db/schema.ts` for Drizzle schema.

```bash
# Apply schema to Postgres
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

Key tables:
- `videos` - Video metadata
- `tags` - Video tags
- `watch_history` - Playback tracking

## Environment Setup

### Required Variables

```bash
# Session secret
SESSION_SECRET=<32-char-hex>

# Admin password
ADMIN_PASS=<strong-password>

# Media root directory
MEDIA_ROOT=/path/to/video/library

# Optional PostgreSQL
DATABASE_URL=postgresql://videovault_user:password@shared-postgres:5432/videovault_db
```

### Generate Secrets

```bash
# Session secret
openssl rand -hex 32
```

## Ports

| Mode | Port | URL |
|------|------|-----|
| Local dev | 5100 | http://localhost:5100 |
| Docker dev | 5000 | http://localhost:5000 |
| Production | 5001 | https://vault.korczewski.de |

## Browser Compatibility

**Requires Chromium-based browsers:**
- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Opera 72+
- ❌ Firefox (File System Access API not supported)
- ❌ Safari (File System Access API not supported)

## Storage Quotas

```mermaid
pie title Storage Usage
    "Video Metadata" : 10
    "Thumbnails" : 70
    "Search Index" : 15
    "Other" : 5
```

**Management:**
- Thumbnails generated on-demand
- LRU cache for thumbnail eviction
- Periodic cleanup of old data
- User-configurable quota limits

## Performance Optimization

### Large Libraries

For libraries with 10,000+ videos:

1. **Virtual Scrolling**: Only render visible videos
2. **Lazy Thumbnail Loading**: Generate on viewport enter
3. **Indexed Search**: Use IndexedDB indexes
4. **Web Workers**: Move heavy processing off main thread
5. **Pagination**: Limit initial load to 500 videos

### Caching Strategy

```mermaid
flowchart LR
    A[Request Thumbnail] --> B{In Cache?}
    B -->|Yes| C[Return Cached]
    B -->|No| D[Generate Thumbnail]
    D --> E[Store in Cache]
    E --> F[Return Thumbnail]

    G[Cache Full] --> H[Evict LRU Entry]
    H --> D

    style C fill:#e1ffe1
    style E fill:#e1f5ff
```

## API Endpoints

```
GET    /api/health
GET    /api/videos
POST   /api/videos
GET    /api/videos/:id
PUT    /api/videos/:id
DELETE /api/videos/:id
GET    /api/thumbnails/:id
POST   /api/scan
GET    /api/stats
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Permission denied" | User must grant folder access via File System API |
| File handles lost after reload | Re-scan directory after page refresh |
| Thumbnails not loading | Check browser quota, clear cache if needed |
| Videos not playing | Verify video codec is supported by browser |
| Slow scanning | Process runs in Web Worker; check browser console |
| IndexedDB quota exceeded | Clear old thumbnails or use Postgres |

### Debug Mode

```bash
# Enable verbose logging
DEBUG=videovault:* npm run dev

# Check IndexedDB
# Open DevTools → Application → IndexedDB → videovault
```

### Clear All Data

```javascript
// In browser console
indexedDB.deleteDatabase('videovault');
localStorage.clear();
location.reload();
```

## Advanced Usage

### Custom Filters

```javascript
// Example: Filter by resolution
const hdVideos = videos.filter(v =>
  v.metadata.height >= 1080
);
```

### Bulk Tagging

```javascript
// Example: Tag all videos in a category
await bulkOperations.tagVideos(videoIds, ['action', 'favorites']);
```

### Export Metadata

```javascript
// Example: Export to JSON
const metadata = await videoDatabase.exportAll();
const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
```

## Links

- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Database details
- [[Testing Strategy]] - Testing approach
- [[Deployment Architecture]] - Deployment guide
- [[Repository Index]] - Back to index
