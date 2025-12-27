# Backend Tests

This directory contains all backend-related tests co-located with the source code.

## Structure

- `unit/` - Unit tests for individual components
- `integration/` - Integration tests for API endpoints and services
- `e2e/` - End-to-end tests for backend functionality

## Running Tests

```bash
# Run all backend tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## Test Configuration

Tests use Jest with the configuration in `backend/jest.config.js`. 