"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestFileRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class TestFileRegistry {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
        this.excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/test-results/**',
            '**/test-artifacts/**',
            '**/playwright-report/**',
            '**/.git/**',
            '**/.next/**',
            '**/.nuxt/**'
        ];
    }
    /**
     * Discover all test files in the repository
     */
    async discoverTestFiles() {
        const patterns = [
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.test.js',
            '**/*.test.jsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            '**/*.spec.js',
            '**/*.spec.jsx',
            '**/__tests__/**/*.ts',
            '**/__tests__/**/*.tsx',
            '**/__tests__/**/*.js',
            '**/__tests__/**/*.jsx'
        ];
        const allFiles = [];
        for (const pattern of patterns) {
            try {
                const files = await (0, glob_1.glob)(pattern, {
                    cwd: this.rootPath,
                    ignore: this.excludePatterns
                });
                allFiles.push(...files);
            }
            catch (error) {
                console.warn(`Error scanning pattern ${pattern}:`, error);
            }
        }
        // Remove duplicates
        const uniqueFiles = [...new Set(allFiles)];
        return this.categorizeTestFiles(uniqueFiles);
    }
    /**
     * Categorize test files by type
     */
    categorizeTestFiles(files) {
        const categories = {
            unit: [],
            integration: [],
            e2e: [],
            performance: [],
            accessibility: [],
            cli: [],
            orphaned: []
        };
        for (const file of files) {
            const category = this.determineTestCategory(file);
            categories[category].push(file);
        }
        return categories;
    }
    /**
     * Determine the category of a test file based on its path and name
     */
    determineTestCategory(filePath) {
        const normalizedPath = filePath.toLowerCase();
        // CLI tests
        if (normalizedPath.includes('/cli/') || normalizedPath.includes('\\cli\\')) {
            return 'cli';
        }
        // E2E tests
        if (normalizedPath.includes('/e2e/') ||
            normalizedPath.includes('\\e2e\\') ||
            normalizedPath.includes('playwright') ||
            normalizedPath.includes('cypress')) {
            return 'e2e';
        }
        // Performance tests
        if (normalizedPath.includes('/performance/') ||
            normalizedPath.includes('\\performance\\') ||
            normalizedPath.includes('load-test') ||
            normalizedPath.includes('perf-test')) {
            return 'performance';
        }
        // Accessibility tests
        if (normalizedPath.includes('/accessibility/') ||
            normalizedPath.includes('\\accessibility\\') ||
            normalizedPath.includes('a11y') ||
            normalizedPath.includes('axe')) {
            return 'accessibility';
        }
        // Integration tests
        if (normalizedPath.includes('/integration/') ||
            normalizedPath.includes('\\integration\\') ||
            normalizedPath.includes('api.test') ||
            normalizedPath.includes('api.spec')) {
            return 'integration';
        }
        // Unit tests (default for most test files)
        if (normalizedPath.includes('/unit/') ||
            normalizedPath.includes('\\unit\\') ||
            normalizedPath.includes('__tests__') ||
            normalizedPath.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
            return 'unit';
        }
        // If we can't determine the category, mark as orphaned
        return 'orphaned';
    }
    /**
     * Get detailed information about test files
     */
    async categorizeTests(files) {
        const categories = {
            unit: [],
            integration: [],
            e2e: [],
            performance: [],
            accessibility: [],
            cli: [],
            orphaned: []
        };
        for (const file of files) {
            const testInfo = await this.getTestFileInfo(file);
            categories[testInfo.type].push(testInfo);
        }
        return categories;
    }
    /**
     * Get detailed information about a test file
     */
    async getTestFileInfo(filePath) {
        const fullPath = path.resolve(this.rootPath, filePath);
        const type = this.determineTestCategory(filePath);
        const runner = this.determineTestRunner(filePath, type);
        let stats;
        let valid = true;
        const errors = [];
        try {
            stats = await fs.promises.stat(fullPath);
        }
        catch (error) {
            valid = false;
            errors.push(`File not accessible: ${error}`);
            stats = { size: 0, mtime: new Date() };
        }
        // Basic syntax validation
        if (valid) {
            try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                if (content.trim().length === 0) {
                    valid = false;
                    errors.push('File is empty');
                }
                // Check for basic test patterns
                if (!this.hasTestPatterns(content)) {
                    errors.push('No test patterns found (describe, it, test, etc.)');
                }
            }
            catch (error) {
                valid = false;
                errors.push(`Cannot read file: ${error}`);
            }
        }
        return {
            path: fullPath,
            relativePath: filePath,
            type,
            runner,
            valid,
            errors,
            size: stats.size,
            lastModified: stats.mtime
        };
    }
    /**
     * Determine which test runner should be used for a file
     */
    determineTestRunner(filePath, type) {
        const normalizedPath = filePath.toLowerCase();
        // Playwright for E2E and accessibility tests
        if (type === 'e2e' || type === 'accessibility') {
            return 'playwright';
        }
        // Custom runner for performance tests
        if (type === 'performance') {
            return 'custom';
        }
        // Jest for unit, integration, and CLI tests
        if (type === 'unit' || type === 'integration' || type === 'cli') {
            return 'jest';
        }
        // Check file extensions and patterns
        if (normalizedPath.includes('playwright') || normalizedPath.includes('.spec.')) {
            return 'playwright';
        }
        if (normalizedPath.includes('.test.')) {
            return 'jest';
        }
        return 'unknown';
    }
    /**
     * Check if file contains test patterns
     */
    hasTestPatterns(content) {
        const testPatterns = [
            /\bdescribe\s*\(/,
            /\bit\s*\(/,
            /\btest\s*\(/,
            /\bexpect\s*\(/,
            /\bassert\s*\(/,
            /\bbeforeEach\s*\(/,
            /\bafterEach\s*\(/,
            /\bbeforeAll\s*\(/,
            /\bafterAll\s*\(/
        ];
        return testPatterns.some(pattern => pattern.test(content));
    }
    /**
     * Validate test files for syntax and accessibility
     */
    async validateTestFiles(files) {
        const results = [];
        for (const file of files) {
            const result = await this.validateTestFile(file);
            results.push(result);
        }
        return results;
    }
    /**
     * Validate a single test file
     */
    async validateTestFile(filePath) {
        const fullPath = path.resolve(this.rootPath, filePath);
        const errors = [];
        const warnings = [];
        try {
            // Check if file exists and is readable
            await fs.promises.access(fullPath, fs.constants.R_OK);
            // Read and validate content
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            if (content.trim().length === 0) {
                errors.push('File is empty');
            }
            // Check for test patterns
            if (!this.hasTestPatterns(content)) {
                warnings.push('No test patterns found');
            }
            // Check for common issues
            if (content.includes('fdescribe') || content.includes('fit')) {
                warnings.push('Contains focused tests (fdescribe/fit)');
            }
            if (content.includes('xdescribe') || content.includes('xit')) {
                warnings.push('Contains skipped tests (xdescribe/xit)');
            }
            // Basic syntax check for TypeScript/JavaScript
            if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                if (!content.includes('import') && !content.includes('require')) {
                    warnings.push('No imports found - might be incomplete');
                }
            }
        }
        catch (error) {
            errors.push(`Cannot access file: ${error}`);
        }
        return {
            path: filePath,
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Generate comprehensive inventory report
     */
    async generateInventoryReport() {
        const fileMap = await this.discoverTestFiles();
        const allFiles = Object.values(fileMap).flat();
        const categories = await this.categorizeTests(allFiles);
        // Calculate summary statistics
        const summary = {
            totalFiles: allFiles.length,
            byType: {
                unit: fileMap.unit.length,
                integration: fileMap.integration.length,
                e2e: fileMap.e2e.length,
                performance: fileMap.performance.length,
                accessibility: fileMap.accessibility.length,
                cli: fileMap.cli.length,
                orphaned: fileMap.orphaned.length
            },
            byRunner: {
                jest: 0,
                playwright: 0,
                custom: 0,
                unknown: 0
            },
            validFiles: 0,
            invalidFiles: 0
        };
        // Count by runner and validity
        Object.values(categories).flat().forEach(file => {
            if (file.runner in summary.byRunner) {
                summary.byRunner[file.runner]++;
            }
            if (file.valid) {
                summary.validFiles++;
            }
            else {
                summary.invalidFiles++;
            }
        });
        // Find duplicates (files with same name in different locations)
        const duplicates = this.findDuplicateFiles(allFiles);
        // Generate recommendations
        const recommendations = this.generateRecommendations(categories, duplicates);
        return {
            summary,
            categories,
            duplicates,
            orphaned: categories.orphaned,
            recommendations
        };
    }
    /**
     * Find duplicate test files
     */
    findDuplicateFiles(files) {
        const filesByName = new Map();
        files.forEach(file => {
            const fileName = path.basename(file);
            if (!filesByName.has(fileName)) {
                filesByName.set(fileName, []);
            }
            filesByName.get(fileName).push(file);
        });
        return Array.from(filesByName.values()).filter(group => group.length > 1);
    }
    /**
     * Generate recommendations for test organization
     */
    generateRecommendations(categories, duplicates) {
        const recommendations = [];
        // Check for orphaned files
        if (categories.orphaned.length > 0) {
            recommendations.push(`Found ${categories.orphaned.length} orphaned test files that need categorization`);
        }
        // Check for duplicates
        if (duplicates.length > 0) {
            recommendations.push(`Found ${duplicates.length} sets of duplicate test files that should be consolidated`);
        }
        // Check for invalid files
        const invalidFiles = Object.values(categories).flat().filter(f => !f.valid);
        if (invalidFiles.length > 0) {
            recommendations.push(`Found ${invalidFiles.length} invalid test files that need fixing`);
        }
        // Check for empty directories (would need additional logic)
    
        recommendations.push('Remove empty integration test directories');
        // Performance recommendations
        const largeFiles = Object.values(categories).flat().filter(f => f.size > 50000); // 50KB
        if (largeFiles.length > 0) {
            recommendations.push(`Consider splitting ${largeFiles.length} large test files for better maintainability`);
        }
        return recommendations;
    }
}
exports.TestFileRegistry = TestFileRegistry;
