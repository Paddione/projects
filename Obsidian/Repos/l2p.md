# Learn2Play (l2p)

## Purpose
Multiplayer quiz platform with real-time gameplay. Players create lobbies, invite friends, and compete in trivia games with live scoring and leaderboards.

## Stack
- **Frontend**: React, Vite, Zustand, Socket.io-client
- **Backend**: Express, Node.js, Socket.io, JWT
- **Database**: PostgreSQL (via shared-infrastructure)
- **Testing**: Jest, Testing Library, Supertest, Playwright

## Quick Start
```bash
cd l2p
npm run dev:backend
npm run dev:frontend
```

## Key Scripts
- `npm run dev:backend` - backend dev server
- `npm run dev:frontend` - frontend dev server
- `npm run test:all` - full test suite
- `npm run build:all` - build frontend + backend

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Frontend :3000"
        UI[React UI]
        Store[Zustand Stores]
        Socket_C[Socket.io Client]
    end

    subgraph "Backend :3001"
        API[Express REST API]
        Socket_S[Socket.io Server]
        Services[Business Services]
        Repos[Data Repositories]
    end

    subgraph "Database"
        DB[(l2p_db)]
    end

    UI --> Store
    Store --> Socket_C
    Store --> API

    Socket_C <--> Socket_S
    API --> Services
    Socket_S --> Services

    Services --> Repos
    Repos --> DB

    style DB fill:#e1f5ff
```

### Frontend Architecture

```mermaid
graph LR
    subgraph "Pages"
        Login[Login Page]
        Lobby[Lobby Page]
        Game[Game Page]
    end

    subgraph "Components"
        C1[LobbyCard]
        C2[PlayerList]
        C3[QuestionCard]
        C4[Leaderboard]
    end

    subgraph "Stores"
        AuthStore[Auth Store]
        LobbyStore[Lobby Store]
        GameStore[Game Store]
    end

    subgraph "Services"
        API[API Service]
        Socket[Socket Service]
    end

    Login --> AuthStore
    Lobby --> LobbyStore
    Game --> GameStore

    AuthStore --> API
    LobbyStore --> Socket
    GameStore --> Socket

    Lobby --> C1
    Lobby --> C2
    Game --> C3
    Game --> C4
```

**Key Directories:**
- `frontend/src/pages/` - Route-level screens
- `frontend/src/components/` - Reusable UI components
- `frontend/src/stores/` - Zustand state management
- `frontend/src/services/` - API and Socket.io clients
- `frontend/src/hooks/` - Custom React hooks

### Backend Architecture

```mermaid
graph TB
    subgraph "Routes Layer"
        R1[/auth]
        R2[/lobbies]
        R3[/game]
        R4[/admin]
    end

    subgraph "Middleware"
        M1[Auth Middleware]
        M2[Validation]
        M3[Rate Limiting]
        M4[Error Handler]
    end

    subgraph "Services Layer"
        S1[AuthService]
        S2[LobbyService]
        S3[GameService]
        S4[UserService]
    end

    subgraph "Repository Layer"
        Repo1[UserRepository]
        Repo2[LobbyRepository]
        Repo3[GameRepository]
    end

    subgraph "Socket.io"
        Socket[Socket Events]
    end

    R1 --> M1
    R2 --> M1
    R3 --> M1

    M1 --> M2
    M2 --> M3
    M3 --> S1

    S1 --> Repo1
    S2 --> Repo2
    S3 --> Repo3

    Socket --> S2
    Socket --> S3

    style Repo1 fill:#e1f5ff
    style Repo2 fill:#e1f5ff
    style Repo3 fill:#e1f5ff
```

**Key Directories:**
- `backend/src/routes/` - HTTP endpoints
- `backend/src/services/` - Business logic
- `backend/src/repositories/` - Data access layer
- `backend/src/middleware/` - Express middleware
- `backend/src/cli/` - Command-line utilities

## Real-time Game Flow

```mermaid
sequenceDiagram
    participant P1 as Player 1
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database

    P1->>FE: Create Lobby
    FE->>BE: Socket: create_lobby
    BE->>DB: INSERT lobby
    DB-->>BE: Lobby created
    BE-->>FE: Socket: lobby_created
    FE-->>P1: Show lobby screen

    Note over P1,FE: Other players join...

    P1->>FE: Start Game
    FE->>BE: Socket: start_game
    BE->>DB: INSERT game
    BE-->>FE: Socket: game_started (broadcast)
    FE-->>P1: Navigate to game

    loop Each Question
        BE->>FE: Socket: question (broadcast)
        P1->>FE: Submit answer
        FE->>BE: Socket: answer_submitted
        BE->>DB: INSERT answer
        BE->>BE: Calculate score
        BE->>DB: UPDATE score
        BE-->>FE: Socket: score_update (broadcast)
    end

    BE->>BE: Game complete
    BE->>DB: UPDATE game status
    BE-->>FE: Socket: game_ended (broadcast)
    FE-->>P1: Show final scores

    style DB fill:#e1f5ff
