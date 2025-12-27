/**
 * Tests for CoverageConfigManager class
 */
import * as fs from 'fs';
import { CoverageConfigManager } from '../CoverageConfigManager';
// Mock fs module
jest.mock('fs');
const mockFs = fs;
describe('CoverageConfigManager', () => {
    let coverageManager;
    let tempDir;
    beforeEach(() => {
        jest.clearAllMocks();
        tempDir = '/tmp/test-project';
        // Mock fs methods
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockImplementation(() => undefined);
        mockFs.writeFileSync.mockImplementation(() => undefined);
        mockFs.readFileSync.mockImplementation(() => '{}');
        mockFs.readdirSync.mockReturnValue([]);
        // Reset singleton instance
        CoverageConfigManager.instance = undefined;
        coverageManager = CoverageConfigManager.getInstance(tempDir);
    });
    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = CoverageConfigManager.getInstance();
            const instance2 = CoverageConfigManager.getInstance();
            expect(instance1).toBe(instance2);
        });
        it('should use provided project root', () => {
            const customRoot = '/custom/root';
            const instance = CoverageConfigManager.getInstance(customRoot);
            expect(instance).toBeDefined();
        });
    });
    describe('getFrontendJestConfig', () => {
        it('should return valid Jest configuration for frontend', () => {
            const config = coverageManager.getFrontendJestConfig();
            expect(config).toHaveProperty('collectCoverageFrom');
            expect(config).toHaveProperty('coverageDirectory');
            expect(config).toHaveProperty('coverageReporters');
            expect(config).toHaveProperty('coverageThreshold');
            expect(config).toHaveProperty('coveragePathIgnorePatterns');
            expect(Array.isArray(config.collectCoverageFrom)).toBe(true);
            expect(Array.isArray(config.coverageReporters)).toBe(true);
            expect(Array.isArray(config.coveragePathIgnorePatterns)).toBe(true);
            expect(typeof config.coverageDirectory).toBe('string');
            expect(config.coverageThreshold).toHaveProperty('global');
        });
        it('should include TypeScript and React file patterns', () => {
            const config = coverageManager.getFrontendJestConfig();
            expect(config.collectCoverageFrom).toContain('src/**/*.{ts,tsx}');
            expect(config.collectCoverageFrom).toContain('!src/**/*.test.{ts,tsx}');
            expect(config.collectCoverageFrom).toContain('!src/**/*.spec.{ts,tsx}');
        });
        it('should exclude test files and build artifacts', () => {
            const config = coverageManager.getFrontendJestConfig();
            expect(config.coveragePathIgnorePatterns).toContain('**/*.test.ts');
            expect(config.coveragePathIgnorePatterns).toContain('**/*.test.tsx');
            expect(config.coveragePathIgnorePatterns).toContain('**/node_modules/**');
            expect(config.coveragePathIgnorePatterns).toContain('**/dist/**');
        });
    });
    describe('getBackendJestConfig', () => {
        it('should return valid Jest configuration for backend', () => {
            const config = coverageManager.getBackendJestConfig();
            expect(config).toHaveProperty('collectCoverageFrom');
            expect(config).toHaveProperty('coverageDirectory');
            expect(config).toHaveProperty('coverageReporters');
            expect(config).toHaveProperty('coverageThreshold');
            expect(config).toHaveProperty('coveragePathIgnorePatterns');
            expect(Array.isArray(config.collectCoverageFrom)).toBe(true);
            expect(Array.isArray(config.coverageReporters)).toBe(true);
            expect(Array.isArray(config.coveragePathIgnorePatterns)).toBe(true);
        });
        it('should include TypeScript file patterns', () => {
            const config = coverageManager.getBackendJestConfig();
            expect(config.collectCoverageFrom).toContain('src/**/*.ts');
            expect(config.collectCoverageFrom).toContain('!src/**/*.test.ts');
            expect(config.collectCoverageFrom).toContain('!src/**/*.spec.ts');
        });
        it('should exclude CLI and server files', () => {
            const config = coverageManager.getBackendJestConfig();
            expect(config.collectCoverageFrom).toContain('!src/server.ts');
            expect(config.collectCoverageFrom).toContain('!src/cli/**/*.ts');
        });
    });
    describe('updateThresholds', () => {
        it('should update frontend thresholds', () => {
            const newThresholds = { statements: 90, lines: 85 };
            coverageManager.updateThresholds(newThresholds, 'frontend');
            const config = coverageManager.getCoverageConfig();
            expect(config.frontend.thresholds.statements).toBe(90);
            expect(config.frontend.thresholds.lines).toBe(85);
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });
        it('should update backend thresholds', () => {
            const newThresholds = { branches: 80, functions: 85 };
            coverageManager.updateThresholds(newThresholds, 'backend');
            const config = coverageManager.getCoverageConfig();
            expect(config.backend.thresholds.branches).toBe(80);
            expect(config.backend.thresholds.functions).toBe(85);
        });
        it('should update global thresholds', () => {
            const newThresholds = { statements: 85 };
            coverageManager.updateThresholds(newThresholds, 'global');
            const config = coverageManager.getCoverageConfig();
            expect(config.global.thresholds.statements).toBe(85);
        });
    });
    describe('addExclusionPatterns', () => {
        it('should add patterns to frontend exclusions', () => {
            const patterns = ['**/test-utils/**', '**/*.mock.ts'];
            coverageManager.addExclusionPatterns(patterns, 'frontend');
            const config = coverageManager.getCoverageConfig();
            expect(config.frontend.exclude).toContain('**/test-utils/**');
            expect(config.frontend.exclude).toContain('**/*.mock.ts');
        });
        it('should add patterns to backend exclusions', () => {
            const patterns = ['**/fixtures/**'];
            coverageManager.addExclusionPatterns(patterns, 'backend');
            const config = coverageManager.getCoverageConfig();
            expect(config.backend.exclude).toContain('**/fixtures/**');
        });
        it('should add patterns to both when target is global', () => {
            const patterns = ['**/temp/**'];
            coverageManager.addExclusionPatterns(patterns, 'global');
            const config = coverageManager.getCoverageConfig();
            expect(config.frontend.exclude).toContain('**/temp/**');
            expect(config.backend.exclude).toContain('**/temp/**');
        });
    });
    describe('removeExclusionPatterns', () => {
        it('should remove patterns from frontend exclusions', () => {
            // First add some patterns
            coverageManager.addExclusionPatterns(['**/temp/**'], 'frontend');
            // Then remove them
            coverageManager.removeExclusionPatterns(['**/temp/**'], 'frontend');
            const config = coverageManager.getCoverageConfig();
            expect(config.frontend.exclude).not.toContain('**/temp/**');
        });
        it('should remove patterns from backend exclusions', () => {
            coverageManager.addExclusionPatterns(['**/temp/**'], 'backend');
            coverageManager.removeExclusionPatterns(['**/temp/**'], 'backend');
            const config = coverageManager.getCoverageConfig();
            expect(config.backend.exclude).not.toContain('**/temp/**');
        });
    });
    describe('collectAndAggregateCoverage', () => {
        beforeEach(() => {
            // Mock coverage directories exist
            mockFs.existsSync.mockImplementation((path) => {
                return path.includes('coverage') || path.includes('.kiro');
            });
            // Mock coverage summary file
            const mockCoverageSummary = {
                total: {
                    statements: { covered: 80, total: 100, pct: 80 },
                    branches: { covered: 75, total: 100, pct: 75 },
                    functions: { covered: 90, total: 100, pct: 90 },
                    lines: { covered: 85, total: 100, pct: 85 }
                },
                'src/utils.ts': {
                    statements: { covered: 80, total: 100, pct: 80 },
                    branches: { covered: 75, total: 100, pct: 75 },
                    functions: { covered: 90, total: 100, pct: 90 },
                    lines: { covered: 85, total: 100, pct: 85 }
                }
            };
            mockFs.readFileSync.mockImplementation((path) => {
                if (path.includes('coverage-summary.json')) {
                    return JSON.stringify(mockCoverageSummary);
                }
                return '{}';
            });
        });
        it('should collect coverage from both frontend and backend', async () => {
            const summary = await coverageManager.collectAndAggregateCoverage();
            expect(summary).toHaveProperty('frontend');
            expect(summary).toHaveProperty('backend');
            expect(summary).toHaveProperty('aggregated');
            expect(summary).toHaveProperty('reportPaths');
            expect(summary).toHaveProperty('thresholdsMet');
        });
        it('should handle missing coverage data gracefully', async () => {
            mockFs.existsSync.mockReturnValue(false);
            const summary = await coverageManager.collectAndAggregateCoverage();
            expect(summary.frontend).toBeNull();
            expect(summary.backend).toBeNull();
            expect(summary.aggregated).toBeNull();
            expect(summary.reportPaths).toHaveLength(0);
        });
        it('should generate badge when enabled', async () => {
            const config = coverageManager.getCoverageConfig();
            config.global.badgeGeneration = true;
            coverageManager.updateCoverageConfig(config);
            const summary = await coverageManager.collectAndAggregateCoverage();
            // Badge generation would be called if coverage data exists
            expect(summary).toHaveProperty('badgePath');
        });
    });
    describe('createCoverageSummary', () => {
        it('should create coverage summary file', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify({
                total: {
                    statements: { covered: 80, total: 100, pct: 80 },
                    branches: { covered: 75, total: 100, pct: 75 },
                    functions: { covered: 90, total: 100, pct: 90 },
                    lines: { covered: 85, total: 100, pct: 85 }
                }
            }));
            const summaryPath = await coverageManager.createCoverageSummary();
            expect(typeof summaryPath).toBe('string');
            expect(summaryPath).toContain('coverage-summary.json');
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });
    });
    describe('configuration persistence', () => {
        it('should save configuration to file', () => {
            coverageManager.updateThresholds({ statements: 95 }, 'frontend');
            expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('coverage-config.json'), expect.stringContaining('"statements": 95'));
        });
        it('should load configuration from file when it exists', () => {
            const mockConfig = {
                frontend: {
                    thresholds: { statements: 95, branches: 85, functions: 90, lines: 88 }
                }
            };
            mockFs.existsSync.mockImplementation((path) => {
                return path.includes('coverage-config.json');
            });
            mockFs.readFileSync.mockImplementation((path) => {
                if (path.includes('coverage-config.json')) {
                    return JSON.stringify(mockConfig);
                }
                return '{}';
            });
            // Create new instance to test loading
            CoverageConfigManager.instance = undefined;
            const newManager = CoverageConfigManager.getInstance(tempDir);
            expect(mockFs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('coverage-config.json'), 'utf8');
        });
        it('should use default configuration when file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const config = coverageManager.getCoverageConfig();
            expect(config.frontend.thresholds.statements).toBe(80);
            expect(config.backend.thresholds.statements).toBe(80);
            expect(config.global.thresholds.statements).toBe(80);
        });
    });
    describe('error handling', () => {
        it('should handle file system errors gracefully', async () => {
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });
            // Should not throw, but log warning
            const summary = await coverageManager.collectAndAggregateCoverage();
            expect(summary.frontend).toBeNull();
            expect(summary.backend).toBeNull();
        });
        it('should handle malformed JSON gracefully', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('invalid json');
            // Should fall back to defaults
            const config = coverageManager.getCoverageConfig();
            expect(config).toBeDefined();
            expect(config.frontend.thresholds.statements).toBe(80);
        });
    });
});
