# Coverage Configuration System

This document describes the comprehensive coverage reporting system that provides unified coverage collection, reporting, and threshold management for both frontend and backend components.

## Overview

The coverage system consists of several components:

- **CoverageReporter**: Generates coverage reports in multiple formats with historical tracking
- **CoverageConfigManager**: Manages coverage configuration and aggregates coverage from multiple sources
- **CoverageConfigCLI**: Command-line interface for coverage management
- **Integration**: Seamless integration with Jest configurations

## Features

### 📊 Multi-Format Reporting
- HTML reports with interactive features
- LCOV format for CI/CD integration
- JSON format for programmatic access
- XML (Cobertura) format for build systems
- Text format for console output
- SVG badges for documentation

### 🎯 Threshold Management
- Configurable thresholds for statements, branches, functions, and lines
- Separate thresholds for frontend, backend, and global
- Detailed failure reporting with specific metrics
- Automatic threshold validation

### 📈 Historical Tracking
- Coverage trend analysis
- Historical data storage and comparison
- Visual trend indicators (improving/declining/stable)
- Baseline comparisons

### 🔧 Flexible Configuration
- Centralized configuration management
- File exclusion patterns
- Custom reporter configurations
- Environment-specific settings

### 🚀 CI/CD Integration
- Automated coverage collection
- Badge generation
- Summary reports for build systems
- Exit codes for pipeline integration

## Quick Start

### 1. Install Dependencies

```bash
cd shared/test-config
npm install
npm run build
```

### 2. View Current Configuration

```bash
npm run coverage:show
```

### 3. Generate Coverage Report

```bash
# Run tests with coverage first
cd frontend && npm run test -- --coverage
cd backend && npm run test -- --coverage

# Then aggregate and generate reports
npm run coverage:collect
```

### 4. Generate Coverage Badge

```bash
npm run coverage:badge
```

## Configuration

### Default Configuration

The system uses sensible defaults that can be customized:

```json
{
  "frontend": {
    "collectFrom": [
      "src/**/*.{ts,tsx}",
      "!src/**/*.d.ts",
      "!src/main.tsx",
      "!src/setupTests.ts",
      "!src/**/*.test.{ts,tsx}",
      "!src/**/*.spec.{ts,tsx}"
    ],
    "exclude": [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**"
    ],
    "reporters": ["text", "lcov", "html", "json-summary"],
    "directory": "coverage",
    "thresholds": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  },
  "backend": {
    "collectFrom": [
      "src/**/*.ts",
      "!src/**/*.d.ts",
      "!src/server.ts",
      "!src/cli/**/*.ts",
      "!src/**/*.test.ts",
      "!src/**/*.spec.ts"
    ],
    "exclude": [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**"
    ],
    "reporters": ["text", "lcov", "html", "json-summary"],
    "directory": "coverage",
    "thresholds": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  },
  "global": {
    "aggregatedDirectory": "coverage-reports",
    "formats": ["html", "json", "lcov", "text", "badge"],
    "includeHistorical": true,
    "badgeGeneration": true,
    "thresholds": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  }
}
```

### Customizing Configuration

#### Set Coverage Thresholds

```bash
# Set frontend thresholds
npx coverage-config set-threshold -t frontend -s 85 -b 80 -f 85 -l 85

# Set backend thresholds
npx coverage-config set-threshold -t backend -s 90 -b 85 -f 90 -l 90

# Set global thresholds
npx coverage-config set-threshold -t global -s 85 -b 80 -f 85 -l 85
```

#### Add Exclusion Patterns

```bash
# Add patterns to frontend
npx coverage-config add-exclusion -t frontend -p "**/*.mock.ts" "**/test-utils/**"

# Add patterns to backend
npx coverage-config add-exclusion -t backend -p "**/fixtures/**" "**/*.fixture.ts"

# Add patterns to both
npx coverage-config add-exclusion -t global -p "**/temp/**"
```

#### Remove Exclusion Patterns

```bash
npx coverage-config remove-exclusion -t frontend -p "**/*.mock.ts"
```

## CLI Commands

### Configuration Management

```bash
# Show current configuration
npx coverage-config show

# Show configuration in JSON format
npx coverage-config show -f json

# Validate configuration
npx coverage-config validate

# Reset to defaults
npx coverage-config reset --confirm
```

### Report Generation

```bash
# Generate all reports
npx coverage-config report

# Generate specific formats
npx coverage-config report -f html json lcov

# Generate reports with custom output directory
npx coverage-config report -o custom-reports

# Generate reports without historical data
npx coverage-config report --no-historical
```

### Coverage Collection

```bash
# Collect and aggregate coverage
npx coverage-config collect

# Generate summary only
npx coverage-config collect --summary-only
```

### Badge Generation

```bash
# Generate badge
npx coverage-config badge

# Generate badge with custom output
npx coverage-config badge -o docs/coverage-badge.svg
```

### Jest Configuration Export

```bash
# Export frontend Jest config
npx coverage-config jest-config -t frontend

# Export backend Jest config in JavaScript format
npx coverage-config jest-config -t backend -f js
```

## Integration with Jest

The system automatically integrates with Jest configurations:

### Frontend (frontend/jest.config.cjs)

```javascript
const { CoverageConfigManager } = require('../shared/test-config/dist/CoverageConfigManager');

const coverageManager = CoverageConfigManager.getInstance();
const coverageConfig = coverageManager.getFrontendJestConfig();

module.exports = {
  // ... other Jest config
  collectCoverageFrom: coverageConfig.collectCoverageFrom,
  coverageDirectory: coverageConfig.coverageDirectory,
  coverageReporters: coverageConfig.coverageReporters,
  coverageThreshold: coverageConfig.coverageThreshold,
  coveragePathIgnorePatterns: coverageConfig.coveragePathIgnorePatterns,
};
```

