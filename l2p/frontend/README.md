# Learn2Play Frontend

Modern React + Vite workspace powering the Learn2Play UI. For an end-to-end view of every package, see [Project Structure](../docs/PROJECT_STRUCTURE.md).

## Overview

- **Framework**: React 18 + Vite + TypeScript
- **State**: Zustand stores and contextual providers
- **Networking**: REST helpers in `src/services/apiService.ts` plus Socket.IO client integration
- **Testing**: Jest + React Testing Library for unit/integration, Playwright for E2E (`frontend/e2e`)

## Directory Layout

```
src/
├── components/   # Reusable UI widgets (PascalCase)
├── pages/        # Route-level screens wired through App routing
├── hooks/        # Custom hooks (useThing)
├── services/     # API + domain helpers
├── stores/       # Zustand stores
├── __tests__/    # App-level specs; feature suites stay in sibling __tests__ folders
├── test-utils.tsx# RTL helpers
└── styles/, types/, etc.
```

Component/page tests stay in nearby `__tests__` folders to satisfy the project-wide mirroring guidance while keeping context close to the implementation.

## Useful Commands

```bash
npm --prefix frontend install       # install deps
npm --prefix frontend run dev       # start Vite dev server
npm --prefix frontend run build     # production build
npm --prefix frontend run test:unit # Jest suite
npm --prefix frontend run test:e2e  # Playwright suite
```

## 🧪 Testing

### Test Organization (Best Practice)

The frontend follows **co-located testing** best practices:

```
src/
├── components/
│   ├── __tests__/           # Component tests (co-located)
│   │   ├── Timer.test.tsx
│   │   ├── PlayerGrid.test.tsx
│   │   └── ...
│   ├── Timer.tsx
│   ├── PlayerGrid.tsx
│   └── ...
├── hooks/
│   ├── __tests__/           # Hook tests (co-located)
│   │   ├── useAudio.test.ts
│   │   ├── useLocalization.test.ts
│   │   └── ...
│   ├── useAudio.ts
│   └── ...
├── services/
│   ├── __tests__/           # Service tests (co-located)
│   │   ├── audioManager.test.ts
│   │   ├── socketService.test.ts
│   │   └── ...
│   ├── audioManager.ts
│   └── ...
├── stores/
│   ├── __tests__/           # Store tests (co-located)
│   │   ├── gameStore.test.ts
│   │   ├── audioStore.test.ts
│   │   └── ...
│   ├── gameStore.ts
│   └── ...
└── __tests__/               # App-level tests
    └── App.test.tsx
```

### Why Co-located Tests?

✅ **Advantages:**
- **Easier to find**: Tests are right next to the code they test
- **Better maintainability**: When you modify code, the test is right there
- **Clearer ownership**: Each component/service owns its tests
- **Faster development**: No need to navigate between directories
- **Industry standard**: Used by React, Next.js, and most modern frameworks

❌ **Separate test directories are not recommended:**
- Harder to maintain and keep in sync
- More complex configuration needed
- Slower development workflow
- Risk of forgetting to update tests

### Test Coverage

The frontend includes comprehensive tests for all major components and functionality:

#### Components Tested
- ✅ **Timer** - Complete test suite with time formatting, progress, and state management
- ✅ **DemoPage** - UI showcase component with mock data integration
- ✅ **GameInterface** - Game lobby creation and joining functionality
- ✅ **ScoreDisplay** - Score formatting, multipliers, and streak display
- ✅ **PlayerGrid** - Player list with avatars, status, and responsive layout
- ✅ **LobbyView** - Lobby management, ready states, and host controls
- ✅ **LoadingSpinner** - Loading states and accessibility
- ✅ **ConnectionStatus** - Network status indicators
- ✅ **ThemeProvider** - Dark/light theme management
- ✅ **App** - Main application routing and structure

#### Hooks Tested
- ✅ **useAudio** - Audio system integration and event handlers
- ✅ **useLocalization** - Multi-language support and translations

#### Services Tested
- ✅ **audioManager** - Audio playback and management
- ✅ **socketService** - WebSocket communication
- ✅ **localization** - Multi-language support

