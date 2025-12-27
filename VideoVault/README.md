# VideoVault

A powerful client-first video management application with advanced filtering, bulk operations, and professional-grade organization features.

## 🎯 Core Features

### Video Management
- **Directory Scanning**: Scan entire directories with progress tracking and cancellation support
- **Drag & Drop Import**: Import videos by dragging files directly into the application
- **Thumbnail Generation**: Off-main-thread thumbnail encoding (worker/OffscreenCanvas with fallback)
- **File Operations**: Create/delete folders, move/delete files with conflict handling
- **Rescan Functionality**: Restore permissions and runtime handles after browser reload

### Advanced Filtering System
- **Date Range Filtering**: Calendar-based date selection for video creation/modification dates
- **File Size Filtering**: Preset ranges with custom input options
  - Small (< 100 MB), Medium (100 MB - 1 GB), Large (1 GB - 10 GB), Very Large (> 10 GB)
  - Custom range input for precise control
- **Duration Filtering**: Preset ranges with custom input options
  - Short (< 5 minutes), Medium (5-30 minutes), Long (30 minutes - 2 hours), Very Long (> 2 hours)
  - Custom minute range input
- **Filter Integration**: Seamless combination with category and search filters
- **Filter Presets**: Save and load filter combinations for quick access

### Bulk Operations System
- **Multi-Selection**: Checkbox-based video selection with keyboard shortcuts
  - `Ctrl+A` - Select all visible videos
  - `Ctrl+Space` - Toggle selection mode
  - `Escape` - Clear all selections
- **Bulk Operations Toolbar**: Fixed bottom toolbar with comprehensive actions
- **Batch Operations**:
  - Bulk category assignment and removal
  - Batch rename with pattern matching (prefix, suffix, numbering, case transforms)
  - Batch move to destination folders with directory picker
  - Batch delete with confirmation dialogs
- **Visual Feedback**: Selection indicators, count display, total size/duration

### Modern Video Player
- **Advanced Controls**: Buffered progress, smooth scrubbing with thumbnail preview
- **Keyboard Shortcuts**: 
  - Arrow keys: ±5s skip
  - Shift+Arrow: ±30s skip
  - Dedicated +10m button for 600s jumps
  - Click/double-click for play/pause and fullscreen
- **Playlist Navigation**: Previous/Next with shuffle mode (preference persisted)
- **Picture-in-Picture**: Native browser PiP support
- **Media Session Integration**: OS media key support (play/pause/seek/prev/next)
- **Inline Tagging**: Edit categories while watching from player controls

### Category Management
- **Standard Categories**: age, physical, ethnicity, relationship, acts, setting, quality, performer
- **Custom Categories**: Unlimited custom category types and values
- **Category Normalization**: Lowercase normalization with case-insensitive de-duplication
- **All Categories View**: Table-like grid with distinct color tones per category type
- **Quick Remove**: Click category chips under thumbnails to instantly remove categories
- **Rename Assistance**: Generate filenames from category values with smart performer placement

### Performance & Accessibility
- **Virtualized Rendering**: Efficient handling of large video libraries (1000+ videos)
- **Performance Monitoring**: Real-time FPS, memory usage, and render time tracking (development mode)
- **Bundle Optimization**: Manual chunking, code splitting, and tree shaking
- **Full Keyboard Navigation**: Complete keyboard accessibility with logical tab order
- **WCAG 2.1 AA Compliance**: Screen reader support, focus indicators, ARIA labels
- **Responsive Design**: Desktop and tablet optimized with dark/light theme support

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** and npm
- **Chromium-based browser** (Chrome, Edge, Opera) for full File System Access API support
- **Docker** (optional, for containerized development)

### Installation & Development

#### Local Development
```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Open browser to:
# - Local dev: http://localhost:5100
# - Docker dev: http://localhost:5000
```

#### Docker Development (Recommended)
```bash
# Start development environment with hot reload
npm run docker:dev

# Start in background
npm run docker:dev:detached

# View logs
npm run docker:logs

# Access container shell for debugging
npm run docker:shell

# Stop and clean up
npm run docker:down
npm run docker:clean
```

### Postgres Setup (optional shared persistence)

1. Create env files with alphanumeric-only secrets (no special characters):
   - `env/.env-postgres` with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
   - `env/.env-app` with `DATABASE_URL` and `SESSION_SECRET` (and existing dev vars)
   See `env/.env.example` for guidance.

2. Start the stack (Postgres is referenced via `depends_on`):
   - `npm run docker:dev`

3. Apply schema migrations to Postgres:
   - In the app container shell: `npm run db:push`

When `DATABASE_URL` is set, the server uses Postgres-backed storage; otherwise it falls back to in-memory storage.

### Build, Test, Verify
```bash
# Typecheck + unit + server e2e + build
npm run verify
```

