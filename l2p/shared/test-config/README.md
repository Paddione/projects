# Unified Test Configuration System

A centralized test configuration management system for the Learn2Play platform that provides consistent test settings across frontend and backend applications.

## Overview

The Unified Test Configuration System provides:

- **Centralized Configuration**: Single YAML file for all test environments and types
- **Environment-Specific Settings**: Different configurations for local, CI, and Docker environments
- **Test Type Configurations**: Specialized settings for unit, integration, E2E, performance, and accessibility tests
- **Configuration Validation**: Comprehensive validation with clear error messages
- **Jest Integration**: Automatic Jest configuration generation
- **Test Utilities**: Shared utilities and helpers for consistent test setup
- **Health Checking**: Service health monitoring and validation

## Architecture

```
shared/test-config/
├── TestConfigManager.ts    # Core configuration management
├── TestUtilities.ts        # Shared test utilities and helpers
├── types.ts               # TypeScript type definitions
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
└── README.md             # This documentation
```

## Configuration File Structure

The system uses a single `test-config.yml` file in the project root:

```yaml
environments:
  local:
    database:
      url: "postgresql://test_user:test_pass@localhost:5433/test_db"
      ssl: false
      pool_size: 5
      timeout: 30000
    services:
      backend:
        port: 3001
        health_endpoint: "/api/health"
        timeout: 30
        base_url: "http://localhost:3001"
      # ... more services
    coverage:
      threshold:
        statements: 80
        branches: 75
        functions: 80
        lines: 80
      exclude:
        - "**/*.test.ts"
        - "**/node_modules/**"
    reporting:
      formats: ["html", "lcov", "json"]
      output_dir: "coverage"
    environment_variables:
      NODE_ENV: "test"
      # ... more variables

test_types:
  unit:
    timeout: 10000
    parallel: true
    max_workers: "50%"
    collect_coverage: true
  integration:
    timeout: 30000
    parallel: false
    setup_database: true
  # ... more test types

global:
  max_test_timeout: 300000
  setup_timeout: 120000
  retry_attempts: 3
  clear_mocks: true
```

## Usage

### Basic Usage

```typescript
import { TestConfigManager, TestUtilities } from 'test-config';

// Initialize configuration manager
const configManager = TestConfigManager.getInstance();

// Load and validate configuration
const config = configManager.loadConfig();
const validation = configManager.validateConfig();

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  process.exit(1);
}

// Create execution context
const context = configManager.createExecutionContext('local', 'unit');

// Setup test environment
await TestUtilities.initializeTestEnvironment('local', 'unit');
```

### Jest Integration

The system automatically configures Jest based on the environment and test type:

```javascript
// backend/jest.config.cjs
const { TestConfigManager } = require('../shared/test-config/dist/TestConfigManager');

const testEnvironment = process.env.TEST_ENVIRONMENT || 'local';
const testType = process.env.TEST_TYPE || 'unit';

const configManager = TestConfigManager.getInstance();
const context = configManager.createExecutionContext(testEnvironment, testType);

module.exports = {
  // Jest configuration is automatically generated from context
  ...configManager.getJestConfig(context, true), // true for backend
  
  // Additional Jest-specific settings
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // ...
};
```

### Test Utilities

The system provides comprehensive test utilities:

```typescript
import { TestUtilities } from 'test-config';

// Initialize test environment
const context = await TestUtilities.initializeTestEnvironment('local', 'unit');

// Wait for services to be ready
await TestUtilities.waitForServices('local', 120000);

// Create mock data
const mockData = TestUtilities.createMockData();
const testUser = mockData.user({ username: 'testuser123' });

// Use test helpers
const helpers = TestUtilities.createTestHelpers();
const { user, token } = await helpers.createTestUser();

// Performance utilities
const perfUtils = TestUtilities.createPerformanceUtils();
const { result, duration } = await perfUtils.measureTime(async () => {
  // Your test code here
});

// Accessibility utilities
const a11yUtils = TestUtilities.createA11yUtils();
const contrastResult = a11yUtils.checkColorContrast('#000000', '#ffffff');
```

### Environment Variables

The system automatically sets environment variables based on the configuration:

```typescript
// Environment variables are set automatically when initializing
await TestUtilities.initializeTestEnvironment('local', 'unit');

// Now you can use the configured environment variables
console.log(process.env.DATABASE_URL); // From configuration
console.log(process.env.VITE_API_URL); // From configuration
```

### Health Checking

Monitor service health before running tests:

```typescript
const configManager = TestConfigManager.getInstance();
const status = await configManager.performHealthCheck('local');

if (status.status !== 'ready') {
  console.error('Services not ready:', status.services);
  process.exit(1);
}
```

## CLI Tool

Use the command-line interface for configuration management:

```bash
# Validate configuration
node test-config-cli.js validate

# List environments
node test-config-cli.js environments

# List test types
node test-config-cli.js test-types

# Create execution context
node test-config-cli.js context --env ci --type integration

# Generate Jest configuration
node test-config-cli.js jest-config --env local --type unit --backend

# Perform health check
node test-config-cli.js health-check --env local
```

