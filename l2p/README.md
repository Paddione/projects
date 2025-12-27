# Learn2Play

A multiplayer quiz platform with real-time gameplay, comprehensive testing infrastructure, and production-ready deployment.

## Overview

Learn2Play is a full-stack web application that enables users to participate in live multiplayer quiz games. Built with React, Express, and PostgreSQL, it features real-time Socket.io communication, robust authentication, and an extensive testing suite.

## Features

- **Real-time Multiplayer**: Socket.io-powered live quiz sessions
- **User Authentication**: JWT-based auth with secure password hashing
- **Lobby System**: Create and join game lobbies with real-time updates
- **Question Management**: Rich question database with multiple categories
- **Player Progression**: Level-up system with experience points and badges
- **Admin Panel**: User management and game moderation tools
- **Comprehensive Testing**: Unit, integration, and E2E test coverage
- **Docker Deployment**: Production-ready containerized setup

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Wouter** for client-side routing
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Socket.io Client** for real-time communication

### Backend
- **Express** with TypeScript
- **Socket.io** for WebSocket communication
- **Drizzle ORM** for database operations
- **PostgreSQL** for data persistence
- **Passport.js** with JWT strategy
- **Rate limiting** and security middleware

### Testing
- **Vitest** for unit tests
- **Playwright** for E2E tests
- **Jest** with ES modules support
- **Custom test environment** scripts

## Prerequisites

- **Node.js 20+** and npm
- **Docker & Docker Compose**
- **PostgreSQL 15+** (or use Docker)

## Quick Start

### 1. Environment Setup

```bash
# Copy environment templates
cp .env.example .env
cp .env.dev .env.development
cp .env.production.example .env.production

# Edit .env files with your configuration
# Important: Use alphanumeric-only values for Postgres credentials
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, frontend, backend)
npm run install:all

# Or install individually
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 3. Database Setup

**Option A: Docker (Recommended)**
```bash
# Start PostgreSQL container
npm run deploy:dev

# Run migrations
npm run db:migrate
```

**Option B: Local PostgreSQL**
```bash
# Ensure PostgreSQL is running on port 5432
# Create database: learn2play
# Update .env with connection details

# Run migrations
npm run db:migrate
```

### 4. Start Development

```bash
# Start backend (port 5001)
npm run dev:backend

# In another terminal, start frontend (port 5173)
npm run dev:frontend
```

Access the application at http://localhost:5173

## Development Commands

### Development Servers
```bash
npm run dev:frontend          # Frontend dev server (Vite)
npm run dev:backend           # Backend dev server
npm run dev:backend:tsx       # Backend with tsx hot reload
```

### Building
```bash
npm run build:all             # Build both frontend and backend
npm run build:frontend        # Build frontend only
npm run build:backend         # Build backend only
```

### Testing

**Unit Tests**
```bash
npm run test:unit             # Run all unit tests
npm run test:unit:frontend    # Frontend unit tests only
npm run test:unit:backend     # Backend unit tests only
npm run test:watch            # Watch mode for unit tests
```

**Integration Tests**
```bash
npm run test:integration           # All integration tests
npm run test:integration:frontend  # Frontend integration tests
npm run test:integration:backend   # Backend integration tests
```

**E2E Tests**
```bash
# Install Playwright browsers first
npm run test:browsers:install