```

## Key Features

### Lobby System
- Create public/private lobbies
- Real-time player join/leave notifications
- Lobby settings (max players, difficulty, categories)
- Ready-up system before game start

### Real-time Gameplay
- Live question delivery via Socket.io
- Timer synchronization across clients
- Real-time score updates
- Instant answer validation
- Live leaderboard

### Scoring System
- Points based on correctness and speed
- Combo multipliers for streak
- Rating system (ELO-like)
- Historical statistics

## Run Locally

### Development Mode

```bash
cd l2p

# Start backend (Terminal 1)
npm run dev:backend   # http://localhost:3001

# Start frontend (Terminal 2)
npm run dev:frontend  # http://localhost:3000
```

### Docker Development

```bash
cd l2p

# Start full stack
npm run deploy:dev

# View logs
npm run deploy:logs

# Stop stack
npm run deploy:down
```

**Docker Ports:**
- Frontend: http://localhost:3007
- Backend: http://localhost:3008

## Build

```bash
cd l2p

# Build everything
npm run build:all

# Build individual parts
npm run build:frontend
npm run build:backend
```

## Testing

```mermaid
graph TB
    subgraph "Unit Tests"
        U1[Services]
        U2[Components]
        U3[Utilities]
    end

    subgraph "Integration Tests"
        I1[HTTP API]
        I2[Socket.io Events]
        I3[Test DB :5433]
    end

    subgraph "E2E Tests"
        E1[Full Game Flow]
        E2[Playwright]
    end

    U1 --> I1
    U2 --> E1
    I1 --> I2
    I2 --> I3
    I3 --> E1

    style I3 fill:#e1f5ff
```

### Test Commands

```bash
cd l2p

# Run all tests
npm run test:all

# Unit tests only
npm run test:unit
npm run test:unit:frontend
npm run test:unit:backend

# Integration tests
npm run test:integration
npm run test:integration:frontend
npm run test:integration:backend

# E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch

# Type checking
npm run typecheck
```

### Test One File

```bash
cd l2p

# Backend unit test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# Frontend unit test
cd frontend
NODE_ENV=test npx jest src/components/Login.test.tsx

# Integration test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/integration/auth.test.ts

# E2E spec
cd frontend/e2e
npx playwright test tests/login.spec.ts
```

## Database

### Migrations

```bash
cd l2p/backend

# Run migrations
npm run db:migrate

# Check status
npm run db:status

# Health check
npm run db:health

# Rollback
npm run db:rollback
```

### Schema

See [[Database Architecture#L2P Database (l2p_db)]] for detailed schema.

Key tables:
- `users` - User accounts
- `lobbies` - Game lobbies
- `lobby_players` - Lobby memberships
- `games` - Game sessions
- `game_participants` - Player participation
- `questions` - Quiz questions
- `answers` - Player answers

## Environment Setup

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://l2p_user:password@shared-postgres:5432/l2p_db

# JWT
JWT_SECRET=<32-char-hex>
JWT_REFRESH_SECRET=<32-char-hex>

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000

# Production only
COOKIE_DOMAIN=.korczewski.de
COOKIE_SECURE=true
```

### Generate Secrets

```bash
# JWT secrets
openssl rand -hex 32
```

## Ports

| Service | Local dev | Production (Traefik internal) | Docker test stack |
|---------|-----------|--------------------------------|-------------------|
| Frontend | 3000 | 80 | 3007 |
| Backend API | 3001 | 3001 | 3006 |
| Postgres (test) | 5433 | - | 5433 |
| Redis (test) | 6380 | - | 6380 |
| MailHog (test) | 8025 | - | 8025 |

## API Endpoints

### REST API

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
POST   /api/lobbies
GET    /api/lobbies
GET    /api/lobbies/:id
DELETE /api/lobbies/:id
GET    /api/game/:id
GET    /api/leaderboard
```

### Socket.io Events

**Client → Server:**
- `create_lobby`
- `join_lobby`
- `leave_lobby`
- `start_game`
- `answer_submitted`

**Server → Client:**
- `lobby_created`
- `lobby_updated`
- `player_joined`
- `player_left`
- `game_started`
- `question`
- `answer_result`
- `score_update`
- `game_ended`

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend won't start | Check `shared-infrastructure` is running |
| Socket.io connection fails | Verify CORS_ORIGINS in .env |
| Tests hang | Use `--forceExit --detectOpenHandles` |
| DB connection error | Check DATABASE_URL matches shared-infrastructure |
| Frontend API calls fail | Verify BACKEND_URL in frontend .env |

### Debug Mode

```bash
# Backend debug logs
DEBUG=* npm run dev:backend

# Frontend with source maps
npm run dev:frontend
```

## Links

- [[Architecture Overview]] - System architecture
- [[Database Architecture]] - Database details
- [[Testing Strategy]] - Testing approach
- [[Deployment Architecture]] - Deployment guide
- [[Repository Index]] - Back to index
