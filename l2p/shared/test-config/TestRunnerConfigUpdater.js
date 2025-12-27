import * as fs from 'fs';
import * as path from 'path';
import { TestFileRegistry } from './TestFileRegistry';
export class TestRunnerConfigUpdater {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
        this.registry = new TestFileRegistry(rootPath);
    }
    /**
     * Generate runner configurations based on discovered test files
     */
    async generateRunnerConfigs(categories) {
        const configs = {
            jest: {
                backend: this.generateBackendJestConfig(categories),
                frontend: this.generateFrontendJestConfig(categories)
            },
            playwright: this.generatePlaywrightConfig(categories),
            custom: this.generateCustomRunnerConfig(categories)
        };
        return configs;
    }
    /**
     * Generate Jest configuration for backend
     */
    generateBackendJestConfig(categories) {
        const backendFiles = [
            ...categories.unit.filter(f => f.relativePath.startsWith('backend/')),
            ...categories.integration.filter(f => f.relativePath.startsWith('backend/')),
            ...categories.cli.filter(f => f.relativePath.startsWith('backend/'))
        ];
        const testMatch = [
            'backend/src/**/__tests__/**/*.ts',
            'backend/src/**/?(*.)+(spec|test).ts',
            'backend/src/**/*.test.ts',
            'backend/src/**/*.spec.ts'
        ];
        const testPathIgnorePatterns = [
            '<rootDir>/backend/src/__tests__/e2e/',
            '<rootDir>/backend/src/__tests__/setup.ts',
            '<rootDir>/backend/src/__tests__/globalSetup.js',
            '<rootDir>/backend/src/__tests__/globalTeardown.js',
            '<rootDir>/backend/node_modules/',
            '<rootDir>/backend/dist/',
            '<rootDir>/backend/coverage/'
        ];
        const collectCoverageFrom = [
            'backend/src/**/*.ts',
            '!backend/src/**/*.d.ts',
            '!backend/src/server.ts',
            '!backend/src/**/*.test.ts',
            '!backend/src/**/*.spec.ts',
            '!backend/src/__tests__/**',
            '!backend/src/test-setup.ts'
        ];
        const coveragePathIgnorePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/__tests__/**',
            '**/test-setup.ts',
            '**/cli/**'
        ];
        return {
            testMatch,
            testPathIgnorePatterns,
            collectCoverageFrom,
            coveragePathIgnorePatterns
        };
    }
    /**
     * Generate Jest configuration for frontend
     */
    generateFrontendJestConfig(categories) {
        const frontendFiles = [
            ...categories.unit.filter(f => f.relativePath.startsWith('frontend/')),
            ...categories.integration.filter(f => f.relativePath.startsWith('frontend/'))
        ];
        const testMatch = [
            'frontend/src/**/__tests__/**/*.(ts|tsx|js)',
            'frontend/src/**/*.(test|spec).(ts|tsx|js)',
            'frontend/src/**/*.test.(ts|tsx)',
            'frontend/src/**/*.spec.(ts|tsx)'
        ];
        const testPathIgnorePatterns = [
            '/node_modules/',
            '<rootDir>/frontend/src/__tests__/e2e/',
            '<rootDir>/frontend/e2e/',
            '<rootDir>/frontend/dist/',
            '<rootDir>/frontend/coverage/',
            '\\.spec\\.ts$',
            '\\.e2e\\.ts$'
        ];
        const collectCoverageFrom = [
            'frontend/src/**/*.{ts,tsx}',
            '!frontend/src/**/*.d.ts',
            '!frontend/src/main.tsx',
            '!frontend/src/setupTests.ts',
            '!frontend/src/test-setup.ts',
            '!frontend/src/**/*.test.{ts,tsx}',
            '!frontend/src/**/*.spec.{ts,tsx}',
            '!frontend/src/__tests__/**',
            '!frontend/src/__mocks__/**'
        ];
        const coveragePathIgnorePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/__tests__/**',
            '**/test-setup.ts',
            '**/setupTests.ts',
            '**/__mocks__/**'
        ];
        return {
            testMatch,
            testPathIgnorePatterns,
            collectCoverageFrom,
            coveragePathIgnorePatterns
        };
    }
    /**
     * Generate Playwright configuration
     */
    generatePlaywrightConfig(categories) {
        const e2eFiles = categories.e2e;
        const accessibilityFiles = categories.accessibility;
        // Prefer the consolidated e2e directory
        const testDir = './tests';
        const testMatch = [
            '**/tests/**/*.spec.ts',
            '**/tests/**/*.spec.tsx',
            '**/e2e/**/*.spec.ts',
            '**/e2e/**/*.spec.tsx'
        ];
        const testIgnore = [
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/test-results/**',
            '**/playwright-report/**',
            // Ignore the duplicate location
            '**/src/__tests__/e2e/**'
        ];
        return {
            testDir,
            testMatch,
            testIgnore
        };
    }
    /**
     * Generate custom runner configuration
     */
    generateCustomRunnerConfig(categories) {
        const performanceFiles = categories.performance;
        const cliFiles = categories.cli;
        return {
            performance: {
                testMatch: [
                    '**/performance/**/*.test.ts',
                    '**/performance/**/*.test.js',
                    '**/*.perf.test.ts',
                    '**/*.load.test.ts'
                ],
                testIgnore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/coverage/**'
                ]
            },
            cli: {
                testMatch: [
                    '**/cli/**/*.ts',
                    '**/cli/**/*.js',
                    '**/__tests__/cli/**/*.ts'
                ],
                testIgnore: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/coverage/**'
                ]
            }
        };
    }
    /**
     * Update Jest configuration files
     */
    async updateJestConfigs(configs) {
        await this.updateBackendJestConfig(configs.jest.backend);
        await this.updateFrontendJestConfig(configs.jest.frontend);
    }
    /**
     * Update backend Jest configuration
     */
    async updateBackendJestConfig(config) {
        const configPath = path.join(this.rootPath, 'backend/jest.config.cjs');
        try {
            let content = await fs.promises.readFile(configPath, 'utf-8');
            // Update testMatch
            content = this.updateConfigProperty(content, 'testMatch', config.testMatch);
            // Update testPathIgnorePatterns
            content = this.updateConfigProperty(content, 'testPathIgnorePatterns', config.testPathIgnorePatterns);
            // Add comment about auto-generation
            const comment = `// Auto-generated test configuration - Updated by TestRunnerConfigUpdater\n// Last updated: ${new Date().toISOString()}\n`;
            content = comment + content;
            await fs.promises.writeFile(configPath, content);
            console.log(`✅ Updated backend Jest configuration: ${configPath}`);
        }
        catch (error) {
            console.error(`❌ Failed to update backend Jest config: ${error}`);
        }
    }
    /**
     * Update frontend Jest configuration
     */
    async updateFrontendJestConfig(config) {
        const configPath = path.join(this.rootPath, 'frontend/jest.config.cjs');
        try {
            let content = await fs.promises.readFile(configPath, 'utf-8');
            // Update testMatch
            content = this.updateConfigProperty(content, 'testMatch', config.testMatch);
            // Update testPathIgnorePatterns
            content = this.updateConfigProperty(content, 'testPathIgnorePatterns', config.testPathIgnorePatterns);
            // Add comment about auto-generation
            const comment = `// Auto-generated test configuration - Updated by TestRunnerConfigUpdater\n// Last updated: ${new Date().toISOString()}\n`;
            content = comment + content;
            await fs.promises.writeFile(configPath, content);
            console.log(`✅ Updated frontend Jest configuration: ${configPath}`);
        }
        catch (error) {
            console.error(`❌ Failed to update frontend Jest config: ${error}`);
        }
    }
    /**
     * Update Playwright configuration
     */
    async updatePlaywrightConfig(config) {
        const configPath = path.join(this.rootPath, 'frontend/e2e/playwright.config.ts');
        try {
            let content = await fs.promises.readFile(configPath, 'utf-8');
            // Update testDir
            content = content.replace(/testDir:\s*['"][^'"]*['"]/, `testDir: '${config.testDir}'`);
            // Add testMatch and testIgnore if not present
            if (!content.includes('testMatch:')) {
                const testMatchStr = `testMatch: ${JSON.stringify(config.testMatch, null, 2)},`;
                content = content.replace(/testDir:\s*['"][^'"]*['"],?\s*/, `$&\n  /* Test file patterns */\n  ${testMatchStr}\n`);
            }
            if (!content.includes('testIgnore:')) {
                const testIgnoreStr = `testIgnore: ${JSON.stringify(config.testIgnore, null, 2)},`;
                content = content.replace(/testMatch:\s*\[[^\]]*\],?\s*/, `$&\n  ${testIgnoreStr}\n`);
            }
            // Add comment about auto-generation
            const comment = `// Auto-generated test configuration - Updated by TestRunnerConfigUpdater\n// Last updated: ${new Date().toISOString()}\n`;
            content = comment + content;
            await fs.promises.writeFile(configPath, content);
            console.log(`✅ Updated Playwright configuration: ${configPath}`);
        }
        catch (error) {
            console.error(`❌ Failed to update Playwright config: ${error}`);
        }
    }
    /**
     * Create performance test runner configuration
     */
    async createPerformanceTestConfig(config) {
        const configPath = path.join(this.rootPath, 'performance-test.config.js');
        const configContent = `// Auto-generated performance test configuration
// Last updated: ${new Date().toISOString()}

module.exports = {
  testMatch: ${JSON.stringify(config.performance.testMatch, null, 2)},
  testIgnore: ${JSON.stringify(config.performance.testIgnore, null, 2)},
  timeout: 300000, // 5 minutes for performance tests
  parallel: false, // Run performance tests sequentially
  reporters: [
    'default',
    ['json', { outputFile: 'performance-test-results.json' }],
    ['html', { outputFolder: 'performance-test-report' }]
  ]
};
`;
        await fs.promises.writeFile(configPath, configContent);
        console.log(`✅ Created performance test configuration: ${configPath}`);
    }
    /**
     * Create CLI test runner configuration
     */
    async createCliTestConfig(config) {
        const configPath = path.join(this.rootPath, 'cli-test.config.js');
        const configContent = `// Auto-generated CLI test configuration
// Last updated: ${new Date().toISOString()}

module.exports = {
  testMatch: ${JSON.stringify(config.cli.testMatch, null, 2)},
  testIgnore: ${JSON.stringify(config.cli.testIgnore, null, 2)},
  timeout: 60000, // 1 minute for CLI tests
  parallel: true,
  reporters: [
    'default',
    ['json', { outputFile: 'cli-test-results.json' }]
  ]
};
`;
        await fs.promises.writeFile(configPath, configContent);
        console.log(`✅ Created CLI test configuration: ${configPath}`);
    }
    /**
     * Validate that all test files are executable by their respective runners
     */
    async validateTestExecution() {
        const categories = await this.registry.categorizeTests(Object.values(await this.registry.discoverTestFiles()).flat());
        const results = [];
        // Validate Jest (unit + integration)
        const jestFiles = [...categories.unit, ...categories.integration];
        results.push(await this.validateJestExecution(jestFiles));
        // Validate Playwright (e2e + accessibility)
        const playwrightFiles = [...categories.e2e, ...categories.accessibility];
        results.push(await this.validatePlaywrightExecution(playwrightFiles));
        // Validate custom runners
        results.push(await this.validatePerformanceExecution(categories.performance));
        results.push(await this.validateCliExecution(categories.cli));
        return results;
    }
    /**
     * Validate Jest execution
     */
    async validateJestExecution(files) {
        const errors = [];
        const warnings = [];
        let filesExecutable = 0;
        for (const file of files) {
            try {
                // Check if file has proper Jest patterns
                const content = await fs.promises.readFile(file.path, 'utf-8');
                const hasJestPatterns = /\b(describe|it|test|expect)\s*\(/.test(content);
                if (hasJestPatterns) {
                    filesExecutable++;
                }
                else {
                    warnings.push(`${file.relativePath}: No Jest test patterns found`);
                }
            }
            catch (error) {
                errors.push(`${file.relativePath}: Cannot read file - ${error}`);
            }
        }
        return {
            runner: 'jest',
            valid: errors.length === 0,
            errors,
            warnings,
            filesFound: files.length,
            filesExecutable
        };
    }
    /**
     * Validate Playwright execution
     */
    async validatePlaywrightExecution(files) {
        const errors = [];
        const warnings = [];
        let filesExecutable = 0;
        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file.path, 'utf-8');
                const hasPlaywrightPatterns = /\b(test|expect)\s*\(/.test(content) &&
                    /from\s+['"]@playwright\/test['"]/.test(content);
                if (hasPlaywrightPatterns) {
                    filesExecutable++;
                }
                else {
                    warnings.push(`${file.relativePath}: No Playwright test patterns found`);
                }
            }
            catch (error) {
                errors.push(`${file.relativePath}: Cannot read file - ${error}`);
            }
        }
        return {
            runner: 'playwright',
            valid: errors.length === 0,
            errors,
            warnings,
            filesFound: files.length,
            filesExecutable
        };
    }
    /**
     * Validate performance test execution
     */
    async validatePerformanceExecution(files) {
        const errors = [];
        const warnings = [];
        let filesExecutable = files.length; // Assume all performance files are executable
        for (const file of files) {
            if (!file.valid) {
                errors.push(`${file.relativePath}: File validation failed`);
                filesExecutable--;
            }
        }
        return {
            runner: 'performance',
            valid: errors.length === 0,
            errors,
            warnings,
            filesFound: files.length,
            filesExecutable
        };
    }
    /**
     * Validate CLI test execution
     */
    async validateCliExecution(files) {
        const errors = [];
        const warnings = [];
        let filesExecutable = files.length; // Assume all CLI files are executable
        for (const file of files) {
            if (!file.valid) {
                errors.push(`${file.relativePath}: File validation failed`);
                filesExecutable--;
            }
        }
        return {
            runner: 'cli',
            valid: errors.length === 0,
            errors,
            warnings,
            filesFound: files.length,
            filesExecutable
        };
    }
    /**
     * Helper method to update configuration properties
     */
    updateConfigProperty(content, property, value) {
        const propertyRegex = new RegExp(`${property}:\\s*\\[[^\\]]*\\]`, 'g');
        const newValue = `${property}: ${JSON.stringify(value, null, 4)}`;
        if (propertyRegex.test(content)) {
            return content.replace(propertyRegex, newValue);
        }
        else {
            // If property doesn't exist, add it after module.exports = {
            const insertPoint = content.indexOf('module.exports = {') + 'module.exports = {'.length;
            const before = content.substring(0, insertPoint);
            const after = content.substring(insertPoint);
            return `${before}\n  ${newValue},${after}`;
        }
    }
}
