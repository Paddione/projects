# L2P (Learn2Play) - Complete Documentation

## Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [High-Level Architecture Overview](#high-level-architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Environment Setup](#environment-setup)
5. [Installation](#installation)
6. [Development](#development)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Admin Panel](#admin-panel)
10. [Password Reset System](#password-reset-system)
11. [SMTP Configuration](#smtp-configuration)
12. [Test Data Management](#test-data-management)
13. [API Documentation](#api-documentation)
14. [WebSocket Events](#websocket-events)
15. [Database Schema](#database-schema)
16. [Error Handling](#error-handling)
17. [Performance](#performance)
18. [Security](#security)
19. [Features and Perks](#features-and-perks)
20. [Troubleshooting](#troubleshooting)
21. [Project Tasks and History](#project-tasks-and-history)

---

## Quick Start Guide

Use this guide to install, run, test, deploy, and administer the project. For a quick TL;DR, see the root `README.md`.

- Project root: `/home/patrick/l2p`
- Frontend: `frontend/`
- Backend: `backend/`
- Shared libs and config: `shared/`
- Scripts: `scripts/`

### Prerequisites

- Node.js 20 LTS
- Docker + Docker Compose (for local/prod orchestration)
- Linux/macOS recommended

Optional for E2E UI mode on headless servers:
- Xvfb (used by `npm --prefix frontend/e2e run test:ui:xvfb`)

### Quick Setup

1. **Install Dependencies**
   ```bash
   npm run install:all
   ```

2. **Environment Setup**
   - Copy `.env.example` to `.env` and customize values as needed
   - Ensure database credentials in `.env` match your active profile

3. **Start Development**
   ```bash
   # Start frontend (dev)
   npm run dev:frontend
   
   # Start backend (dev)
   npm run dev:backend
   ```

4. **Run Tests**
   ```bash
   npm run test:all
   ```

---

## High-Level Architecture Overview

L2P (Learn2Play) is a real-time multiplayer quiz platform that makes learning engaging through gamification, character progression, and AI-powered content generation.

![High level architecture](docs/architecture-diagram.svg)

```
┌─────────────────────────────────────────┐
│               Frontend App              │
├─────────────────┬───────────────────────┤
│   Components    │     State Management  │
├─────────────────┼───────────────────────┤
│   • Learning    │   • User State        │
│   • Dashboard   │   • Course Progress   │
│   • Profile     │   • Notifications     │
│   • Social      │   • UI State          │
├─────────────────┼───────────────────────┤
│   Services      │     Utilities         │
│   • API Client  │   • Validation        │
│   • Socket.io   │   • Formatters        │
│   • Storage     │   • Constants         │
└─────────────────┴───────────────────────┘
```

### Backend Services
- **Authentication Service**: User management, JWT tokens, email verification, password reset
- **Game Service**: Multiplayer game logic, session management, real-time gameplay
- **Lobby Service**: Game lobby management, player coordination
- **Question Service**: Question management, AI generation, caching
- **Character Service**: Character progression, experience tracking, gamification
- **Scoring Service**: Game scoring, leaderboards, statistics
- **File Processing Service**: Document processing, AI integration
- **Socket Service**: WebSocket handling, real-time communication

### Domain Configuration
The platform is configured with the following domain structure:

- **Primary Domain**: `l2p.korczewski.de` - Main application domain
- **WWW Redirect**: `www.korczewski.de` → `l2p.korczewski.de` (automatic redirect)
- **SSL/TLS**: Let's Encrypt certificates with automatic renewal
- **Entry Points**: 
  - HTTP (port 80): Redirects to HTTPS
  - HTTPS (port 443): Secure application access
  - Dashboard (port 8080): Traefik management interface

**Domain Routing Rules:**
- Frontend: Served on primary domain
- API: `/api/*` paths on primary domain
- WebSocket: `/socket.io/*` paths on primary domain
- Admin: `/admin/*` paths on primary domain
- Dashboard: `/dashboard/*` paths on primary domain

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build System**: Vite for optimized builds and hot reloading
- **State Management**: Zustand stores for state management
- **UI Components**: Custom component library with responsive design and theme support
- **Real-time**: Socket.IO client integration for live multiplayer features
- **Routing**: React Router with protected routes and authentication guards
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Backend
- **Runtime**: Node.js with Express.js and TypeScript
- **API Design**: RESTful API with standardized pagination and sorting
- **Authentication**: JWT with refresh token rotation, email verification, password reset
- **Real-time**: Socket.IO for WebSocket communication and multiplayer features
- **File Upload**: Multer for document processing (PDF, DOCX, TXT, MD)
- **AI Integration**: Google Gemini API for question generation
- **Caching**: TTL-based caching for question sets and statistics
- **Metrics**: Prometheus metrics endpoint for monitoring

### Database
- **Primary**: PostgreSQL 15 with advanced features
- **Connection Pooling**: pg-pool for efficient connections
- **ORM/Query Builder**: Prisma or Knex.js
- **Migrations**: Version-controlled schema management

### External Integrations
- **AI Integration**: Google Gemini API for question generation and content enhancement
- **SMTP**: Gmail SMTP for email functionality and password reset
- **Analytics**: Custom analytics for learning insights and performance monitoring
- **Notifications**: Email notifications for account verification and password reset

### TypeScript Configuration
- **No Compilation Required**: Direct TypeScript execution in development
- **Frontend**: Vite handles TypeScript transpilation on-the-fly
- **Backend**: tsx for direct TypeScript execution without build step
- **Production**: Pre-compiled for optimized performance
- **Development Benefits**: Hot reloading without build delays

#### Development Setup
```bash
# Start development environment without TypeScript compilation
./scripts/start-no-compile.sh

# Or manually with docker-compose
docker-compose --profile development up
```

#### TypeScript Execution Methods
- **Frontend Dev**: `vite --config vite.config.ts` (Vite handles TS internally)
- **Backend Dev**: `tsx src/server.ts` (Direct TS execution)
- **Testing**: Both environments use direct TS execution
- **Production**: Pre-compiled JavaScript for optimal performance

---

## Environment Setup

### Environment Variables

Copy `.env.example` to `.env` and customize values as needed. Production-like defaults are provided.

```bash
# Production environment
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@l2p-postgres:5432/learn2play
JWT_SECRET_FILE=/run/secrets/jwt_secret
JWT_REFRESH_SECRET_FILE=/run/secrets/jwt_refresh_secret
GEMINI_API_KEY_FILE=/run/secrets/gemini_api_key
FRONTEND_URL=https://l2p.korczewski.de
LOG_LEVEL=info
ENABLE_METRICS=true

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_SENDER_ADDRESS=noreply@your-domain.com
EMAIL_SENDER_NAME=Learn2Play
```

### Validation

Useful checks:
- Validate local test environment: `npm run test:env:validate`
- Show current test env config/URLs: `npm run test:env:urls`

---

## Installation

From the repository root:

```bash
npm run install:all
```

This installs dependencies for root, frontend, backend, and nested E2E package.

---

## Development

### Starting Services

- Start frontend (dev):
  ```bash
  npm run dev:frontend
  ```
- Start backend (dev):
  ```bash
  npm run dev:backend
  ```

### Tips

- Frontend test mode uses `VITE_TEST_MODE=true` to enable a lightweight mock API. E2E leverages this to run without a live backend.
- Repository structure and key notes are in `README.md` under "Repository Structure" and "Notes".

### Docker Development

```bash
# Start development environment
docker-compose --profile development up

# Start without TypeScript compilation
./scripts/start-no-compile.sh

# Quick start with npm
npm run dev:no-compile
```

---

## Testing

### Test Scripts

Scripts (run from repo root):
- Unit: `npm run test:unit`
- Integration: `npm run test:integration`
- E2E (Playwright): `npm run test:e2e`
- Coverage: `npm run test:coverage`
- All tests: `npm run test:all`
- Full pipeline (TS → unit → integration → e2e): `npm run test:all:pipeline`
- Full pipeline, non-failing (always continues): `npm run test:all:pipeline:soft`
- CI pipeline (CI env, headless): `npm run test:all:ci`
- Watch unit tests (frontend+backend): `npm run test:watch:unit`
- Watch integration tests (frontend+backend): `npm run test:watch:integration`
- Typecheck is strict by default: `npm run typecheck`
- Loose typecheck (legacy config): `npm run typecheck:loose`
- Interactive selector: `npm run test:interactive` (or `./test-runner.sh`)

### Playwright Browser Binaries

Install Playwright browsers once on this machine:

- All-at-once helper:
  ```bash
  npm run test:browsers:install:all
  ```
- Or per package (equivalent):
  ```bash
  cd frontend && npx --yes playwright install --with-deps
  cd frontend/e2e && npx --yes playwright install --with-deps
  ```

### Notes

- Google Chrome (stable) is also installed so the `channel: 'chrome'` project can run.
- UI mode on headless servers: `npm --prefix frontend/e2e run test:ui:xvfb`.
- The `frontend` package delegates all E2E scripts to `frontend/e2e` to avoid loading multiple instances of `@playwright/test`.
- E2E runs are guarded by `scripts/check-e2e-env.js` in pipeline commands to reduce flakiness; if the environment is not ready, E2E is skipped rather than failing the pipeline.
- E2E starts the parent dev server via `npm --prefix frontend run start:test-env` with `VITE_TEST_MODE=true`.

### Test Organization

```
tests/
├── unit/                   # Unit tests
│   ├── services/
│   ├── models/
│   └── utils/
├── integration/            # Integration tests
│   ├── api/
│   ├── database/
│   └── external/
├── e2e/                   # End-to-end tests
│   ├── user-flows/
│   ├── admin-flows/
│   └── instructor-flows/
├── performance/           # Performance tests
│   ├── load-tests/
│   └── stress-tests/
└── fixtures/              # Test data
    ├── users.json
    ├── courses.json
    └── lessons.json
```

### Reports and Artifacts

- HTML report: `frontend/e2e/playwright-report/` (open `index.html`)
- Machine-readable: `frontend/e2e/test-results.json`, `frontend/e2e/test-results.xml`

### Coverage

- Collect and aggregate: `npm run coverage:collect`
- Report, badge, config helpers: `npm run coverage:report|badge|config|validate|threshold|exclude`

### Test Environment Management

Helpers under `scripts/` are wired through npm scripts:

- Lifecycle: `npm run test:env:start|stop|restart|reset|cleanup|status|logs|health|urls`
- Integration sanity check: `node scripts/validate-test-integration.js`
- Test config utilities: `npm run test:config:validate|health|show|init|help`

---

## Deployment

### Deploy vs Rebuild
- Deploy: Uses `./deploy.sh` to build production images, start services with the production compose stack, run DB migrations, and perform health checks.
  - Command: `npm run deploy`
  - Use when promoting to/stabilizing production.
- Rebuild: Uses `rebuild.sh` to rebuild and (optionally) restart specific services for any profile (dev/test/production) with fine-grained control.
  - Command: `npm run rebuild`
  - Examples:
    - `bash rebuild.sh rebuild-backend -p dev` — rebuild backend (development).
    - `bash rebuild.sh rebuild-frontend` — rebuild frontend for the active profile.
    - `bash rebuild.sh rebuild-all --reset-db -y -p dev` — rebuild everything and reset DB in dev.
  - Good for day-to-day development, CI runs, or selective service refreshes.

### Docker Deployment

- Build & deploy (wrapper around `rebuild.sh`):
  ```bash
  npm run rebuild
  ```
- Stop & view logs (production profile):
  ```bash
  npm run stop
  npm run logs
  ```
- Ensure `.env` is configured before deployment.

### Rebuild Specific Services

- Frontend: `bash rebuild.sh rebuild-frontend` or `bash rebuild.sh rebuild-frontend-force`
- Backend: `bash rebuild.sh rebuild-backend` or `bash rebuild.sh rebuild-backend-force`
- Database (Postgres): `bash rebuild.sh rebuild-db`
- Traefik only: `bash rebuild.sh rebuild-traefik` (respects `--pull`) or `bash rebuild.sh rebuild-traefik-force` (force pull/recreate)
- Reset DB of active profile after rebuild: append `--reset-db`, e.g. `bash rebuild.sh rebuild-all --reset-db -y -p dev`

### Docker Configuration

The application uses Docker Compose for containerized deployment across multiple environments:

#### Volume Mounts
- **Development**: Source code, migrations, and shared packages are volume-mounted for hot reloading
- **Production**: Built artifacts and migrations are copied during image build
- **Testing**: Isolated test environment with ephemeral databases

#### Migration System
- **Location**: `/backend/migrations/` directory with SQL files
- **Naming Convention**: `YYYYMMDD_HHMMSS_description.sql`
- **Execution**: Automatic migration on application startup
- **Tracking**: `schema_migrations` table tracks applied migrations
- **Error Handling**: Failed migrations prevent application startup

### Health Monitoring

```javascript
// Health check endpoint implementation
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'healthy',
      external_apis: 'healthy',
      memory_usage: process.memoryUsage(),
      disk_usage: await getDiskUsage()
    }
  };
  
  res.status(200).json(health);
});
```

### Scaling Considerations
- **Horizontal Scaling**: Multiple backend replicas
- **Database Optimization**: Connection pooling and read replicas
- **Caching Strategy**: TTL-based caching for question sets and statistics
- **Load Balancing**: Nginx Proxy Manager with health checks and SSL termination
- **Resource Monitoring**: CPU, memory, and disk usage tracking via Prometheus metrics
- **Performance Monitoring**: Query performance analysis and slow query logging

---

## Admin Panel

- Served at `/admin` by the backend (`backend/public`).
- Uses the main JWT cookie-based auth; admin UI fetches with credentials.
- Core endpoints (admin only):
  - `GET /api/admin/users?q&limit&offset`
  - `PUT /api/admin/users/:id/character-level` — `{ level: number }`
  - `POST /api/admin/users/:id/password` — `{ newPassword: string(min 8) }`
  - `DELETE /api/admin/users/:id`

### GET /api/admin/users

Standardized pagination and sorting with sensible defaults and a sort whitelist.

- Query params:
  - `q` (optional): search query, matches `username` or `email` (ILIKE)
  - `limit` (default 25, max 100)
  - `offset` (default 0)
  - `sort` (default `created_at`, whitelist: `id`, `username`, `email`, `created_at`, `last_login`, `character_level`, `experience_points`, `is_active`, `is_admin`)
  - `dir` (default `DESC`, values: `ASC` | `DESC`)

- Response shape:
  ```json
  {
    "items": [
      {
        "id": 1,
        "username": "alpha",
        "email": "alpha@example.com",
        "is_admin": false,
        "is_active": true,
        "selected_character": "student",
        "character_level": 3,
        "experience_points": 120,
        "created_at": "2024-01-01T00:00:00.000Z",
        "last_login": "2024-01-02T00:00:00.000Z",
        "avatar_url": null,
        "timezone": "UTC"
      }
    ],
    "total": 12345,
    "limit": 25,
    "offset": 0,
    "sort": { "by": "created_at", "dir": "DESC" }
  }
  ```

### Notes
- Stable sorting: even when sorting by other columns, a secondary sort by `id ASC` is enforced for determinism.
- Validation: parameters are validated server-side; invalid `limit/offset` yield 400.
- Sensitive fields (e.g. `password_hash`) are not returned in `items`.

---

## Password Reset System

### Overview
The Learn2Play platform provides a secure password reset functionality that works seamlessly in both development and production environments. The system uses temporary passwords and secure tokens to ensure user security while providing a smooth recovery experience.

### Environment-Aware URL Resolution
The EmailService automatically resolves the correct base URL for password reset links based on the environment:

- **Development**: `http://localhost:3000` (automatic detection when `NODE_ENV=development`)
- **Production**: `https://l2p.korczewski.de` (default production URL)
- **Custom**: Can be overridden with `APP_BASE_URL` or `FRONTEND_BASE_URL` environment variables

### Password Reset Flow

#### 1. Request Password Reset
```typescript
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Process:**
1. User enters their email address
2. System validates email exists and account is active
3. Generates temporary password and secure reset token
4. Sends bilingual email (German/English) with:
   - Temporary password for immediate login
   - Reset token for form-based password change
   - Direct reset link to frontend

**Security Features:**
- No email enumeration (always returns success)
- Temporary password expires with reset token
- Deactivated accounts cannot reset passwords

#### 2. Complete Password Reset
```typescript
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "secure-reset-token",
  "newPassword": "NewSecurePassword123!"
}
```

**Process:**
1. User enters reset token and new password
2. System validates token and password requirements
3. Updates password and clears reset token
4. User can login with new password

### Development Setup

#### Quick Start
The password reset functionality now works seamlessly with localhost development. No additional configuration required!

#### Setup Steps
1. **Start Backend (Development Mode)**
   ```bash
   cd backend
   NODE_ENV=development npm run dev:tsx
   ```

2. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Password Reset**
   - Navigate to http://localhost:3000
   - Click "Forgot Password" on login form
   - Enter any valid email address
   - Check your email for reset instructions
   - **Important**: The reset link will now correctly point to `http://localhost:3000` instead of the production URL

### Email Template Features

#### Multilingual Support
- Bilingual content (German/English)
- Localized subject lines
- Cultural-appropriate messaging

#### Security Information
- Clear warnings about password change requirements
- Instructions for both temporary password and token usage
- Security disclaimers about unsolicited emails

#### Visual Design
- Professional HTML templates
- Styled password and token display boxes
- Warning callouts for important information
- Mobile-responsive design

### Security Considerations

#### Token Security
- Cryptographically secure random tokens (32 bytes)
- Time-limited expiration (24 hours)
- Single-use tokens (cleared after successful reset)

#### Password Requirements
- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one number
- At least one special character (@$!%*?&)

#### Rate Limiting
- Production: Strict rate limiting on reset requests
- Development: More permissive for testing

### Error Handling

#### Common Error Scenarios
```typescript
// Invalid or expired token
{
  "success": false,
  "error": "Invalid or expired reset token"
}

// Password validation failure
{
  "success": false, 
  "error": "Password must contain at least one uppercase letter"
}

// Account deactivated
{
  "success": false,
  "error": "Account is deactivated"
}
```

### Customization

#### Custom Development URL
If you're running on a different port or domain:

```bash
# Backend
APP_BASE_URL=http://localhost:4000 NODE_ENV=development npm run dev:tsx

# Or via environment file
echo "APP_BASE_URL=http://localhost:4000" > .env.dev
NODE_ENV=development npm run dev:tsx
```

---

## SMTP Configuration

The project supports both mocked and real SMTP testing:
- **Mocked SMTP**: For regular unit/integration tests (default)
- **Real SMTP**: For end-to-end email testing using actual Gmail SMTP

### Environment Variables

| Variable               | Description                | Test Default       | Production Value            |
| ---------------------- | -------------------------- | ------------------ | --------------------------- |
| `SMTP_HOST`            | SMTP server host           | `smtp.test.com`    | `smtp.gmail.com`            |
| `SMTP_PORT`            | SMTP server port           | `587`              | `587`                       |
| `SMTP_SECURE`          | Use TLS/SSL                | `false`            | `false`                     |
| `SMTP_USER`            | SMTP username              | `test@example.com` | `p.korczewski@gmail.com`    |
| `SMTP_PASS`            | SMTP password/app password | `testpassword`     | `your-app-password`         |
| `EMAIL_SENDER_ADDRESS` | From email address         | `noreply@test.com` | `noreply@l2p.korczewski.de` |
| `EMAIL_SENDER_NAME`    | From name                  | `Test Platform`    | `Learn2Play`                |
| `TEST_REAL_SMTP`       | Enable real SMTP for tests | `false`            | N/A                         |

### SMTP Testing Commands

| Command                         | Description                                |
| ------------------------------- | ------------------------------------------ |
| `npm run smtp:fix`              | Diagnose SMTP issues and show instructions |
| `npm run smtp:test <password>`  | Test a new App Password                    |
| `npm run smtp:apply <password>` | Apply new password and update .env         |
| `npm run test:smtp -- --real`   | Full SMTP test with real email sending     |

### SMTP Troubleshooting

#### Common Issues

**Gmail Authentication Errors**
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

**Solutions:**
- Verify 2FA is enabled on Gmail account
- Use App Password instead of regular password
- Check that App Password is correct (16 characters)

**Quick Fix Process:**
1. **Diagnosis**: Run `npm run smtp:fix` to confirm Gmail authentication failure
2. **Generate New Password**: Create new Gmail App Password at https://myaccount.google.com/
3. **Test**: Use `npm run smtp:test <new-password>` to verify new password works
4. **Apply**: Use `npm run smtp:apply <new-password>` to update environment automatically
5. **Verify**: Run `npm run test:smtp -- --real` to confirm full email functionality

---

## Test Data Management

### Overview

Test data cleanup is crucial for:
- Preventing test interference
- Maintaining database performance
- Avoiding false positives/negatives
- Ensuring reproducible test results

### Automatic Cleanup

The project includes automatic cleanup mechanisms:

1. **Global teardown** - Cleans up pagination test data patterns after all tests
2. **Jest setup** - Automatic cleanup after each test suite
3. **Test utilities** - Helper classes for manual tracking and cleanup

### Using Test Cleanup Utilities

#### Basic Usage

```typescript
import { TestCleanup, setupTestCleanup, generateTestName } from '../shared/test-utils/test-cleanup.js';
import { DatabaseService } from '../backend/dist/services/DatabaseService.js';

describe('My Test Suite', () => {
  let cleanup: TestCleanup;
  let dbService: DatabaseService;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    cleanup = setupTestCleanup(dbService);
  });

  afterAll(async () => {
    await cleanup.cleanup(dbService);
  });

  it('should create and track test data', async () => {
    // Create test question set
    const questionSetData = {
      name: generateTestName('TestSet'), // Generates unique, safe names
      description: 'Test description',
      category: 'Test',
      difficulty: 'medium',
      is_active: true
    };

    const response = await request(app)
      .post('/api/questions/sets')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionSetData);

    const questionSetId = response.body.data.id;
    
    // Track for cleanup
    cleanup.trackQuestionSet(questionSetId);

    // Your test logic here...
  });
});
```

### Naming Conventions

#### ✅ Good Test Data Names
- Use `generateTestName()` utility
- Include timestamps or random identifiers
- Be specific about test purpose

```typescript
// Good examples
const name = generateTestName('UserTest');     // Generates: "UserTest-1234567890-abc123"
const name = generateTestName('IntegrationTest');
const name = `SpecificTest-${Date.now()}`;
```

#### ❌ Avoid These Patterns
- Names that look like pagination tests
- Generic names without identifiers
- Names with "Pag", "Pagination", "Debug" patterns

### Automatic Cleanup Patterns

The system automatically detects and removes test data matching:

**Question Set Names:**
- `%PagTest%`
- `%Paginated Set%` 
- `%Debug Test Set%`
- `%Std Pagination Set%`

**Descriptions:**
- `%pagination test%`

### Best Practices

1. **Use tracking utilities** for complex test suites
2. **Generate unique names** with timestamps/random strings
3. **Clean up in reverse order** (questions before question sets)
4. **Handle cleanup errors gracefully** with try/catch
5. **Use afterEach/afterAll hooks** for consistent cleanup
6. **Test cleanup logic** in development environment

---

## API Documentation

### Authentication & User Management
```
POST   /api/auth/register          # User registration
POST   /api/auth/login             # User login
POST   /api/auth/logout            # User logout
POST   /api/auth/refresh           # Refresh JWT token
GET    /api/auth/verify            # Verify token validity
POST   /api/auth/forgot-password   # Request password reset
POST   /api/auth/reset-password    # Complete password reset
POST   /api/auth/change-password   # Change password (authenticated)
GET    /api/auth/needs-password-change # Check if password change required
POST   /api/auth/force-password-change # Force password change with reset token

GET    /api/user/profile           # Get user profile
PUT    /api/user/profile           # Update user profile
GET    /api/user/preferences       # Get learning preferences
PUT    /api/user/preferences       # Update preferences
DELETE /api/user/account           # Delete user account
```

### Course & Content Management
```
GET    /api/courses                # List all courses (with filters)
POST   /api/courses                # Create new course (instructors only)
GET    /api/courses/:id            # Get course details
PUT    /api/courses/:id            # Update course (instructors only)
DELETE /api/courses/:id            # Delete course (instructors only)

GET    /api/courses/:id/lessons    # Get course lessons
POST   /api/courses/:id/lessons    # Add lesson to course
GET    /api/lessons/:id            # Get lesson details
PUT    /api/lessons/:id            # Update lesson
DELETE /api/lessons/:id            # Delete lesson
```

### Learning Progress & Analytics
```
POST   /api/enrollments            # Enroll in course
GET    /api/enrollments            # Get user enrollments
DELETE /api/enrollments/:id       # Unenroll from course

GET    /api/progress/courses       # Get course progress summary
GET    /api/progress/courses/:id   # Get detailed course progress
POST   /api/progress/lessons/:id   # Update lesson progress
GET    /api/analytics/dashboard    # Get learning analytics dashboard
```

### Social & Interaction
```
GET    /api/social/friends         # Get user's friends
POST   /api/social/friends         # Send friend request
PUT    /api/social/friends/:id     # Accept/decline friend request
DELETE /api/social/friends/:id     # Remove friend

GET    /api/forums                 # Get discussion forums
POST   /api/forums                 # Create forum post
GET    /api/forums/:id/posts       # Get forum posts
POST   /api/forums/:id/posts       # Reply to forum
```

### Questions API (Public)

The questions API supports standardized pagination and sorting across list/search endpoints.

- Endpoints:
  - `GET /api/questions/sets?limit&offset&sort&dir&active&publicOnly&category`
  - `GET /api/questions/sets/:id/questions?limit&offset&sort&dir&lang`
  - `GET /api/questions/search?q&setId&limit&offset&sort&dir&lang`

- Standardized query params:
  - `limit` (default 25, max 100)
  - `offset` (default 0)
  - `sort` and `dir`:
    - For sets: `sort` in [`name`, `created_at`, `updated_at`, `is_featured`], `dir` in `ASC|DESC`
    - For questions: `sort` in [`id`, `difficulty`, `created_at`], `dir` in `ASC|DESC`
  - Additional filters/flags:
    - Sets: `active` (default true), `publicOnly` (default false), `category` (optional)
    - Search: `q` (required), `setId` (optional)
    - Localization: `lang` in `en|de` (default `en`)

- Response shape (standardized):
  ```json
  {
    "items": [ /* QuestionSet[] or Question[] (localized for search/sets/:id/questions) */ ],
    "total": 123,
    "limit": 25,
    "offset": 0,
    "sort": { "by": "created_at", "dir": "DESC" },
    "pagination": { "page": 1, "limit": 25, "total": 123, "pages": 5 }
  }
  ```

**Notes:**
- Stable sorting is enforced with a secondary `id ASC` to ensure deterministic results
- Legacy params (`page`, `pageSize`, `sortBy`, `sortDir`) are still accepted for compatibility

---

## WebSocket Events

### Real-time Learning Features
```javascript
// Client events (sent to server)
'join:course'           // Join course room for real-time updates
'leave:course'          // Leave course room
'progress:update'       // Update learning progress
'message:send'          // Send chat message
'study:session:start'   // Start study session
'study:session:end'     // End study session

// Server events (sent to client)
'course:update'         // Course content updated
'progress:sync'         // Sync progress across devices
'notification:new'      // New notification received
'message:received'      // New chat message
'friend:online'         // Friend came online
'achievement:unlocked'  // New achievement earned
'study:reminder'        // Study session reminder
```

### Real-time Collaboration
```javascript
// Study groups and collaboration
'group:join'            // Join study group
'group:leave'           // Leave study group
'group:message'         // Group chat message
'whiteboard:update'     // Collaborative whiteboard changes
'screenshare:start'     // Start screen sharing
'screenshare:stop'      // Stop screen sharing
```

---

## Database Schema

### User Management
```sql
-- Users table with comprehensive profile
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    learning_preferences JSONB,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User sessions for security tracking
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);
```

### Learning Content
```sql
-- Courses structure
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    estimated_duration INTEGER, -- in minutes
    category_id INTEGER REFERENCES categories(id),
    instructor_id INTEGER REFERENCES users(id),
    is_published BOOLEAN DEFAULT false,
    tags JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lessons within courses
CREATE TABLE lessons (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    lesson_type VARCHAR(50) NOT NULL, -- 'video', 'text', 'quiz', 'exercise'
    order_index INTEGER NOT NULL,
    duration INTEGER, -- in minutes
    resources JSONB, -- links, files, etc.
    prerequisites JSONB, -- lesson dependencies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Progress Tracking
```sql
-- User course enrollments
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    last_accessed TIMESTAMP,
    UNIQUE(user_id, course_id)
);

-- Detailed lesson progress
CREATE TABLE lesson_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
    completion_percentage DECIMAL(5,2) DEFAULT 0,
    time_spent INTEGER DEFAULT 0, -- in seconds
    attempts INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(user_id, lesson_id)
);
```

### Performance Optimizations
```sql
-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_courses_published ON courses(is_published);

-- Composite indexes for complex queries
CREATE INDEX idx_lessons_course_order ON lessons(course_id, order_index);
CREATE INDEX idx_progress_user_status ON lesson_progress(user_id, status);
CREATE INDEX idx_enrollments_progress ON enrollments(user_id, progress_percentage);
```

### Data Integrity Constraints
```sql
-- Ensure progress percentages are valid
ALTER TABLE enrollments 
ADD CONSTRAINT chk_progress_range 
CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

ALTER TABLE lesson_progress 
ADD CONSTRAINT chk_completion_range 
CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

-- Ensure lesson order is positive
ALTER TABLE lessons 
ADD CONSTRAINT chk_positive_order 
CHECK (order_index > 0);

-- Ensure time spent is non-negative
ALTER TABLE lesson_progress 
ADD CONSTRAINT chk_non_negative_time 
CHECK (time_spent >= 0);
```

---

## Error Handling

### API Error Responses
```javascript
// Standardized error response format
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Email format is invalid"
    },
    "timestamp": "2024-12-19T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

### Error Categories
- **Authentication Errors**: `AUTH_*` (401, 403)
- **Validation Errors**: `VALIDATION_*` (400)
- **Resource Errors**: `RESOURCE_*` (404, 409)
- **Permission Errors**: `PERMISSION_*` (403)
- **Server Errors**: `SERVER_*` (500)

---

## Performance

### Performance Budgets
- Budgets (DB): hot-path p95 < 100ms, worst-case < 300ms
- Slow-query logging: configured in `database/postgresql.conf` with `log_min_duration_statement = 300` and `auto_explain` for plans > 200ms.
- Extensions: `pg_stat_statements`, `pg_trgm`, `btree_gin` enabled via `database/init.sql`.

### Performance Monitoring
- Capture slow queries:
  - Top slow: `npm --prefix backend run db:top-slow` (uses `pg_stat_statements`)
  - EXPLAIN JSON one-off: `npm --prefix backend run db:explain -- "SELECT ..."` or `db:explain:file`
- Verify indexes via EXPLAIN:
  - Run CI check: `npm --prefix backend run db:check-plans` (fails if plan cost exceeds `MAX_PLAN_COST`)

### Database Indexes
- Trigram GIN on `users.username`, `users.email`, and `questions.question_text` (en/de)
- Composite `hall_of_fame(question_set_id, score DESC, completed_at ASC)` for leaderboard queries
- Existing B-tree indexes on foreign keys, flags, and timestamps

### Application Performance Tuning
- Per-connection `statement_timeout` (default 30s) and `lock_timeout` (5s)
- Slow-query threshold in app logs via `SLOW_QUERY_MS` (default 200ms)

Artifacts and plans should be stored under `docs/perf/` if exported manually (e.g., `explain-*.json`).

---

## Security

### Security Features
- **HTTPS Enforcement**: All traffic encrypted
- **JWT Security**: Short-lived tokens with rotation
- **Input Validation**: Comprehensive sanitization
- **Rate Limiting**: API protection against abuse
- **CSRF Protection**: Cross-site request forgery prevention

### Authentication Security
- JWT with refresh token rotation
- Session tracking with IP and user agent
- Password requirements enforcement
- Account lockout mechanisms

### Data Protection
- Encrypted sensitive data
- Secure password hashing
- Environment variable protection
- Database connection security

---

## Features and Perks

### Learning Features
- **Multiplayer Quiz Games**: Real-time competitive gameplay
- **AI-Powered Questions**: Google Gemini integration for content generation
- **Character Progression**: Experience points, levels, and achievements
- **Progress Tracking**: Detailed analytics and performance insights
- **Gamification**: Points, badges, leaderboards, and character development
- **Social Learning**: Multiplayer lobbies, real-time collaboration

### Accessibility Features
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Keyboard Navigation**: Full keyboard accessibility
- **Visual Accommodations**: High contrast, large text options
- **Audio Descriptions**: For visual content
- **Closed Captions**: For video content

### Performance Features
- **Lazy Loading**: Load content on demand
- **Caching Strategy**: TTL-based caching for question sets and statistics
- **Progressive Web App**: Native app experience
- **Performance Monitoring**: Prometheus metrics and query optimization
- **Database Optimization**: Indexes, connection pooling, and query timeouts

---

## Troubleshooting

### Common Issues

#### Playwright Missing Browsers
- Run `npm run test:browsers:install:all`

#### E2E Cannot Find Chrome Channel
- Ensure Google Chrome (stable) is installed

#### Frontend Build Segfault on Alpine
- Ensure `libc6-compat` is installed in the image

#### Backend Docker Build Segfault
- Build shared packages outside the backend image

#### DB Connection Issues
- Confirm `.env` DB credentials and your active compose profile

#### Password Reset Issues

**Reset Links Still Point to Production**
- Ensure `NODE_ENV=development` is set when starting the backend
- Check that no `APP_BASE_URL` or `FRONTEND_BASE_URL` is set in your environment
- Restart the backend after environment changes

**Email Not Sending**
- Verify SMTP configuration in environment file
- Check backend logs for email service initialization
- Ensure email credentials are valid

**SMTP Authentication Issues**
- Run `npm run smtp:fix` for diagnosis
- Generate new Gmail App Password
- Test with `npm run smtp:test <password>`
- Apply with `npm run smtp:apply <password>`

### Debug Mode

Enable verbose logging for EmailService:
```javascript
// In test or development
process.env.LOG_LEVEL = 'debug';
```

---

## Project Tasks and History

### Completed Tasks

#### Database Migration System Fix
- **Issue**: MigrationService couldn't find migrations directory in Docker containers
- **Solution**: Added volume mounts to docker-compose.yml for both development and test backend services
- **Status**: ✅ Fixed - Migration system now properly locates migration files in all environments

#### TypeScript Direct Execution Configuration
- **Issue**: TypeScript needed to be compiled before starting containers, causing delays in development
- **Solution**: Configured direct TypeScript execution without compilation requirement
- **Benefits**: No TypeScript compilation delays, faster container startup, hot reloading works immediately
- **Status**: ✅ Completed - Containers can now start without TypeScript compilation

#### Docker Networking and API Proxy Configuration Fix
- **Issue**: Frontend development container couldn't connect to backend API endpoints
- **Solution**: Updated Docker networking configuration to use proper service-to-service communication
- **Status**: ✅ Fixed - Frontend can now communicate with backend API in Docker development environment

#### Password Reset Localhost Configuration
- **Issue**: Password reset emails contained production URLs instead of localhost URLs in development
- **Solution**: Implemented environment-aware URL resolution with automatic localhost detection
- **Status**: ✅ Completed - Password reset now works seamlessly with localhost development environment

#### SMTP Service Authentication Fix
- **Issue**: SMTP service reports "mailed but didn't" - emails appear to send but don't reach recipients
- **Solution**: Created comprehensive SMTP diagnosis and fix toolkit
- **Status**: ✅ Fixed - SMTP authentication issue resolved with comprehensive toolkit for future maintenance

#### Password Reset Email Service Configuration Fix
- **Issue**: Password reset button doesn't send emails in production
- **Solution**: Explicitly added SMTP environment variables to Docker Compose backend service configuration
- **Status**: ✅ Fixed - Password reset emails now properly configured and functional

#### QuestionSetManager Export Test Fix
- **Issue**: Test was failing because it tried to find export button while component was still loading
- **Solution**: Added waitFor to ensure loading spinner disappears before attempting to find the export button
- **Status**: ✅ Fixed - Test now properly waits for loading to complete

#### Test Data Cleanup Implementation
- **Issue**: Accumulation of test data in database affecting test performance and reliability
- **Solution**: Implemented comprehensive test data cleanup system with automatic and manual cleanup tools
- **Status**: ✅ Completed - Test environment now maintains clean state automatically

### Security Enhancements
- Automatic .env file backup before updates
- Password validation (16-character Gmail App Password format)
- Enhanced error messages with specific fix instructions
- Prevention of App Password exposure in logs

### Documentation Improvements
- Comprehensive Password Reset System documentation
- SMTP testing and troubleshooting guides
- Test data management best practices
- Complete API documentation with examples

---

This comprehensive documentation serves as the single source of truth for the L2P (Learn2Play) project, combining all previously separate documentation files into one complete guide.