### Tailwind CSS
- Uses a single root config: `tailwind.config.cjs`.
- PostCSS is configured to reference it: see `postcss.config.js`.
- `@tailwindcss/vite` removed from devDependencies (not needed with Tailwind v3).

### Persistence APIs (server)
- `GET /api/db/health` — Database connectivity status
- `GET /api/videos` — List all videos
- `POST /api/videos/bulk_upsert` — Upsert array of videos (shared library)
- `PATCH /api/videos/:id` — Update single video
- `DELETE /api/videos/:id` — Remove single video
- `POST /api/videos/batch_delete` — Remove multiple videos by IDs
- `GET /api/roots` — List directory roots
- `POST /api/roots` — Set root directories (rootKey, directories, name?)
- `POST /api/roots/add` — Add a directory to a root
- `POST /api/roots/remove` — Remove directory (and nested) from a root
- `DELETE /api/roots/:rootKey` — Delete a root
- `GET /api/roots/last` — Get last active root key
- `POST /api/roots/last` — Set last active root key
- `GET /api/presets` — List filter presets
- `POST /api/presets` — Create/upsert a filter preset
- `PATCH /api/presets/:id` — Update preset
- `DELETE /api/presets/:id` — Delete preset

Run `npm run db:push` after enabling Postgres to create/update tables.

### Shared Types & Errors
- Error codes and error payload types live in `shared/errors.ts` and are used by both client and server.
- Common API payload schemas (Zod) are in `shared/api.ts` (e.g., app settings endpoints).
- Prefer importing `ErrorCodes`, `ErrorCode`, and `StoredError` from `@shared/errors` instead of redefining on the client.

### Settings Service
- `AppSettingsService` exposes typed helpers: `get<T>(key, parser?)` and `set<T>(key, value, serializer?)`.
- Legacy migrations normalize old values (e.g., `'0'/'1'` for `vv.shuffle`) to booleans and persist normalized data.

### Production Build
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Testing & Quality
```bash
# Run test suite
npm test

# Run tests in watch mode
npm run test:watch

# TypeScript type checking
npm run check
```

### E2E with Playwright (Docker)
```bash
# Bring up Postgres and app, then run Playwright tests
npm run docker:pw:all

# Or do it in two steps
npm run docker:pw:up
npm run docker:pw:run

# Tear down containers and volumes when done
npm run docker:down
```
Notes:
- The Playwright container connects to the app via `http://videovault-dev:5000` on the same Docker network.
- Test artifacts are written under `test-results/playwright`.
  - In Docker runs, artifacts are kept inside the container (not bind-mounted), avoiding permissions issues.
  - Local runs write to `test-results/playwright` in the repo.
- To open the HTML report: `npm run test:pw:report` (uses `test-results/playwright-report`).
- To run Playwright locally (outside Docker): `npm run test:pw`.

Optional: MSW (Mock Service Worker)
- You can enable browser-side network mocking for E2E by setting `VITE_E2E_MSW=true` in `env/.env-playwright`.
- Handlers live in `client/src/mocks/handlers.ts` and are started automatically for E2E when enabled.

#### Playwright UI mode
```bash
# Start the interactive Playwright UI and expose it on localhost:9323
npm run docker:pw:ui

# or detached
npm run docker:pw:ui:detached
```
Then open http://localhost:9323 to view and run tests interactively.

Compose Playwright image is pinned to `v1.55.0-jammy` to match `@playwright/test`. Adjust `docker-compose.yml` if you need a different version.

## 🎮 Control Instructions & Usage

### Getting Started
1. **Directory Selection**: Click "Scan Directory" to select your video folder
2. **File System Permissions**: Grant directory access when prompted (Chromium browsers only)
3. **Scanning Progress**: Monitor progress bar and cancel if needed
4. **Thumbnail Generation**: Thumbnails generate automatically in the background

### Navigation & Controls

#### Video Grid/List Navigation
- **Arrow Keys**: Navigate between video cards
- **Home/End**: Jump to first/last video
- **Enter**: Play selected video
- **Space**: Toggle selection (in selection mode)
- **Escape**: Clear focus/selection

#### Video Player Controls
- **Spacebar**: Play/pause
- **Arrow Keys**: Skip ±5 seconds
- **Shift+Arrow Keys**: Skip ±30 seconds
- **+10m Button**: Jump forward 600 seconds
- **Click Progress Bar**: Seek to position
- **Hover Progress Bar**: Preview thumbnail at time
- **P**: Toggle Picture-in-Picture
- **F**: Toggle fullscreen
- **M**: Mute/unmute

#### Advanced Filtering
1. Click "Advanced Filters" in top toolbar
2. **Date Range**: Use calendar pickers to set date range
3. **File Size**: Select preset or enter custom range in MB
4. **Duration**: Select preset or enter custom range in minutes
5. Click "Apply Filters" to activate
6. Use "Clear" or "Reset All" to remove filters

