# Learn2Play E2E Testing Suite

This directory contains comprehensive end-to-end tests for the Learn2Play multiplayer quiz platform using Playwright.

## 🚀 Quick Start

### Option 1: Local Development Environment
```bash
# Install dependencies
cd e2e
npm install

# Install browsers
npm run install:browsers

# Start local frontend dev server (in another terminal)
cd .. && npm run dev

# Run all tests
npm test

# Run tests with UI mode
npm run test:ui

# Run specific test categories
npm run test:smoke
npm run test:integration
npm run test:error-handling
npm run test:performance
npm run test:accessibility
```

### Option 2: Docker Test Environment (Recommended for E2E)
```bash
# From the frontend directory
cd frontend

# Start the complete test environment (PostgreSQL, Backend, Frontend, MailHog, Redis)
npm run start:docker-test

# Wait for all services to be healthy, then run tests
npm run test:e2e:docker

# Or run specific test categories with Docker environment
npm run test:e2e:docker:smoke
npm run test:e2e:docker:integration
npm run test:e2e:docker:headed
npm run test:e2e:docker:ui

# Stop test environment when done
npm run stop:docker-test
```

### Option 3: Manual Docker Test Environment
```bash
# From project root
docker compose -f docker-compose.test.yml up -d --build

# Wait for services to be healthy, then run tests with environment variables
cd frontend
TEST_ENVIRONMENT=docker BASE_URL=http://localhost:3007 API_URL=http://localhost:3006/api npm run test:e2e

# Stop when done
docker compose -f docker-compose.test.yml down -v
```

## 🔧 Test Environment Configuration

### Environment Variables
- `TEST_ENVIRONMENT`: Set to `docker` for Docker test stack, `local` for local development
- `BASE_URL`: Frontend URL (defaults to `http://localhost:3007` for Docker, `http://localhost:3000` for local)
- `API_URL`: Backend API URL (defaults to `http://localhost:3006/api` for Docker, `http://localhost:3001/api` for local)

### Docker Test Stack Ports
- **Frontend**: http://localhost:3007
- **Backend API**: http://localhost:3006/api
- **PostgreSQL**: localhost:5433
- **Redis**: localhost:6380
- **MailHog**: http://localhost:8025

### Local Development Ports
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api

## 📁 Test Structure

```
e2e/
├── tests/
│   ├── smoke/                 # Basic functionality tests
│   │   └── basic-functionality.spec.ts
│   ├── integration/           # Full workflow tests
│   │   └── game-flow.spec.ts
│   ├── error-handling/        # Error scenarios
│   │   ├── network-errors.spec.ts
│   │   └── validation-errors.spec.ts
│   ├── performance/           # Load and performance tests
│   │   └── load-testing.spec.ts
│   └── accessibility/         # A11y compliance tests
│       └── a11y-tests.spec.ts
├── setup.ts                  # Test utilities and fixtures
├── playwright.config.ts      # Playwright configuration
└── package.json
```

## 🎯 Test Categories

### Smoke Tests (`npm run test:smoke`)
- Basic application loading
- User registration and login
- Lobby creation and joining
- Language and theme switching
- Connection status verification

### Integration Tests (`npm run test:integration`)
- Complete game flow (2+ players)
- Player disconnection handling
- Real-time synchronization
- Scoring system validation
- Lobby timeout scenarios

### Error Handling Tests (`npm run test:error-handling`)
- Network failures and API downtime
- WebSocket disconnections
- Invalid input validation
- Authentication errors
- Rate limiting scenarios
- Malformed responses
- Concurrent operations

### Performance Tests (`npm run test:performance`)
- Concurrent user registrations
- Multiple lobby joins
- Rapid question answering
- Memory usage monitoring
- WebSocket connection scaling
- Page reload handling

### Accessibility Tests (`npm run test:accessibility`)
- Keyboard navigation
- Screen reader compatibility
- ARIA attributes validation
- Color contrast checks
- Focus management
- Zoom compatibility

## 🛠️ Configuration

### Environment Variables

```bash
# Base URL for testing
BASE_URL=http://localhost:3000

# API endpoints
API_URL=http://localhost:3001/api
SOCKET_URL=http://localhost:3001

# Test database (for isolated testing)
TEST_DATABASE_URL=postgresql://test_user:test_password@localhost:5433/learn2play_test
```

### Browser Configuration

Tests run on multiple browsers by default:
- Desktop Chrome (primary)
- Desktop Firefox
- Desktop Safari (WebKit)
- Desktop Edge
- Mobile (iPhone 13)
- Tablet (iPad Pro)

