/**
 * Coverage Configuration Manager
 * Handles coverage collection setup, exclusions, and badge generation
 */
import * as fs from 'fs';
import * as path from 'path';
import { CoverageReporter } from './CoverageReporter.js';
export class CoverageConfigManager {
    constructor(projectRoot) {
        this.projectRoot = projectRoot || this.findProjectRoot();
        this.coverageReporter = new CoverageReporter(path.join(this.projectRoot, 'coverage-reports'));
        this.config = this.loadCoverageConfig();
    }
    static getInstance(projectRoot) {
        if (!CoverageConfigManager.instance) {
            CoverageConfigManager.instance = new CoverageConfigManager(projectRoot);
        }
        return CoverageConfigManager.instance;
    }
    /**
     * Get Jest coverage configuration for frontend
     */
    getFrontendJestConfig() {
        return {
            collectCoverageFrom: this.config.frontend.collectFrom,
            coverageDirectory: this.config.frontend.directory,
            coverageReporters: this.config.frontend.reporters,
            coverageThreshold: {
                global: this.config.frontend.thresholds
            },
            coveragePathIgnorePatterns: this.config.frontend.exclude
        };
    }
    /**
     * Get Jest coverage configuration for backend
     */
    getBackendJestConfig() {
        return {
            collectCoverageFrom: this.config.backend.collectFrom,
            coverageDirectory: this.config.backend.directory,
            coverageReporters: this.config.backend.reporters,
            coverageThreshold: {
                global: this.config.backend.thresholds
            },
            coveragePathIgnorePatterns: this.config.backend.exclude
        };
    }
    /**
     * Collect and aggregate coverage from both frontend and backend
     */
    async collectAndAggregateCoverage() {
        console.log('📊 Collecting coverage from frontend and backend...');
        const frontendCoverage = await this.collectFrontendCoverage();
        const backendCoverage = await this.collectBackendCoverage();
        // Aggregate coverage reports
        const coverageReports = [];
        if (frontendCoverage)
            coverageReports.push(frontendCoverage);
        if (backendCoverage)
            coverageReports.push(backendCoverage);
        let aggregatedCoverage = null;
        let reportPaths = [];
        let badgePath;
        if (coverageReports.length > 0) {
            // Generate aggregated reports
            const reportOptions = {
                outputDir: this.config.global.aggregatedDirectory,
                formats: this.config.global.formats,
                includeHistorical: this.config.global.includeHistorical,
                includeUncovered: true,
                includeFileDetails: true,
                thresholds: this.config.global.thresholds,
                excludePatterns: this.getGlobalExcludePatterns()
            };
            reportPaths = await this.coverageReporter.generateReport(coverageReports, reportOptions);
            // Generate badge if enabled
            if (this.config.global.badgeGeneration) {
                badgePath = await this.generateCoverageBadge(coverageReports);
            }
            // Get aggregated coverage for threshold checking
            if (coverageReports.length === 1) {
                aggregatedCoverage = coverageReports[0];
            }
            else {
                // This would be handled by the CoverageReporter's aggregation logic
                aggregatedCoverage = coverageReports[0]; // Simplified for now
            }
        }
        // Check if thresholds are met
        const thresholdResult = aggregatedCoverage
            ? this.coverageReporter.checkThresholds(aggregatedCoverage, this.config.global.thresholds)
            : { met: false, failures: [], summary: 'No coverage data available' };
        return {
            frontend: frontendCoverage,
            backend: backendCoverage,
            aggregated: aggregatedCoverage,
            badgePath,
            reportPaths,
            thresholdsMet: thresholdResult.met
        };
    }
    /**
     * Generate coverage badge
     */
    async generateCoverageBadge(coverageReports) {
        const badgeOptions = {
            outputDir: this.config.global.aggregatedDirectory,
            formats: ['badge'],
            includeHistorical: false,
            includeUncovered: false,
            includeFileDetails: false
        };
        const badgePaths = await this.coverageReporter.generateReport(coverageReports, badgeOptions);
        return badgePaths[0];
    }
    /**
     * Create coverage summary for CI/CD integration
     */
    async createCoverageSummary() {
        const summary = await this.collectAndAggregateCoverage();
        const summaryPath = path.join(this.config.global.aggregatedDirectory, 'coverage-summary.json');
        const summaryData = {
            timestamp: new Date().toISOString(),
            thresholdsMet: summary.thresholdsMet,
            frontend: summary.frontend ? {
                statements: summary.frontend.overall.statements.percentage,
                branches: summary.frontend.overall.branches.percentage,
                functions: summary.frontend.overall.functions.percentage,
                lines: summary.frontend.overall.lines.percentage
            } : null,
            backend: summary.backend ? {
                statements: summary.backend.overall.statements.percentage,
                branches: summary.backend.overall.branches.percentage,
                functions: summary.backend.overall.functions.percentage,
                lines: summary.backend.overall.lines.percentage
            } : null,
            aggregated: summary.aggregated ? {
                statements: summary.aggregated.overall.statements.percentage,
                branches: summary.aggregated.overall.branches.percentage,
                functions: summary.aggregated.overall.functions.percentage,
                lines: summary.aggregated.overall.lines.percentage
            } : null,
            reportPaths: summary.reportPaths,
            badgePath: summary.badgePath
        };
        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        console.log(`📄 Coverage summary saved to: ${summaryPath}`);
        return summaryPath;
    }
    /**
     * Update coverage configuration
     */
    updateCoverageConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveCoverageConfig();
    }
    /**
     * Add exclusion patterns
     */
    addExclusionPatterns(patterns, target) {
        if (target === 'frontend') {
            this.config.frontend.exclude.push(...patterns);
        }
        else if (target === 'backend') {
            this.config.backend.exclude.push(...patterns);
        }
        else {
            // Add to both frontend and backend
            this.config.frontend.exclude.push(...patterns);
            this.config.backend.exclude.push(...patterns);
        }
        this.saveCoverageConfig();
    }
    /**
     * Remove exclusion patterns
     */
    removeExclusionPatterns(patterns, target) {
        if (target === 'frontend') {
            this.config.frontend.exclude = this.config.frontend.exclude.filter(pattern => !patterns.includes(pattern));
        }
        else if (target === 'backend') {
            this.config.backend.exclude = this.config.backend.exclude.filter(pattern => !patterns.includes(pattern));
        }
        else {
            this.config.frontend.exclude = this.config.frontend.exclude.filter(pattern => !patterns.includes(pattern));
            this.config.backend.exclude = this.config.backend.exclude.filter(pattern => !patterns.includes(pattern));
        }
        this.saveCoverageConfig();
    }
    /**
     * Update coverage thresholds
     */
    updateThresholds(thresholds, target) {
        if (target === 'frontend') {
            this.config.frontend.thresholds = { ...this.config.frontend.thresholds, ...thresholds };
        }
        else if (target === 'backend') {
            this.config.backend.thresholds = { ...this.config.backend.thresholds, ...thresholds };
        }
        else {
            this.config.global.thresholds = { ...this.config.global.thresholds, ...thresholds };
        }
        this.saveCoverageConfig();
    }
    /**
     * Get current coverage configuration
     */
    getCoverageConfig() {
        return { ...this.config };
    }
    /**
     * Collect frontend coverage
     */
    async collectFrontendCoverage() {
        const frontendCoverageDir = path.join(this.projectRoot, 'frontend', this.config.frontend.directory);
        if (!fs.existsSync(frontendCoverageDir)) {
            console.warn('⚠️  Frontend coverage directory not found:', frontendCoverageDir);
            return null;
        }
        return this.parseCoverageFromDirectory(frontendCoverageDir, 'frontend');
    }
    /**
     * Collect backend coverage
     */
    async collectBackendCoverage() {
        const backendCoverageDir = path.join(this.projectRoot, 'backend', this.config.backend.directory);
        if (!fs.existsSync(backendCoverageDir)) {
            console.warn('⚠️  Backend coverage directory not found:', backendCoverageDir);
            return null;
        }
        return this.parseCoverageFromDirectory(backendCoverageDir, 'backend');
    }
    /**
     * Parse coverage from directory
     */
    async parseCoverageFromDirectory(coverageDir, source) {
        try {
            // Look for coverage-summary.json first
            const summaryFile = path.join(coverageDir, 'coverage-summary.json');
            if (fs.existsSync(summaryFile)) {
                return this.parseCoverageSummaryFile(summaryFile, source);
            }
            // Look for lcov.info
            const lcovFile = path.join(coverageDir, 'lcov.info');
            if (fs.existsSync(lcovFile)) {
                return this.parseLcovFile(lcovFile, source);
            }
            console.warn(`⚠️  No coverage files found in ${coverageDir}`);
            return null;
        }
        catch (error) {
            console.error(`❌ Failed to parse coverage from ${coverageDir}:`, error);
            return null;
        }
    }
    /**
     * Parse coverage summary JSON file
     */
    parseCoverageSummaryFile(summaryFile, source) {
        const summaryData = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
        // Convert Jest coverage summary format to our CoverageReport format
        const overall = summaryData.total;
        const byFile = new Map();
        const byDirectory = new Map();
        const uncoveredLines = [];
        // Process file-level data
        for (const [filePath, fileData] of Object.entries(summaryData)) {
            if (filePath === 'total')
                continue;
            const metrics = {
                statements: {
                    covered: fileData.statements.covered,
                    total: fileData.statements.total,
                    percentage: fileData.statements.pct
                },
                branches: {
                    covered: fileData.branches.covered,
                    total: fileData.branches.total,
                    percentage: fileData.branches.pct
                },
                functions: {
                    covered: fileData.functions.covered,
                    total: fileData.functions.total,
                    percentage: fileData.functions.pct
                },
                lines: {
                    covered: fileData.lines.covered,
                    total: fileData.lines.total,
                    percentage: fileData.lines.pct
                }
            };
            byFile.set(filePath, metrics);
        }
        return {
            overall: {
                statements: {
                    covered: overall.statements.covered,
                    total: overall.statements.total,
                    percentage: overall.statements.pct
                },
                branches: {
                    covered: overall.branches.covered,
                    total: overall.branches.total,
                    percentage: overall.branches.pct
                },
                functions: {
                    covered: overall.functions.covered,
                    total: overall.functions.total,
                    percentage: overall.functions.pct
                },
                lines: {
                    covered: overall.lines.covered,
                    total: overall.lines.total,
                    percentage: overall.lines.pct
                }
            },
            byFile,
            byDirectory,
            uncoveredLines,
            thresholdsMet: this.checkThresholds(overall, source)
        };
    }
    /**
     * Parse LCOV file (simplified implementation)
     */
    parseLcovFile(lcovFile, source) {
        const lcovContent = fs.readFileSync(lcovFile, 'utf8');
        // This is a simplified LCOV parser
        // In production, you'd use a proper LCOV parsing library
        const sections = lcovContent.split('end_of_record');
        const byFile = new Map();
        let totalStatements = { covered: 0, total: 0 };
        let totalBranches = { covered: 0, total: 0 };
        let totalFunctions = { covered: 0, total: 0 };
        let totalLines = { covered: 0, total: 0 };
        for (const section of sections) {
            if (!section.trim())
                continue;
            const lines = section.trim().split('\n');
            let currentFile = '';
            let fileMetrics = {
                statements: { covered: 0, total: 0, percentage: 0 },
                branches: { covered: 0, total: 0, percentage: 0 },
                functions: { covered: 0, total: 0, percentage: 0 },
                lines: { covered: 0, total: 0, percentage: 0 }
            };
            for (const line of lines) {
                if (line.startsWith('SF:')) {
                    currentFile = line.substring(3);
                }
                else if (line.startsWith('LF:')) {
                    fileMetrics.lines.total = parseInt(line.substring(3), 10);
                    totalLines.total += fileMetrics.lines.total;
                }
                else if (line.startsWith('LH:')) {
                    fileMetrics.lines.covered = parseInt(line.substring(3), 10);
                    totalLines.covered += fileMetrics.lines.covered;
                }
                else if (line.startsWith('BRF:')) {
                    fileMetrics.branches.total = parseInt(line.substring(4), 10);
                    totalBranches.total += fileMetrics.branches.total;
                }
                else if (line.startsWith('BRH:')) {
                    fileMetrics.branches.covered = parseInt(line.substring(4), 10);
                    totalBranches.covered += fileMetrics.branches.covered;
                }
                else if (line.startsWith('FNF:')) {
                    fileMetrics.functions.total = parseInt(line.substring(4), 10);
                    totalFunctions.total += fileMetrics.functions.total;
                }
                else if (line.startsWith('FNH:')) {
                    fileMetrics.functions.covered = parseInt(line.substring(4), 10);
                    totalFunctions.covered += fileMetrics.functions.covered;
                }
            }
            // Calculate percentages
            fileMetrics.lines.percentage = fileMetrics.lines.total > 0
                ? (fileMetrics.lines.covered / fileMetrics.lines.total) * 100
                : 100;
            fileMetrics.branches.percentage = fileMetrics.branches.total > 0
                ? (fileMetrics.branches.covered / fileMetrics.branches.total) * 100
                : 100;
            fileMetrics.functions.percentage = fileMetrics.functions.total > 0
                ? (fileMetrics.functions.covered / fileMetrics.functions.total) * 100
                : 100;
            fileMetrics.statements.percentage = fileMetrics.lines.percentage; // Simplified
            if (currentFile) {
                byFile.set(currentFile, fileMetrics);
            }
        }
        const overall = {
            statements: {
                covered: totalLines.covered,
                total: totalLines.total,
                percentage: totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 100
            },
            branches: {
                covered: totalBranches.covered,
                total: totalBranches.total,
                percentage: totalBranches.total > 0 ? (totalBranches.covered / totalBranches.total) * 100 : 100
            },
            functions: {
                covered: totalFunctions.covered,
                total: totalFunctions.total,
                percentage: totalFunctions.total > 0 ? (totalFunctions.covered / totalFunctions.total) * 100 : 100
            },
            lines: {
                covered: totalLines.covered,
                total: totalLines.total,
                percentage: totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 100
            }
        };
        return {
            overall,
            byFile,
            byDirectory: new Map(),
            uncoveredLines: [],
            thresholdsMet: this.checkThresholds(overall, source)
        };
    }
    /**
     * Check if coverage meets thresholds
     */
    checkThresholds(coverage, source) {
        const thresholds = source === 'frontend'
            ? this.config.frontend.thresholds
            : this.config.backend.thresholds;
        return coverage.statements.pct >= thresholds.statements &&
            coverage.branches.pct >= thresholds.branches &&
            coverage.functions.pct >= thresholds.functions &&
            coverage.lines.pct >= thresholds.lines;
    }
    /**
     * Get global exclusion patterns
     */
    getGlobalExcludePatterns() {
        const frontendPatterns = this.config.frontend.exclude.map(p => `frontend/${p}`);
        const backendPatterns = this.config.backend.exclude.map(p => `backend/${p}`);
        return [
            ...frontendPatterns,
            ...backendPatterns,
            '**/node_modules/**',
            '**/dist/**',
            '**/coverage/**',
            '**/coverage-reports/**',
            '**/*.test.*',
            '**/*.spec.*'
        ];
    }
    /**
     * Load coverage configuration from file or create default
     */
    loadCoverageConfig() {
        const configPath = path.join(this.projectRoot, '.kiro', 'coverage-config.json');
        if (fs.existsSync(configPath)) {
            try {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
            catch (error) {
                console.warn('Failed to load coverage config, using defaults:', error);
            }
        }
        return this.getDefaultCoverageConfig();
    }
    /**
     * Save coverage configuration to file
     */
    saveCoverageConfig() {
        const configPath = path.join(this.projectRoot, '.kiro', 'coverage-config.json');
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    }
    /**
     * Get default coverage configuration
     */
    getDefaultCoverageConfig() {
        return {
            frontend: {
                collectFrom: [
                    'src/**/*.{ts,tsx}',
                    '!src/**/*.d.ts',
                    '!src/main.tsx',
                    '!src/setupTests.ts',
                    '!src/**/*.test.{ts,tsx}',
                    '!src/**/*.spec.{ts,tsx}',
                    '!src/__mocks__/**',
                    '!src/test-utils.tsx'
                ],
                exclude: [
                    '**/*.test.ts',
                    '**/*.test.tsx',
                    '**/*.spec.ts',
                    '**/*.spec.tsx',
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/coverage/**',
                    '**/__mocks__/**',
                    '**/test-utils.tsx',
                    '**/setupTests.ts'
                ],
                reporters: ['text', 'lcov', 'html', 'json-summary'],
                directory: 'coverage',
                thresholds: {
                    statements: 80,
                    branches: 75,
                    functions: 80,
                    lines: 80
                }
            },
            backend: {
                collectFrom: [
                    'src/**/*.ts',
                    '!src/**/*.d.ts',
                    '!src/server.ts',
                    '!src/cli/**/*.ts',
                    '!src/**/*.test.ts',
                    '!src/**/*.spec.ts',
                    '!src/__tests__/**',
                    '!src/test-setup.ts'
                ],
                exclude: [
                    '**/*.test.ts',
                    '**/*.spec.ts',
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/coverage/**',
                    '**/__tests__/**',
                    '**/test-setup.ts',
                    '**/cli/**'
                ],
                reporters: ['text', 'lcov', 'html', 'json-summary'],
                directory: 'coverage',
                thresholds: {
                    statements: 80,
                    branches: 75,
                    functions: 80,
                    lines: 80
                }
            },
            global: {
                aggregatedDirectory: 'coverage-reports',
                formats: ['html', 'json', 'lcov', 'text', 'badge'],
                includeHistorical: true,
                badgeGeneration: true,
                thresholds: {
                    statements: 80,
                    branches: 75,
                    functions: 80,
                    lines: 80
                }
            }
        };
    }
    /**
     * Find project root directory
     */
    findProjectRoot() {
        let currentDir = process.cwd();
        while (currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, 'package.json'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return process.cwd();
    }
}
export default CoverageConfigManager;
