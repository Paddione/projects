# Testing Strategy

Comprehensive testing approach across the monorepo with visual test architecture.

## Testing Pyramid

```mermaid
graph TB
    subgraph "Testing Layers"
        E2E[End-to-End Tests<br/>Playwright<br/>Full user flows]
        Integration[Integration Tests<br/>Jest + Supertest<br/>API + Socket.io]
        Unit[Unit Tests<br/>Jest + Vitest<br/>Functions & Components]
    end

    E2E --> Integration
    Integration --> Unit

    style E2E fill:#ffe1e1
    style Integration fill:#fff4e1
    style Unit fill:#e1ffe1
```

**Philosophy:**
- **Many unit tests** - Fast, isolated, test business logic
- **Some integration tests** - Test service interactions
- **Few E2E tests** - Test critical user paths only

## Test Architecture by Project

### L2P Testing Architecture

```mermaid
flowchart LR
    subgraph "Unit Tests"
        U1[Services<br/>AuthService<br/>GameService]
        U2[Components<br/>Login<br/>Lobby<br/>Game]
        U3[Utilities<br/>Validators<br/>Helpers]
    end

    subgraph "Integration Tests"
        I1[HTTP Routes<br/>Supertest]
        I2[Socket.io Events<br/>Real connections]
        I3[Test DB<br/>:5433]
    end

    subgraph "E2E Tests"
        E1[Full Game Flow<br/>Playwright]
        E2[Docker Stack<br/>:3007/:3008]
    end

    U1 --> I1
    U2 --> E1
    I1 --> I2
    I2 --> I3
    I3 --> E1
    E1 --> E2

    style I3 fill:#e1f5ff
    style E2 fill:#ffe1e1
```

#### L2P Test Commands

```bash
# Run all tests
cd l2p
npm run test:all

# Unit tests only (fast)
npm run test:unit
npm run test:unit:frontend
npm run test:unit:backend

# Integration tests (slower)
npm run test:integration
npm run test:integration:frontend
npm run test:integration:backend

# E2E tests (slowest)
npm run test:e2e

# Watch mode for rapid development
npm run test:watch
```

#### L2P Test Database

```mermaid
graph LR
    subgraph "Development"
        Dev[Dev DB<br/>:5432]
    end

    subgraph "Testing"
        Test[Test DB<br/>:5433]
    end

    subgraph "Tests"
        Unit[Unit Tests<br/>Mocked DB]
        Integration[Integration Tests<br/>Real connections]
        E2E[E2E Tests<br/>Docker DB]
    end

    Unit -.->|No DB| Dev
    Integration --> Test
    E2E --> Dev

    style Test fill:#e1f5ff
    style Dev fill:#ffe1e1
```

**Key Points:**
- Integration tests use separate DB on port **5433**
- Prevents interference with development data
- Tests run with `--forceExit --detectOpenHandles` to handle Socket.io cleanup
- All tests use `NODE_OPTIONS=--experimental-vm-modules` for ESM support

### VideoVault Testing Architecture

```mermaid
flowchart TB
    subgraph "Unit Tests - Vitest"
        VU1[VideoDatabase Service]
        VU2[FileScanner Service]
        VU3[FilterEngine Service]
        VU4[React Components]
    end

    subgraph "E2E Tests - Playwright"
        VE1[File Selection Flow]
        VE2[Video Playback]
        VE3[Filtering & Search]
        VE4[Bulk Operations]
    end

    subgraph "Test Environment"
        Docker[Docker Container<br/>:5000]
        TestFiles[Mock Video Files]
    end

    VU1 --> VE1
    VU2 --> VE1
    VU3 --> VE3
    VU4 --> VE2

    VE1 --> Docker
    VE2 --> Docker
    VE3 --> Docker
    VE4 --> Docker

    Docker --> TestFiles

    style Docker fill:#ffe1e1
    style TestFiles fill:#e1f5ff
```

#### VideoVault Test Commands

```bash
cd VideoVault

# Unit tests
npm test
npm run test:watch

# Type checking
npm run check

# Full verification (types + tests + build)
npm run verify

# E2E with Docker
npm run docker:pw:all    # Complete E2E suite
npm run docker:pw:up     # Start test environment
npm run docker:pw:run    # Run tests only
npm run docker:down      # Cleanup
```

**Key Constraints:**
- File System Access API requires Chromium-based browsers
- E2E tests need Docker environment with test video files
- Unit tests mock File System API

