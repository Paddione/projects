# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Learn2Play (L2P) is a real-time multiplayer quiz platform with React frontend and Node.js/TypeScript backend featuring:
- Real-time multiplayer gameplay via Socket.IO
- JWT authentication with email verification and password reset
- PostgreSQL database with migration system
- AI-powered question generation via Google Gemini API
- File upload/processing (PDF, DOCX, TXT, MD)
- Comprehensive testing framework (Jest + Playwright)
- Docker Compose deployment with development/testing/production profiles
- Character progression and gamification system

## Essential Commands

### Development
```bash
# Quick start development
npm run dev:no-compile              # Direct TypeScript execution (fastest)
npm run dev:frontend               # Frontend only
npm run dev:backend                # Backend only (with compilation)
npm run dev:backend:tsx            # Backend only (direct TypeScript)

# Install all dependencies
npm run install:all

# Environment validation
npm run validate:no-compile
npm run test:env:validate

# Docker development
docker-compose --profile development up
```

### Testing (Critical for this project)
```bash
# Interactive test runner (recommended)
./test-runner.sh                   # Interactive menu
npm run test:interactive           # Same as above

# Complete test suite
npm run test:all                   # Unit + Integration + E2E

# By test type
npm run test:unit                  # Frontend + backend unit tests
npm run test:integration           # Frontend + backend integration tests
npm run test:e2e                   # Playwright E2E tests

# Coverage reports
npm run test:coverage              # Full coverage reports

# Specific components
npm run test:unit:frontend
npm run test:unit:backend
npm run test:integration:frontend
npm run test:integration:backend
npm run test:e2e:headed           # With browser UI
npm run test:e2e:ui               # Playwright UI mode

# Performance testing
npm --prefix backend run test:performance

# SMTP testing
npm run test:smtp                  # Test email functionality
npm run smtp:fix                   # Diagnose SMTP issues
```

### Browser Installation (Required for E2E)
```bash
npm run test:browsers:install:all  # Install Playwright browsers
```

### Database Management
```bash
# Backend database utilities
npm --prefix backend run db:migrate    # Run migrations
npm --prefix backend run db:health     # Check connection
npm --prefix backend run db:status     # Migration status
npm --prefix backend run db:validate   # Schema validation
```

### Docker Development
```bash
# Development profile (uses direct TypeScript execution)
docker-compose --profile development up
docker-compose --profile development down

# Production deployment
npm run rebuild                    # Runs rebuild.sh
```

## Architecture Overview

### Backend (`backend/`)
- **Framework**: Express + TypeScript with direct execution via `tsx`
- **Database**: PostgreSQL with migration system (`migrations/`)
- **Authentication**: JWT with refresh tokens, email verification, password reset
- **WebSockets**: Socket.IO for real-time multiplayer features
- **File Processing**: Supports PDF, DOCX, TXT, MD for AI question generation
- **AI Integration**: Google Gemini API for question generation
- **Services**: Repository pattern with dedicated services for game logic, auth, etc.
- **Middleware**: Rate limiting, CORS, security headers, request logging, metrics

Key service structure:
- `services/AuthService.ts` - Authentication and user management
- `services/GameService.ts` - Multiplayer game logic and session management
- `services/LobbyService.ts` - Lobby management and player coordination
- `services/QuestionService.ts` - Question/quiz management with caching
- `services/SocketService.ts` - WebSocket handling and real-time communication
- `services/FileProcessingService.ts` - Document processing and AI integration
- `services/CharacterService.ts` - Character progression and gamification
- `services/ScoringService.ts` - Game scoring and leaderboards
- `repositories/` - Database access layer

### Frontend (`frontend/`)
- **Framework**: React 18 + TypeScript + Vite
- **State Management**: Zustand stores
- **Routing**: React Router with protected routes
- **WebSockets**: Socket.IO client for real-time features
- **Testing**: Jest (unit) + Playwright (E2E)
- **Styling**: CSS Modules with theme support
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

Key store structure:
- `stores/authStore.ts` - Authentication state and user management
- `stores/gameStore.ts` - Game state and multiplayer logic
- `stores/settingsStore.ts` - User preferences, themes, audio settings
- `stores/characterStore.ts` - Character progression and experience

### Database Schema
- Users with authentication, experience tracking, admin flags, character progression
- Game sessions, lobbies, scoring, and player statistics
- Question sets with AI-generated content and difficulty levels
- Hall of fame/leaderboards with character-based rankings
- Character system with levels, experience points, and achievements
- Migrations in `backend/migrations/` with timestamp naming

## Development Workflow

### No-Compilation Development (Recommended)
The project uses direct TypeScript execution for faster development:
- Backend runs with `tsx` (no build step required)
- Frontend uses Vite's on-the-fly transpilation
- Validates with: `npm run validate:no-compile`

### Testing Strategy
1. **Unit Tests**: Mock database by default, test individual components
2. **Integration Tests**: Connect to test database, test API endpoints
3. **E2E Tests**: Full browser testing with Playwright
4. **Performance Tests**: Artillery-based load testing

