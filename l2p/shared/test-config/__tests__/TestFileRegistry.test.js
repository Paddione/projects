import * as fs from 'fs';
import { TestFileRegistry } from '../TestFileRegistry';
// Mock fs and glob for testing
jest.mock('fs');
jest.mock('glob', () => ({
    glob: jest.fn()
}));
const mockFs = fs;
const { glob } = require('glob');
const mockGlob = glob;
describe('TestFileRegistry', () => {
    let registry;
    const mockRootPath = '/mock/project';
    beforeEach(() => {
        registry = new TestFileRegistry(mockRootPath);
        jest.clearAllMocks();
    });
    describe('discoverTestFiles', () => {
        it('should discover and categorize test files correctly', async () => {
            const mockFiles = [
                'src/components/Button.test.tsx',
                'src/__tests__/unit/service.test.ts',
                'src/__tests__/integration/api.test.ts',
                'e2e/tests/auth.spec.ts',
                'src/__tests__/performance/load.test.ts',
                'src/__tests__/accessibility/a11y.spec.ts',
                'src/__tests__/cli/database.ts'
            ];
            mockGlob.mockResolvedValue(mockFiles);
            const result = await registry.discoverTestFiles();
            expect(result).toEqual({
                unit: ['src/components/Button.test.tsx', 'src/__tests__/unit/service.test.ts'],
                integration: ['src/__tests__/integration/api.test.ts'],
                e2e: ['e2e/tests/auth.spec.ts'],
                performance: ['src/__tests__/performance/load.test.ts'],
                accessibility: ['src/__tests__/accessibility/a11y.spec.ts'],
                cli: ['src/__tests__/cli/database.ts'],
                orphaned: []
            });
        });
        it('should handle empty results', async () => {
            mockGlob.mockResolvedValue([]);
            const result = await registry.discoverTestFiles();
            expect(result).toEqual({
                unit: [],
                integration: [],
                e2e: [],
                performance: [],
                accessibility: [],
                cli: [],
                orphaned: []
            });
        });
        it('should remove duplicate files', async () => {
            const mockFiles = [
                'src/test.spec.ts',
                'src/test.spec.ts', // duplicate
                'src/other.test.ts'
            ];
            mockGlob.mockResolvedValue(mockFiles);
            const result = await registry.discoverTestFiles();
            const allFiles = Object.values(result).flat();
            expect(allFiles).toHaveLength(2);
            expect(allFiles).toContain('src/test.spec.ts');
            expect(allFiles).toContain('src/other.test.ts');
        });
    });
    describe('categorizeTestFiles', () => {
        it('should categorize unit tests correctly', () => {
            const files = [
                'src/components/Button.test.tsx',
                'src/__tests__/unit/service.test.ts',
                'src/utils/helper.test.js'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.unit).toEqual(files);
            expect(result.integration).toEqual([]);
        });
        it('should categorize integration tests correctly', () => {
            const files = [
                'src/__tests__/integration/api.test.ts',
                'src/api/auth.test.ts'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.integration).toEqual(files);
            expect(result.unit).toEqual([]);
        });
        it('should categorize e2e tests correctly', () => {
            const files = [
                'e2e/tests/login.spec.ts',
                'e2e/tests/auth.spec.ts',
                'tests/playwright/game.spec.ts'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.e2e).toEqual(files);
        });
        it('should categorize performance tests correctly', () => {
            const files = [
                'src/__tests__/performance/load.test.ts',
                'tests/load-test.spec.ts',
                'perf-test/memory.test.js'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.performance).toEqual(files);
        });
        it('should categorize accessibility tests correctly', () => {
            const files = [
                'src/__tests__/accessibility/a11y.spec.ts',
                'tests/a11y-compliance.test.ts',
                'src/axe-tests.spec.ts'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.accessibility).toEqual(files);
        });
        it('should categorize CLI tests correctly', () => {
            const files = [
                'src/__tests__/cli/database.ts',
                'src/cli/migrate.test.ts'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.cli).toEqual(files);
        });
        it('should mark unrecognized files as orphaned', () => {
            const files = [
                'src/random-file.ts',
                'config/setup.js'
            ];
            const result = registry.categorizeTestFiles(files);
            expect(result.orphaned).toEqual(files);
        });
    });
    describe('categorizeTests', () => {
        beforeEach(() => {
            // Mock fs.promises.stat
            mockFs.promises = {
                stat: jest.fn(),
                readFile: jest.fn(),
                access: jest.fn(),
                writeFile: jest.fn()
            };
        });
        it('should provide detailed test file information', async () => {
            const files = ['src/test.spec.ts'];
            const mockStats = {
                size: 1024,
                mtime: new Date('2023-01-01')
            };
            const mockContent = `
        describe('Test', () => {
          it('should work', () => {
            expect(true).toBe(true);
          });
        });
      `;
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const result = await registry.categorizeTests(files);
            // According to implementation, a generic *.spec.ts outside e2e paths is a unit test
            expect(result.unit).toHaveLength(1);
            const testInfo = result.unit[0];
            expect(testInfo.relativePath).toBe('src/test.spec.ts');
            expect(testInfo.type).toBe('unit');
            expect(testInfo.runner).toBe('jest');
            expect(testInfo.valid).toBe(true);
            expect(testInfo.size).toBe(1024);
            expect(testInfo.errors).toEqual([]);
        });
        it('should handle file access errors', async () => {
            const files = ['src/missing.test.ts'];
            const enoent = Object.assign(new Error('File not found'), { code: 'ENOENT' });
            mockFs.promises.stat.mockRejectedValue(enoent);
            const result = await registry.categorizeTests(files);
            expect(result.unit).toHaveLength(1);
            const testInfo = result.unit[0];
            expect(testInfo.valid).toBe(false);
            expect(testInfo.errors).toContain('File not accessible: Error: File not found');
        });
        it('should detect empty files', async () => {
            const files = ['src/empty.test.ts'];
            const mockStats = { size: 0, mtime: new Date() };
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue('   ');
            const result = await registry.categorizeTests(files);
            const testInfo = result.unit[0];
            expect(testInfo.valid).toBe(false);
            expect(testInfo.errors).toContain('File is empty');
        });
        it('should detect files without test patterns', async () => {
            const files = ['src/no-tests.test.ts'];
            const mockStats = { size: 100, mtime: new Date() };
            const mockContent = 'const x = 1;';
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const result = await registry.categorizeTests(files);
            const testInfo = result.unit[0];
            expect(testInfo.errors).toContain('No test patterns found (describe, it, test, etc.)');
        });
    });
    describe('validateTestFiles', () => {
        beforeEach(() => {
            mockFs.promises = {
                access: jest.fn(),
                readFile: jest.fn(),
                stat: jest.fn(),
                writeFile: jest.fn()
            };
        });
        it('should validate accessible files with test patterns', async () => {
            const files = ['src/valid.test.ts'];
            const mockContent = `
        describe('Valid test', () => {
          it('should pass', () => {
            expect(true).toBe(true);
          });
        });
      `;
            mockFs.promises.access.mockResolvedValue(undefined);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const results = await registry.validateTestFiles(files);
            expect(results).toHaveLength(1);
            expect(results[0].valid).toBe(true);
            expect(results[0].errors).toEqual([]);
            expect(results[0].warnings).toEqual([]);
        });
        it('should detect focused tests', async () => {
            const files = ['src/focused.test.ts'];
            const mockContent = `
        fdescribe('Focused test', () => {
          fit('should be focused', () => {
            expect(true).toBe(true);
          });
        });
      `;
            mockFs.promises.access.mockResolvedValue(undefined);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const results = await registry.validateTestFiles(files);
            expect(results[0].warnings).toContain('Contains focused tests (fdescribe/fit)');
        });
        it('should detect skipped tests', async () => {
            const files = ['src/skipped.test.ts'];
            const mockContent = `
        xdescribe('Skipped test', () => {
          xit('should be skipped', () => {
            expect(true).toBe(true);
          });
        });
      `;
            mockFs.promises.access.mockResolvedValue(undefined);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const results = await registry.validateTestFiles(files);
            expect(results[0].warnings).toContain('Contains skipped tests (xdescribe/xit)');
        });
        it('should handle inaccessible files', async () => {
            const files = ['src/inaccessible.test.ts'];
            const eacces = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
            mockFs.promises.access.mockRejectedValue(eacces);
            const results = await registry.validateTestFiles(files);
            expect(results[0].valid).toBe(false);
            expect(results[0].errors).toContain('Cannot access file: Error: Permission denied');
        });
    });
    describe('generateInventoryReport', () => {
        beforeEach(() => {
            mockFs.promises = {
                stat: jest.fn(),
                readFile: jest.fn(),
                access: jest.fn(),
                writeFile: jest.fn()
            };
        });
        it('should generate comprehensive inventory report', async () => {
            const mockFiles = [
                'src/unit.test.ts',
                'src/integration.test.ts',
                'e2e/tests/example.spec.ts'
            ];
            const mockStats = { size: 1024, mtime: new Date() };
            const mockContent = 'describe("test", () => { it("works", () => {}); });';
            mockGlob.mockResolvedValue(mockFiles);
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const report = await registry.generateInventoryReport();
            expect(report.summary.totalFiles).toBe(3);
            expect(report.summary.validFiles).toBe(3);
            expect(report.summary.invalidFiles).toBe(0);
            expect(report.summary.byType.unit).toBe(1);
            expect(report.summary.byType.integration).toBe(1);
            expect(report.summary.byType.e2e).toBe(1);
            expect(report.recommendations).toBeInstanceOf(Array);
        });
        it('should detect duplicate files', async () => {
            const mockFiles = [
                'src/test.spec.ts',
                'other/test.spec.ts' // same filename, different path
            ];
            const mockStats = { size: 1024, mtime: new Date() };
            const mockContent = 'describe("test", () => {});';
            mockGlob.mockResolvedValue(mockFiles);
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const report = await registry.generateInventoryReport();
            expect(report.duplicates).toHaveLength(1);
            expect(report.duplicates[0]).toEqual(['src/test.spec.ts', 'other/test.spec.ts']);
        });
        it('should generate recommendations', async () => {
            const mockFiles = ['src/orphaned-file.ts']; // Will be categorized as orphaned
            const mockStats = { size: 1024, mtime: new Date() };
            const mockContent = 'const x = 1;'; // No test patterns
            mockGlob.mockResolvedValue(mockFiles);
            mockFs.promises.stat.mockResolvedValue(mockStats);
            mockFs.promises.readFile.mockResolvedValue(mockContent);
            const report = await registry.generateInventoryReport();
            expect(report.recommendations).toContain('Found 1 orphaned test files that need categorization');
            expect(report.recommendations).toContain('Remove empty integration test directories');
        });
    });
});