### Backend (backend/jest.config.cjs)

```javascript
const { CoverageConfigManager } = require('../shared/test-config/dist/CoverageConfigManager');

const coverageManager = CoverageConfigManager.getInstance();
const coverageConfig = coverageManager.getBackendJestConfig();

module.exports = {
  // ... other Jest config
  collectCoverageFrom: coverageConfig.collectCoverageFrom,
  coverageDirectory: coverageConfig.coverageDirectory,
  coverageReporters: coverageConfig.coverageReporters,
  coverageThreshold: coverageConfig.coverageThreshold,
  coveragePathIgnorePatterns: coverageConfig.coveragePathIgnorePatterns,
};
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Coverage Report

on: [push, pull_request]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          npm install
          cd shared/test-config && npm install && npm run build
          
      - name: Run tests with coverage
        run: |
          cd frontend && npm run test -- --coverage
          cd ../backend && npm run test -- --coverage
          
      - name: Generate coverage reports
        run: npm run coverage:collect
        
      - name: Upload coverage reports
        uses: actions/upload-artifact@v3
        with:
          name: coverage-reports
          path: coverage-reports/
          
      - name: Comment coverage on PR
        if: github.event_name == 'pull_request'
        run: |
          # Use coverage summary for PR comments
          cat coverage-reports/coverage-summary.json
```

### Package.json Scripts

Add these scripts to your root package.json:

```json
{
  "scripts": {
    "coverage:collect": "node scripts/aggregate-coverage.js",
    "coverage:report": "npx coverage-config report",
    "coverage:badge": "npx coverage-config badge",
    "coverage:validate": "npx coverage-config validate",
    "test:coverage": "npm run test:unit && npm run coverage:collect"
  }
}
```

## Report Formats

### HTML Report

Interactive HTML report with:
- Overall coverage metrics
- File-level coverage details
- Uncovered lines highlighting
- Historical trends (if enabled)
- Threshold status
- Collapsible sections

### JSON Report

Machine-readable format containing:
- Complete coverage metrics
- File-by-file breakdown
- Historical data
- Threshold results
- Metadata (timestamp, environment, etc.)

### LCOV Report

Standard LCOV format for:
- CI/CD integration
- Code coverage tools
- IDE integration
- Third-party services

### Badge

SVG badge showing:
- Overall coverage percentage
- Color-coded status (red/yellow/green)
- Suitable for README files
- Customizable appearance

## Troubleshooting

### Common Issues

#### 1. No Coverage Data Found

```bash
# Ensure tests are run with coverage
cd frontend && npm run test -- --coverage
cd backend && npm run test -- --coverage

# Check coverage directories exist
ls -la frontend/coverage/
ls -la backend/coverage/
```

#### 2. Configuration Not Loading

```bash
# Validate configuration
npx coverage-config validate

# Check configuration file
cat .kiro/coverage-config.json

# Reset to defaults if corrupted
npx coverage-config reset --confirm
```

#### 3. Thresholds Not Met

```bash
# Check current thresholds
npx coverage-config show

# Adjust thresholds if needed
npx coverage-config set-threshold -t global -s 75 -b 70 -f 75 -l 75
```

#### 4. Exclusion Patterns Not Working

```bash
# Check current exclusions
npx coverage-config show -f json | jq '.frontend.exclude'

# Add more specific patterns
npx coverage-config add-exclusion -t frontend -p "**/specific-file.ts"
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=coverage:* npx coverage-config report
```

## Best Practices

### 1. Threshold Management
- Start with achievable thresholds (70-80%)
- Gradually increase as coverage improves
- Use different thresholds for different components
- Monitor trends rather than absolute values

### 2. Exclusion Patterns
- Exclude test files and mocks
- Exclude generated code and build artifacts
- Be specific with patterns to avoid over-exclusion
- Document custom exclusions

### 3. CI/CD Integration
- Run coverage on every PR
- Fail builds on threshold violations
- Generate and store coverage badges
- Track coverage trends over time

### 4. Reporting
- Generate multiple formats for different audiences
- Use HTML reports for detailed analysis
- Use JSON reports for automation
- Include coverage badges in documentation

### 5. Historical Tracking
- Enable historical tracking for trend analysis
- Review coverage trends regularly
- Set up alerts for significant drops
- Use trends to guide testing efforts

## API Reference

### CoverageConfigManager

```typescript
class CoverageConfigManager {
  static getInstance(projectRoot?: string): CoverageConfigManager;
  getFrontendJestConfig(): JestCoverageConfig;
  getBackendJestConfig(): JestCoverageConfig;
  collectAndAggregateCoverage(): Promise<CoverageSummaryReport>;
  updateThresholds(thresholds: Partial<CoverageThreshold>, target: string): void;
  addExclusionPatterns(patterns: string[], target: string): void;
  removeExclusionPatterns(patterns: string[], target: string): void;
  getCoverageConfig(): CoverageCollectionConfig;
}
```

### CoverageReporter

```typescript
class CoverageReporter {
  constructor(outputDir?: string);
  generateReport(coverageData: CoverageReport[], options: CoverageReportOptions): Promise<string[]>;
  checkThresholds(coverage: CoverageReport, thresholds: CoverageThreshold): CoverageThresholdResult;
  exportFormats(coverage: CoverageReport, formats: CoverageReportFormat[]): Promise<Record<string, string>>;
}
```

## Contributing

When contributing to the coverage system:

1. Add tests for new functionality
2. Update documentation
3. Ensure backward compatibility
4. Test with both frontend and backend
5. Validate CI/CD integration

## License

This coverage system is part of the Learn2Play project and follows the same license terms.