Test environment auto-selection:
- Prefers local test DB (`learn2play_test`)
- Falls back to prod DB if `ALLOW_PROD_DB_IN_TESTS=true`
- Many unit tests mock DB - use integration tests for real DB testing

### Database Development
- Migrations use timestamp format: `YYYYMMDD_HHMMSS_description.sql`
- Always run migrations before starting development
- Test connection: `npm --prefix backend run db:test`

## Docker Configuration

### Development Profile
- Direct TypeScript execution (no compilation)
- Hot reloading enabled with volume mounts
- Debug ports exposed (9229)
- Live code changes via volume mounts
- Shared package dependencies mounted

### Production Profile  
- Multi-stage builds with production optimization
- Nginx Proxy Manager with SSL certificates
- Health checks and resource limits
- Structured logging and monitoring
- Prometheus metrics endpoint

### Test Profile
- Ephemeral test databases
- Isolated test environment
- Optimized for CI/CD
- Performance testing support

## Key Files and Patterns

### Backend Entry Point
`backend/src/server.ts` - Express app with middleware, routes, Socket.IO setup

### Frontend Entry Point
`frontend/src/App.tsx` - React app with routing, theme provider, auth guards

### Configuration
- Environment variables in `.env*` files
- Backend config: `backend/src/config/env.ts`
- Database config: `backend/database.ts`

### Testing Configuration
- Jest configs: `jest.config.js` (root), `frontend/jest.config.mjs`, `backend/jest.config.mjs`
- Playwright: `frontend/playwright.config.ts`, `frontend/e2e/`
- Test runner: `test-runner.sh` (interactive)

### Shared Code
- `shared/error-handling/` - Common error handling utilities
- `shared/test-config/` - Testing utilities and configuration

## Important Implementation Details

### Real-time Multiplayer
- Socket.IO handles room management for lobbies and games
- Game state synchronized across all players with real-time updates
- Disconnect/reconnect handling with game state recovery
- Character progression and experience tracking
- Live scoring and leaderboard updates

### File Upload System
- Supports PDF, DOCX, TXT, Markdown processing
- Integrates with Google Gemini AI for question generation
- Secure file handling with type validation and sanitization
- AI-powered question extraction and difficulty assessment
- Multi-language support (German/English)

### Authentication Flow
- JWT access tokens (15min) + refresh tokens (7 days)
- Email verification required for new accounts
- Password reset via email tokens with temporary passwords
- Admin panel for user management
- Character progression and experience tracking

### Performance Optimizations
- ETag caching for static resources
- Database query optimization with indexes and caching
- Connection pooling and query timeouts
- Rate limiting on API endpoints
- Question set caching with TTL
- Performance monitoring with Prometheus metrics

## Common Development Tasks

### Adding New Features
1. Create/modify database migrations in `backend/migrations/`
2. Add repository methods in `backend/src/repositories/`
3. Implement service logic in `backend/src/services/`
4. Add API routes in `backend/src/routes/`
5. Create React components in `frontend/src/components/`
6. Add tests for all layers

### Running Specific Tests
```bash
# Single test file
npm --prefix backend run test -- --testPathPattern="AuthService.test.ts"

# Debug mode
NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand --no-cache AuthService.test.ts

# With real database
ALLOW_PROD_DB_IN_TESTS=true npm --prefix backend run test:integration
```

### Database Operations
```bash
# Check slow queries
npm --prefix backend run db:top-slow

# Explain query performance
npm --prefix backend run db:explain "SELECT * FROM users WHERE email = $1"

# Check execution plans
npm --prefix backend run db:check-plans
```

### Deployment
```bash
# Build and deploy all services
npm run rebuild                   # Wrapper for rebuild.sh
./rebuild.sh                     # Direct script execution

# Build specific service
./rebuild.sh rebuild-backend
./rebuild.sh rebuild-frontend

# Reset database after deployment
./rebuild.sh rebuild-all --reset-db

# Docker Compose profiles
docker-compose --profile production up    # Production
docker-compose --profile development up   # Development
docker-compose --profile test up          # Testing
```

## Security Considerations

- JWT secrets must be configured in production
- SMTP credentials for email functionality (Gmail App Passwords)
- Rate limiting enabled on all routes
- Helmet.js for security headers
- Input validation using Joi schemas
- File upload restrictions and scanning
- Docker secrets for sensitive data in production
- CORS configuration with environment-aware origins
- Password requirements enforcement

## Monitoring and Debugging

- Health endpoints: `/api/health`, `/health`
- Metrics endpoint: `/metrics` (Prometheus format)
- Structured logging with correlation IDs
- Performance monitoring with query timing
- Error tracking with stack traces
- Log file rotation and cleanup
- SMTP testing and diagnostics: `npm run smtp:fix`
- Test environment management scripts

This project emphasizes comprehensive testing, real-time functionality, and production-ready deployment patterns.