# Run E2E tests
npm run test:e2e              # Headless mode
npm run test:e2e:headed       # With browser UI
npm run test:e2e:ui           # Playwright UI mode
```

**Full Test Suite**
```bash
npm run test:all              # Unit + Integration + E2E
npm run test:all:ci           # CI-optimized test run
npm run typecheck             # TypeScript type checking
```

**Coverage**
```bash
npm run coverage:all          # Generate coverage reports
npm run coverage:report       # View coverage summary
npm run coverage:badge        # Generate coverage badge
```

### Docker Deployment

**Development**
```bash
npm run deploy:dev            # Start dev stack
npm run deploy:logs           # View logs
npm run deploy:down           # Stop containers
```

**Production**
```bash
npm run deploy:prod           # Start production stack
npm run stop                  # Stop production stack
```

**Rebuild**
```bash
./rebuild.sh                  # Full rebuild (stop, build, start)
```

### Database Operations
```bash
npm run db:migrate            # Run Drizzle migrations
npm run db:health             # Check database connectivity
```

### Test Environment Management
```bash
npm run test:env:start        # Start test containers
npm run test:env:stop         # Stop test containers
npm run test:env:health       # Health check
npm run test:env:status       # View status
npm run test:env:logs         # View test logs
npm run test:env:reset        # Reset test environment
```

### Utility Scripts
```bash
npm run lint:structure        # Verify project structure
npm run import:questions      # Import questions to database
npm run smtp:test             # Test SMTP configuration
npm run diagnostics:ts        # Count TypeScript diagnostics
```

## Project Structure

```
l2p/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # Business logic services
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript types
│   │   └── __tests__/       # Frontend tests
│   ├── public/              # Static assets
│   └── package.json
│
├── backend/                  # Express API server
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Backend services
│   │   ├── middleware/      # Express middleware
│   │   ├── repositories/    # Data access layer
│   │   ├── socket/          # Socket.io handlers
│   │   └── __tests__/       # Backend tests
│   ├── drizzle/             # Database migrations
│   └── package.json
│
├── shared/                   # Shared code
│   ├── test-config/         # Test configuration utilities
│   └── types/               # Shared TypeScript types
│
├── scripts/                  # Build and utility scripts
├── config/                   # Configuration files
├── database/                 # SQL schemas and data
├── docs/                     # Documentation
│
├── docker-compose.yml        # Development stack
├── docker-compose.prod.yml   # Production overrides
├── docker-compose.test.yml   # Test environment
├── test-config.yml           # Test configuration
├── rebuild.sh                # Full rebuild script
├── setup.sh                  # Setup automation
└── package.json              # Root workspace config
```

## Architecture

### Workspace Structure

This is a monorepo using npm workspaces. The root `package.json` orchestrates the frontend and backend workspaces, allowing commands to be run from the root or from individual workspace directories.

### Backend Architecture

**Key Services:**
- `AuthService`: User authentication and authorization
- `GameService`: Multiplayer game logic and state management
- `LobbyService`: Lobby creation and management
- `SocketService`: Real-time Socket.io event handling
- `DatabaseService`: Drizzle ORM wrapper with connection pooling
- `EmailService`: SMTP email notifications

**Database Schema (Drizzle ORM):**
- Users with authentication and profiles
- Game sessions and question management
- Player statistics and progression
- Lobby and multiplayer state

**API Routes:**
- `/api/auth/*` - Authentication endpoints
- `/api/users/*` - User management
- `/api/games/*` - Game operations
- `/api/lobbies/*` - Lobby management
- `/api/admin/*` - Admin operations

### Frontend Architecture

**Core Components:**
- `GameRoom`: Main game interface
- `Lobby`: Multiplayer lobby management
- `PlayerGrid`: Real-time player display
- `QuestionCard`: Question rendering
- `Leaderboard`: Score tracking

**Services:**
- `navigationService`: Client-side routing
- `socketService`: Socket.io client wrapper
- `authService`: Authentication state management

### Real-time Communication

Socket.io events handle real-time multiplayer:
- `join-lobby`: Player joins a lobby
- `leave-lobby`: Player leaves
- `game-start`: Game session begins
- `submit-answer`: Player submits answer
- `game-state-update`: Broadcast game state
- `player-update`: Player status changes

## Testing

### Test Environment

Tests use a separate test database (port 5433) and require specific environment setup:

```bash
NODE_OPTIONS="--experimental-vm-modules" TEST_ENVIRONMENT=local TEST_TYPE=unit
```

### Test Types

**Unit Tests**: Mock external dependencies, test individual components/services
**Integration Tests**: Use test database, test service interactions
**E2E Tests**: Full application testing with Playwright

### Important Testing Notes

1. **ES Modules**: All tests require `NODE_OPTIONS=--experimental-vm-modules`
2. **Test Database**: Must run on port 5433 (dev uses 5432)
3. **Integration Tests**: Need `--forceExit --detectOpenHandles` flags
4. **Coverage**: Collected via custom CoverageConfigCLI in `/shared/test-config`

### Running Specific Tests

```bash
# Run specific test file
NODE_OPTIONS="--experimental-vm-modules" npx jest path/to/test.ts

# Run with pattern
npm run test:unit -- --testNamePattern="should validate user"

# Run integration test
npm run test:integration:backend -- --testPathPattern="AuthRoutes"
```

## Configuration

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `SESSION_SECRET`: Express session secret

**Optional:**
- `SMTP_*`: Email configuration (host, port, user, pass)
- `FRONTEND_URL`: Frontend URL for CORS
- `NODE_ENV`: Environment (development, production, test)

### Test Configuration

`test-config.yml` defines test environment settings:
- Port configurations
- Timeout values
- Browser settings for E2E
- Coverage thresholds

## Deployment

### Docker Production Deployment

```bash
# Build and start production stack
npm run deploy:prod

# Services started:
# - PostgreSQL (port 5432)
# - Backend API (port 5001)
# - Frontend (port 5173, proxied via nginx)
# - Nginx reverse proxy (port 80)
```

### Manual Deployment

1. Build the application:
   ```bash
   npm run build:all
   ```

2. Set production environment variables

3. Run database migrations:
   ```bash
   NODE_ENV=production npm run db:migrate
   ```

4. Start the backend:
   ```bash
   cd backend && npm start
   ```

5. Serve frontend static files (from `frontend/dist`)

### Health Checks

```bash
# Database health
npm run db:health

# Test environment health
npm run test:env:health

# Manual curl check
curl http://localhost:5001/health
```

## Troubleshooting

### Common Issues

**Tests failing with module errors:**
- Ensure `NODE_OPTIONS="--experimental-vm-modules"` is set
- Check that you're using the correct Jest command from package.json

**Database connection errors:**
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists and migrations are run
- For tests, verify test database on port 5433

**Socket.io connection issues:**
- Check CORS configuration in backend
- Verify frontend is using correct backend URL
- Check browser console for connection errors

**Docker port conflicts:**
- Stop existing containers: `npm run deploy:down`
- Check for processes on ports 5432, 5001, 5173, 80
- Use `docker ps` to see running containers

**Test environment not starting:**
- Run `npm run test:env:cleanup` to reset
- Check Docker daemon is running
- Review logs with `npm run test:env:logs`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the full test suite: `npm run test:all`
5. Run type checking: `npm run typecheck`
6. Submit a pull request

## License

MIT

## Support

For issues and questions, please check:
- `docs/` directory for detailed documentation
- `CLAUDE.md` for development guidelines
- GitHub Issues (if applicable)
