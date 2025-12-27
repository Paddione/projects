# Frontend Tests

This directory contains all frontend-related tests co-located with the source code.

## Structure

- `unit/` - Unit tests for individual components
- `integration/` - Integration tests for component interactions
- `e2e/` - End-to-end tests for frontend functionality

## Running Tests

```bash
# Run all frontend tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Test Configuration

Tests use Jest with the configuration in `frontend/jest.config.js`. 