### Test Environment Setup

#### Option 1: Using Docker (Recommended)
```bash
# Start test environment
npm run start:test-env

# Run tests
npm test

# Stop test environment
npm run stop:test-env
```

#### Option 2: Local Development
```bash
# Start frontend and backend separately
cd ../frontend && npm run dev
cd ../backend && npm run dev

# Run tests against local servers
npm test
```

## 📝 Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should perform expected behavior', async ({ page }) => {
    // Test implementation
    await page.click('[data-testid="element"]');
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### Using Custom Fixtures

```typescript
import { test } from './setup';

test('should work with authenticated user', async ({ authenticatedPage }) => {
  // Page is already logged in
  await authenticatedPage.click('[data-testid="create-lobby-button"]');
});

test('should work with game lobby', async ({ gameLobby }) => {
  const { page, lobbyCode } = gameLobby;
  // Lobby is already created
});
```

### Test Helpers

```typescript
import { TestHelpers } from './setup';

test('should register user', async ({ page }) => {
  const userData = await TestHelpers.registerUser(page);
  expect(userData.username).toBeTruthy();
});

test('should create lobby', async ({ page }) => {
  await TestHelpers.registerUser(page);
  const lobbyCode = await TestHelpers.createLobby(page, '5', 'general');
  expect(lobbyCode).toMatch(/[A-Z0-9]{6}/);
});
```

## 🔧 Debugging Tests

### Visual Debugging
```bash
# Run with headed browser
npm run test:headed

# Run with debug mode
npm run test:debug

# Open test results
npm run report
```

### Screenshots and Videos
- Screenshots are taken on failure
- Videos are recorded for failed tests
- Traces are captured on retry

### Console Debugging
```typescript
test('debug test', async ({ page }) => {
  // Add console logs
  page.on('console', msg => console.log(msg.text()));
  
  // Pause execution
  await page.pause();
  
  // Take screenshot
  await page.screenshot({ path: 'debug.png' });
});
```

## 🚨 Common Issues and Solutions

### Test Timeouts
```typescript
// Increase timeout for slow operations
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 1 minute
  await page.waitForSelector('[data-testid="slow-element"]', { timeout: 30000 });
});
```

### Flaky Tests
```typescript
// Add wait conditions
await page.waitForLoadState('networkidle');
await expect(page.locator('[data-testid="element"]')).toBeVisible();

// Use retry logic
test.retry(2);
```

### Element Selection
```typescript
// Prefer data-testid over other selectors
await page.click('[data-testid="submit-button"]'); // ✅ Good
await page.click('button:has-text("Submit")'); // ⚠️ Fragile
await page.click('.btn-primary'); // ❌ Avoid
```

## 📊 Test Reporting

### HTML Report
```bash
npm run report
```
Opens detailed HTML report with:
- Test results and failures
- Screenshots and videos
- Performance metrics
- Trace viewer

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run E2E tests
  run: |
    npm run start:test-env
    npm run test
    npm run stop:test-env
  
- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## 🎯 Best Practices

### Data Management
- Use unique test data (timestamps/UUIDs)
- Clean up test data after tests
- Use isolated test databases

### Test Independence
- Each test should be independent
- Don't rely on test execution order
- Use setup/teardown for common operations

### Maintenance
- Keep selectors up to date
- Use Page Object Model for complex flows
- Regular test review and cleanup

### Performance
- Run tests in parallel when possible
- Use efficient selectors
- Minimize unnecessary waits

## 🔄 Continuous Integration

### Pre-commit Hooks
```bash
# Install husky for git hooks
npm install --save-dev husky

# Add pre-commit test run
npx husky add .husky/pre-commit "cd e2e && npm run test:smoke"
```

### Pull Request Validation
- Smoke tests run on every PR
- Full test suite runs on main branch
- Performance regression detection

## 📈 Metrics and Monitoring

### Performance Tracking
- Page load times
- API response times
- Memory usage patterns
- WebSocket connection stability

### Test Coverage
- Feature coverage matrix
- Browser compatibility
- Accessibility compliance
- Error scenario coverage

## 🆘 Support

For issues with E2E tests:
1. Check the console output for specific errors
2. Review test screenshots and videos
3. Verify test environment is running correctly
4. Check data-testid attributes in components
5. Consult the main project documentation

## 🔗 Related Documentation

- [Frontend Testing Guide](../frontend/README.md#testing)
- [Backend Testing Guide](../backend/README.md#testing)
- [Main Project Documentation](../README.md)
- [Playwright Documentation](https://playwright.dev/) 