### Payment Testing Architecture

```mermaid
flowchart LR
    subgraph "Unit Tests"
        PU1[API Routes]
        PU2[Stripe Integration]
        PU3[Database Models]
    end

    subgraph "E2E Tests"
        PE1[Payment Flow]
        PE2[Stripe Webhooks]
        PE3[Auth Integration]
    end

    subgraph "External"
        Stripe[Stripe Test Mode]
        DB[(Postgres)]
    end

    PU1 --> PE1
    PU2 --> PE1
    PU3 --> PE1

    PE1 --> Stripe
    PE2 --> Stripe
    PE3 --> DB

    style Stripe fill:#ffe1e1
    style DB fill:#e1f5ff
```

#### Payment Test Commands

```bash
cd payment

# All tests
npm test

# E2E tests
npm run test:e2e

# Lint
npm run lint
```

## Test Environment Management

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Test as Test Runner
    participant Env as Environment Setup
    participant DB as Test Database
    participant App as Application

    Dev->>Test: Run Tests
    Test->>Env: Load .env.test
    Env->>DB: Create Test Schema
    DB-->>Env: Ready
    Env->>App: Start Test Instance
    App-->>Test: Application Ready

    loop Each Test
        Test->>App: Execute Test
        App->>DB: Test Operations
        DB-->>App: Results
        App-->>Test: Assertions
    end

    Test->>DB: Cleanup/Rollback
    Test->>App: Shutdown
    Test-->>Dev: Test Results

    style DB fill:#e1f5ff
```

## Running Single Tests

### L2P Single Test File

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

# Single E2E spec
cd frontend/e2e
npx playwright test tests/login.spec.ts
```

### VideoVault Single Test

```bash
cd VideoVault

# Single unit test file
npm run test -- client/src/services/VideoDatabase.test.ts

# Single E2E spec
cd e2e
npx playwright test tests/video-selection.spec.ts
```

## Test Coverage Strategy

```mermaid
pie title Test Coverage Goals
    "Unit Tests" : 70
    "Integration Tests" : 20
    "E2E Tests" : 10
```

**Coverage Targets:**
- **Unit Tests**: 80%+ coverage for services and utilities
- **Integration Tests**: All API endpoints and Socket.io events
- **E2E Tests**: Critical user paths (login, create game, play game, payment flow)

## Common Test Patterns

### Mocking External Services

```typescript
// Mock database
jest.mock('../repositories/UserRepository');

// Mock Socket.io
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn()
};

// Mock API calls
jest.mock('../services/apiService');
```

### Testing Async Operations

```typescript
// Wait for async updates
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Testing Socket.io events
await new Promise((resolve) => {
  socket.on('game:started', resolve);
});
```

### Test Database Cleanup

```typescript
beforeEach(async () => {
  await db.migrate.latest();
});

afterEach(async () => {
  await db.migrate.rollback();
});
```

## CI/CD Integration

```mermaid
flowchart LR
    A[Git Push] --> B[GitHub Actions]
    B --> C{Run Tests}
    C -->|Unit| D[Jest/Vitest]
    C -->|Integration| E[Supertest]
    C -->|E2E| F[Playwright]

    D --> G{All Pass?}
    E --> G
    F --> G

    G -->|Yes| H[Build Docker Images]
    G -->|No| I[Fail PR]

    H --> J[Deploy to Staging]

    style G fill:#e1f5ff
    style I fill:#ffe1e1
    style J fill:#e1ffe1
```

## Debugging Failed Tests

### Jest Debug Mode

```bash
# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose

# Show console.log
npm test -- --silent=false
```

### Playwright Debug Mode

```bash
# Debug with UI
npx playwright test --debug

# Show trace
npx playwright show-trace trace.zip

# Headed mode (see browser)
npx playwright test --headed
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Names**: Describe what is being tested
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock External Deps**: Don't hit real APIs in unit tests
5. **Clean Up**: Always clean up resources (sockets, DB connections)
6. **Fast Feedback**: Unit tests should run in seconds
7. **Deterministic**: Tests should not be flaky

## Links

- [[Architecture Overview]] - System architecture
- [[Repos/l2p|L2P Details]] - L2P testing specifics
- [[Repos/VideoVault|VideoVault Details]] - VideoVault testing details
- [[Repos/payment|Payment Details]] - Payment testing approach