#### Bulk Operations
1. **Enable Selection**: Click checkbox on any video or use `Ctrl+Space`
2. **Select Multiple**: Click checkboxes or use `Ctrl+A` for all
3. **Access Toolbar**: Bulk operations toolbar appears at bottom
4. **Choose Action**: Add Tags, Rename, Move, or use More dropdown
5. **Confirm Operations**: Follow prompts for batch actions

#### Category Management
- **Edit Tags**: Right-click video or use player controls
- **Quick Assign**: Use "All Categories" table for fast assignment
- **Remove Categories**: Click category chips under thumbnails
- **Filter by Category**: Click categories in sidebar
- **Custom Categories**: Add any custom type:value pairs

### File Operations
- **Rename**: Single or batch rename with conflict handling
- **Move**: Use directory picker to move files within scanned root
- **Delete**: Remove files with confirmation (use caution)
- **Directory Operations**: Create/delete folders within scanned structure

### Session Management
- **Data Persistence**: Video metadata stored in browser localStorage
- **Handle Management**: File handles maintained per browser session
- **Rescan Root**: Restore file access after browser reload
- **Export/Import**: Backup and restore video metadata
- **Filter Presets**: Save frequently used filter combinations

## 🏗️ Architecture & Technical Details

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI/shadcn
- **Backend**: Node.js Express server with Vite middleware (dev) / static serving (prod)
- **Data**: localStorage (primary), optional Drizzle ORM + PostgreSQL schema
- **Testing**: Vitest with jsdom environment
- **Containerization**: Docker with hot reload support

### Key Components
- **useVideoManager**: Central state management hook orchestrating all services
- **VideoDatabase**: localStorage-based video metadata persistence
- **FileScanner**: Directory scanning with concurrency control
- **FilterEngine**: Advanced filtering with category, search, date, size, duration support
- **BulkOperationsService**: Multi-select and batch operation management
- **VideoPlayerModal**: Full-featured player with advanced controls

### Browser Compatibility
- **Primary**: Chromium-based browsers (Chrome, Edge, Opera)
- **File System Access API**: Required for full functionality
- **Graceful Degradation**: Limited functionality on other browsers
- **Mobile Support**: Responsive design for touch devices

### Performance Considerations
- **Virtualization**: Automatic for large libraries (100+ videos)
- **Concurrency Control**: Scanning limited by `navigator.hardwareConcurrency`
- **Memory Management**: Thumbnails not persisted to avoid quota issues
- **Bundle Optimization**: Code splitting and vendor chunking configured

## 📝 Usage Notes & Best Practices

### File System Access API
- The application requires File System Access API for full functionality
- Use Chromium-based browsers for the best experience
- File handles are maintained per session for operations
- After reload, use "Rescan last root" to restore permissions

### Data Management
- Video metadata is stored in browser localStorage
- Thumbnails are generated lazily and not persisted
- Regular backups are recommended using the export feature
- Category values are normalized to lowercase automatically

### Performance Tips
- Enable virtualization for libraries with 100+ videos
- Use advanced filters to reduce dataset before bulk operations
- Monitor performance metrics in development mode
- Consider browser memory limits for very large libraries

### Troubleshooting
- **No videos after reload**: Use "Rescan last root" to restore file access
- **Slow performance**: Check video count, consider filtering
- **Missing thumbnails**: Thumbnails regenerate automatically when needed
- **Playback issues**: Ensure video files are accessible and supported formats

## 🧪 Testing

### Manual Testing Guide
See `docs/manual-testing-guide.md` for comprehensive testing instructions including:
- Advanced filtering system testing
- Bulk operations validation
- Performance monitoring verification
- Keyboard navigation and accessibility testing

### Automated Testing
- **Unit Tests**: Comprehensive service and component testing
- **Integration Tests**: Core workflow validation
- **Performance Tests**: Large library handling verification
- **Accessibility Tests**: WCAG 2.1 AA compliance validation

### Test Data Requirements
- **Minimum**: 50+ video files for testing virtualization
- **Recommended**: 100+ video files for performance testing
- **Variety**: Different file sizes, durations, and creation dates
- **Formats**: MP4, AVI, MKV, MOV, WMV support

## 🚀 Deployment

### Development
- Use `npm run dev` for local development
- Use `npm run docker:dev` for containerized development with hot reload
- Access at:
  - Local dev: http://localhost:5100
  - Docker dev: http://localhost:5000

### Production
- Run `npm run build` to create production build
- Use `npm run start` to serve production build
- Configure reverse proxy if needed

### Docker Production
```bash
# Build production image
docker build -t videovault .

# Run production container
docker run -p 5000:5000 videovault
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing code style
4. Run tests: `npm test`
5. Run type checking: `npm run check`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**VideoVault** - Professional video management for the modern web. Built with privacy-first local storage and cutting-edge web APIs.