## NPM Scripts Integration

Update your package.json scripts to use the unified configuration:

```json
{
  "scripts": {
    "test": "TEST_ENVIRONMENT=local TEST_TYPE=unit jest",
    "test:ci": "TEST_ENVIRONMENT=ci TEST_TYPE=unit jest --ci --coverage",
    "test:integration": "TEST_ENVIRONMENT=local TEST_TYPE=integration jest",
    "test:e2e": "TEST_ENVIRONMENT=local TEST_TYPE=e2e playwright test",
    "test:performance": "TEST_ENVIRONMENT=local TEST_TYPE=performance jest"
  }
}
```

## Configuration Validation

The system provides comprehensive validation:

```typescript
const validation = configManager.validateConfig();

if (!validation.isValid) {
  console.log('Validation errors:');
  validation.errors.forEach(error => {
    console.log(`- ${error.field}: ${error.message}`);
  });
}

if (validation.warnings.length > 0) {
  console.log('Warnings:');
  validation.warnings.forEach(warning => {
    console.log(`- ${warning}`);
  });
}
```

## Environments

### Local Development
- Uses localhost services
- Lower coverage thresholds for faster development
- Detailed logging and verbose output

### CI/CD
- Uses Docker service names
- Higher coverage thresholds
- Optimized for automated testing
- Minimal output for CI logs

### Docker
- Container-based services
- Longer timeouts for container startup
- Isolated test environments

## Test Types

### Unit Tests
- Fast execution (10s timeout)
- Parallel execution enabled
- High coverage collection
- Mocked dependencies

### Integration Tests
- Medium timeout (30s)
- Sequential execution
- Database setup required
- Real service connections

### End-to-End Tests
- Long timeout (60s)
- Browser automation
- No coverage collection
- Full application stack

### Performance Tests
- Very long timeout (120s)
- Sequential execution
- Metrics collection
- Load testing scenarios

### Accessibility Tests
- Medium timeout (45s)
- Parallel execution
- WCAG compliance checking
- Screen reader testing

## Best Practices

1. **Environment Variables**: Always use the configuration system to set environment variables
2. **Service Health**: Check service health before running integration tests
3. **Mock Data**: Use the provided mock data generators for consistent test data
4. **Cleanup**: Always clean up test data and resources after tests
5. **Validation**: Validate configuration changes before committing
6. **Coverage**: Maintain appropriate coverage thresholds for each environment
7. **Timeouts**: Use environment-appropriate timeouts for different test types

## Troubleshooting

### Configuration Not Loading
```bash
# Validate configuration file
node test-config-cli.js validate

# Check file location (should be in project root)
ls -la test-config.yml
```

### Service Health Check Failures
```bash
# Check service health
node test-config-cli.js health-check --env local

# Verify service URLs and ports in configuration
node test-config-cli.js environments
```

### Jest Configuration Issues
```bash
# Generate and inspect Jest configuration
node test-config-cli.js jest-config --env local --type unit --backend

# Check environment variables
node test-config-cli.js context --env local --type unit
```

### Test Environment Setup Failures
- Ensure all required services are running
- Check database connectivity
- Verify environment variables are set correctly
- Review service health check results

## Development

### Building the Package
```bash
cd shared/test-config
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Adding New Environments
1. Add environment configuration to `test-config.yml`
2. Update validation rules if needed
3. Test with CLI tool
4. Update documentation

### Adding New Test Types
1. Add test type configuration to `test-config.yml`
2. Update Jest configurations if needed
3. Add specific utilities if required
4. Update documentation

## API Reference

### TestConfigManager

#### Methods
- `getInstance(configPath?: string)`: Get singleton instance
- `loadConfig()`: Load configuration from YAML file
- `validateConfig(config?: TestConfig)`: Validate configuration
- `getEnvironmentConfig(environment)`: Get environment-specific config
- `getTestTypeConfig(testType)`: Get test type-specific config
- `createExecutionContext(environment, testType)`: Create complete context
- `setupEnvironmentVariables(environment)`: Set environment variables
- `performHealthCheck(environment)`: Check service health
- `getJestConfig(context, isBackend)`: Generate Jest configuration

### TestUtilities

#### Methods
- `initializeTestEnvironment(environment, testType)`: Initialize test environment
- `waitForServices(environment, maxWaitTime, checkInterval)`: Wait for services
- `setupTestDatabase(context)`: Setup test database
- `cleanupTestEnvironment(context)`: Cleanup test environment
- `createMockData()`: Create mock data generators
- `createTestHelpers()`: Create test helper functions
- `createPerformanceUtils()`: Create performance utilities
- `createA11yUtils()`: Create accessibility utilities
- `getCurrentContext()`: Get current test context
- `setTestContext(environment, testType)`: Set test context

## Contributing

1. Follow TypeScript best practices
2. Add comprehensive tests for new features
3. Update documentation for changes
4. Validate configuration changes
5. Test with both frontend and backend applications

## License

This package is part of the Learn2Play platform and follows the same license terms.