#### Stores Tested
- ✅ **gameStore** - Game state management
- ✅ **audioStore** - Audio state and controls
- ✅ **characterStore** - Character selection and customization

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run tests for CI/CD
npm run test:ci
```

### Test Configuration

Tests are configured with:
- **Jest** - Test runner and framework
- **Testing Library** - React component testing utilities
- **jsdom** - Browser environment simulation
- **TypeScript** - Full type safety in tests

### Mock Setup

The test suite includes comprehensive mocks for:
- **WebSocket** - Socket.IO connections
- **Audio API** - Sound effects and music
- **LocalStorage** - Persistent settings
- **MatchMedia** - Responsive design testing
- **ResizeObserver** - Layout change detection

### Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## 🏗️ Architecture

### Component Structure
```
src/
├── components/          # UI Components
│   ├── __tests__/      # Component tests (co-located)
│   ├── Timer.tsx       # Game timer with progress
│   ├── PlayerGrid.tsx  # Player display grid
│   ├── GameInterface.tsx # Game controls
│   └── ...
├── hooks/              # Custom React hooks
│   ├── __tests__/      # Hook tests (co-located)
│   ├── useAudio.ts     # Audio management
│   └── ...
├── stores/             # State management
│   ├── __tests__/      # Store tests (co-located)
│   ├── gameStore.ts    # Game state
│   └── ...
├── services/           # API & business logic
│   ├── __tests__/      # Service tests (co-located)
│   ├── audioManager.ts # Audio service
│   └── ...
├── types/              # TypeScript definitions
└── setupTests.ts       # Test configuration
```

### Testing Patterns

#### Component Testing
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

#### Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react'
import { useMyHook } from '../useMyHook'

describe('useMyHook', () => {
  it('initializes correctly', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.value).toBe(0)
  })

  it('updates state', () => {
    const { result } = renderHook(() => useMyHook())
    
    act(() => {
      result.current.increment()
    })
    
    expect(result.current.value).toBe(1)
  })
})
```

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Quality Assurance

#### Code Quality
- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **TypeScript** - Type safety and IntelliSense

#### Testing Best Practices
- **Arrange-Act-Assert** pattern for test structure
- **User-centric** testing approach with Testing Library
- **Accessibility** testing with screen readers and ARIA
- **Mock isolation** for external dependencies
- **Performance** testing for rendering optimization

#### Continuous Integration
Tests run automatically on:
- Pull requests
- Main branch pushes
- Release candidates

## 📊 Performance

### Optimization Features
- **Code splitting** with React.lazy()
- **Bundle analysis** for size optimization
- **Tree shaking** for unused code elimination
- **Image optimization** and lazy loading
- **Service worker** for offline capability

### Performance Testing
```bash
# Analyze bundle size
npm run analyze

# Performance audit
npm run lighthouse

# Memory profiling
npm run profile
```

## 🌐 Browser Support

- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+

### Mobile Support
- **iOS Safari** 14+
- **Android Chrome** 90+
- **Samsung Internet** 15+

## 🛠️ Troubleshooting

### Common Issues

#### Test Failures
```bash
# Clear Jest cache
npm test -- --clearCache

# Update snapshots
npm test -- --updateSnapshot

# Debug specific test
npm test -- --testNamePattern="MyComponent"
```

#### TypeScript Errors
```bash
# Type check
npx tsc --noEmit

# Clear TypeScript cache
rm -rf node_modules/.cache
```

#### Build Issues
```bash
# Clean build
rm -rf dist/ node_modules/.cache
npm run build
```

## 📝 Contributing

### Testing Guidelines
1. Write tests for all new components
2. Maintain >80% code coverage
3. Test user interactions and edge cases
4. Mock external dependencies
5. Use descriptive test names

### Code Review Checklist
- [ ] Tests added/updated
- [ ] TypeScript types defined
- [ ] Accessibility considered
- [ ] Performance impact assessed
- [ ] Documentation updated

---

**Learn2Play Frontend** - Comprehensive React application with full testing coverage! 🎯 
