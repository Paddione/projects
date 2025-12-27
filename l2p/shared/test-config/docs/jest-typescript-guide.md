# Jest and TypeScript Testing Guide

This document outlines the configuration and best practices for testing TypeScript code with Jest in this project.

## Table of Contents
- [Configuration Files](#configuration-files)
- [TypeScript Configuration](#typescript-configuration)
- [Jest Configuration](#jest-configuration)
- [Mocking](#mocking)
- [Testing Best Practices](#testing-best-practices)
- [Common Issues and Solutions](#common-issues-and-solutions)

## Configuration Files

### TypeScript Configuration
- `tsconfig.json`: Base TypeScript configuration for the project
- `tsconfig.test.json`: Test-specific TypeScript configuration that extends the base config

### Jest Configuration
- `jest.config.cjs`: Main Jest configuration file
- `__mocks__/`: Directory for manual mocks

## TypeScript Configuration

### Base Config (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Test Config (`tsconfig.test.json`)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "module": "commonjs",
    "esModuleInterop": true,
    "noImplicitAny": false
  },
  "include": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**/*.ts"
  ]
}
```

## Jest Configuration

### Key Configuration Options
- **preset**: 'ts-jest/presets/default-esm' for ESM module support
- **transform**: Configures TypeScript file handling
- **moduleNameMapper**: Handles module aliases
- **testEnvironment**: 'node' for Node.js environment
- **collectCoverage**: Set to true to collect test coverage

### Example `jest.config.cjs`
```javascript
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]sx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json'
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../$1',
    '^@test-config/(.*)$': '<rootDir>/$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true
};
```

## Mocking

### Manual Mocks
Create manual mocks in the `__mocks__` directory. For example, to mock the `fs` module:

```typescript
// __mocks__/fs.ts
export const readFileSync = jest.fn();
export const writeFileSync = jest.fn();
// ... other fs methods
```

### Inline Mocks
For simple mocks, use `jest.mock()` in your test files:

```typescript
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));
```

### Mocking Console
To prevent test pollution from console logs:

```typescript
let consoleSpies: Record<string, jest.SpyInstance> = {};

beforeAll(() => {
  ['log', 'warn', 'error', 'debug', 'info'].forEach((method) => {
    consoleSpies[method] = jest.spyOn(console, method as any).mockImplementation(() => {});
  });
});

afterAll(() => {
  Object.values(consoleSpies).forEach(spy => spy.mockRestore();
});
```

## Testing Best Practices

### Async Testing
Always handle async operations properly:

```typescript
// For Promises
it('should resolve with value', async () => {
  await expect(asyncFunction()).resolves.toBe('value');
});

// For callbacks
it('should call callback', done => {
  function callback(error, data) {
    if (error) return done(error);
    expect(data).toBe('value');
    done();
  }
  asyncFunction(callback);
});
```

### Testing Error Cases
```typescript
it('should throw error', async () => {
  await expect(asyncFunction()).rejects.toThrow('Error message');
});
```

### Testing Implementation Details
Avoid testing implementation details. Instead, test the public API and behavior.

## Common Issues and Solutions

### 1. "Cannot use import statement outside a module"
**Solution**: Ensure your Jest config has the correct module settings and you're using the correct preset.

### 2. "SyntaxError: Unexpected token 'export'"
**Solution**: Make sure to configure Babel or use `ts-jest` with the correct module settings.

### 3. "Cannot find module"
**Solution**: Check your `moduleNameMapper` in Jest config and ensure paths are correct.

### 4. "Test suite failed to run" with TypeScript errors
**Solution**: Verify your `tsconfig.test.json` includes test files and has the correct compiler options.

### 5. Memory Leaks
**Solution**: Ensure proper cleanup in `afterEach` and `afterAll` hooks, and clear all mocks:

```typescript
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
```

## Running Tests

Run all tests:
```bash
npm test
```

Run specific test file:
```bash
npm test path/to/test/file.test.ts
```

Run with coverage:
```bash
npm test -- --coverage
```

## Debugging Tests

To debug tests in VS Code:
1. Add this to your `launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--config", "jest.config.cjs"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```
2. Set breakpoints in your test or source files
3. Run the debug configuration

## Performance Tips

- Use `--runInBand` for debugging to run tests sequentially
- Use `--watch` for development to re-run tests on file changes
- Use `--findRelatedTests` to only run tests related to changed files
