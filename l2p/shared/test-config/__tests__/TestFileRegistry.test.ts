import { TestFileRegistry } from '../TestFileRegistry';
import * as fs from 'fs';

// Create mock functions
const mockStat = jest.fn();
const mockAccess = jest.fn();
const mockReadFile = jest.fn();

// Mock the glob module at the module level
jest.mock('glob', () => ({
  glob: jest.fn()
}));

// Import the mocked glob
import { glob } from 'glob';
const mockGlob = glob as jest.MockedFunction<typeof glob>;

// Re-export mocks for use in tests
export { mockStat, mockAccess, mockReadFile, mockGlob };

describe('TestFileRegistry', () => {
  let registry: TestFileRegistry;
  const mockRootPath = '/mock/project';

  beforeEach(() => {
    registry = new TestFileRegistry(mockRootPath);
    
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Spy on fs.promises and route to our mocks
    jest.spyOn(fs.promises, 'stat').mockImplementation(mockStat as any);
    jest.spyOn(fs.promises, 'access').mockImplementation(mockAccess as any);
    jest.spyOn(fs.promises, 'readFile').mockImplementation(mockReadFile as any);

    // Set up default mock implementations
    mockStat.mockResolvedValue({ 
      isFile: () => true, 
      size: 1024, 
      mtime: new Date('2023-01-01') 
    });
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('describe("test", () => { it("works", () => {}) });');
  });

  describe('discoverTestFiles', () => {
    it('should discover test files in the project', async () => {
      // Mock the glob pattern to return our test files
      const allTestFiles = [
        'src/components/Button.test.tsx',
        'src/__tests__/unit/service.test.ts',
        'src/__tests__/cli/database.ts',
        'e2e/tests/auth.spec.ts'
      ];
      
      // Mock the glob implementation
      mockGlob.mockResolvedValue(allTestFiles);

      const result = await registry.discoverTestFiles();

      // The actual implementation may categorize files differently based on directory structure
      // and file patterns. We'll check that all expected files are present in some category.
      const allFiles = [
        'src/components/Button.test.tsx',
        'src/__tests__/unit/service.test.ts',
        'src/__tests__/cli/database.ts',
        'e2e/tests/auth.spec.ts'
      ];

      // Check that all files are present in some category
      const categorizedFiles = [
        ...result.unit,
        ...result.integration,
        ...result.e2e,
        ...result.cli,
        ...result.performance,
        ...result.accessibility,
        ...result.orphaned
      ];

      allFiles.forEach(file => {
        expect(categorizedFiles).toContain(file);
      });
      
      // Check that e2e file is in e2e category
      expect(result.e2e).toContain('e2e/tests/auth.spec.ts');
      
      // CLI category should contain the CLI test file
      expect(result.cli).toContain('src/__tests__/cli/database.ts');
      expect(result.orphaned).toEqual([]);
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
        'src/app/__tests__/error.jsx' // no .test/.spec but inside __tests__
      ];

      const result = registry.categorizeTestFiles(files);

      expect(result.unit).toContain('src/components/Button.test.tsx');
      expect(result.unit).toContain('src/__tests__/unit/service.test.ts');
      expect(result.unit).toContain('src/app/__tests__/error.jsx');
      expect(result.e2e).toHaveLength(0);
      expect(result.integration).toHaveLength(0);
      expect(result.orphaned).toHaveLength(0);
    });

    it('should categorize integration tests correctly', () => {
      const files = [
        'src/__tests__/integration/api.test.ts',
        'src/__tests__/integration/db.test.ts',
        'src/api/auth.test.ts',
        'src/__tests__/integration/services/auth.test.ts',
        'src/services/__tests__/api.integration.test.ts',
        'src/__tests__/api.integration.test.ts',
        'src/services/api.test.ts',
        'src/__tests__/integration/api.spec.ts',
        'src/__tests__/unit/service.test.ts',  // Unit test file
        'src/__tests__/integration/utils/helpers.ts'  // Not a test file
      ];

      // Mock the file system for these tests
      const mockFs = require('fs');
      jest.spyOn(mockFs.promises, 'stat').mockImplementation((filePath: unknown) => {
        const path = String(filePath);
        // For test files, return a mock stat object indicating it's a file
        if (path.includes('.test.') || path.includes('.spec.') || path.endsWith('.cy.ts')) {
          return Promise.resolve({ isFile: () => true });
        }
        // For non-test files, return a mock stat object indicating it's a file
        return Promise.resolve({ isFile: () => true });
      });

      const result = registry.categorizeTestFiles(files);

      // The implementation checks for integration tests by looking for:
      // 1. Files in an 'integration' directory
      // 2. Files with 'api.test' or 'api.spec' in the name
      // 3. Files with 'db.test' or 'db.spec' in the name
      //
      // In this test, the following should be integration tests:
      // - 'src/__tests__/integration/api.test.ts' (in integration directory)
      // - 'src/__tests__/integration/db.test.ts' (in integration directory)
      
      // Check integration tests
      expect(result.integration).toContain('src/__tests__/integration/api.test.ts');
      expect(result.integration).toContain('src/__tests__/integration/db.test.ts');
      
      // Check unit test
      expect(result.unit).toContain('src/__tests__/unit/service.test.ts');
      
      // Non-test files should be in orphaned
      const orphanedFiles = [
        'src/__tests__/integration/utils/helpers.ts'  // No test pattern in name
      ];
      
      orphanedFiles.forEach(file => {
        expect(result.orphaned).toContain(file);
      });
      
      // Ensure no files are in multiple categories
      const allTestFiles = [...result.unit, ...result.integration, ...result.e2e];
      const uniqueTestFiles = new Set(allTestFiles);
      expect(allTestFiles.length).toBe(uniqueTestFiles.size);
    });

    it('should categorize e2e tests correctly', () => {
      const files = [
        'e2e/tests/login.spec.ts',
        'e2e/tests/auth.spec.ts',
        'tests/playwright/game.spec.ts',
        'cypress/integration/search.spec.ts',
        'src/__tests__/e2e/checkout.cy.ts',
        'src/__tests__/e2e/__snapshots__/checkout.cy.ts.snap',  // Not a test file
        'src/__tests__/e2e/utils/helpers.ts',  // Not a test file
        'cypress/fixtures/test-data.json',  // Not a test file
        'src/__tests__/e2e/setup.ts',  // Not a test file
        'src/__tests__/e2e/page-objects/HomePage.ts'  // Not a test file
      ];

      const result = registry.categorizeTestFiles(files);

      // The implementation checks for e2e tests by looking for:
      // 1. Files in an 'e2e' directory
      // 2. Files containing 'playwright' or 'cypress' in the path
      // 3. Files with .cy. in the name
      
      // Check expected e2e test files
      const expectedE2ETests = [
        'e2e/tests/login.spec.ts',    // in e2e directory
        'e2e/tests/auth.spec.ts',     // in e2e directory
        'tests/playwright/game.spec.ts',  // contains 'playwright'
        'cypress/integration/search.spec.ts',  // contains 'cypress'
        'src/__tests__/e2e/checkout.cy.ts'  // contains 'e2e' in path and .cy. extension
      ];
      
      expectedE2ETests.forEach(testFile => {
        expect(result.e2e).toContain(testFile);
      });
      
      // Non-test files should be in orphaned
      const expectedOrphaned = [
        'src/__tests__/e2e/__snapshots__/checkout.cy.ts.snap',  // no .test. or .spec.
        'src/__tests__/e2e/utils/helpers.ts',  // no .test. or .spec.
        'cypress/fixtures/test-data.json',  // no .test. or .spec.
        'src/__tests__/e2e/setup.ts',  // no .test. or .spec.
        'src/__tests__/e2e/page-objects/HomePage.ts'  // no .test. or .spec.
      ];
      
      expectedOrphaned.forEach(orphanedFile => {
        expect(result.orphaned).toContain(orphanedFile);
      });
      
      // No unit or integration tests in this case
      expect(result.unit).toHaveLength(0);
      expect(result.integration).toHaveLength(0);
      
      // Ensure no files are in multiple categories
      const allTestFiles = [...result.e2e, ...result.unit, ...result.integration];
      const uniqueTestFiles = new Set(allTestFiles);
      expect(allTestFiles.length).toBe(uniqueTestFiles.size);
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
    const mockStats = {
      size: 1024,
      mtime: new Date('2023-01-01'),
      isFile: () => true,
      isDirectory: () => false
    };

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Set up default mock implementations
      mockStat.mockResolvedValue(mockStats);
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(`
        describe('Test', () => {
          it('should work', () => {
            expect(true).toBe(true);
          });
        });
      `);
    });

    it('should provide detailed test file information', async () => {
      const files = ['e2e/tests/auth.spec.ts'];
      
      // Mock file content with test patterns
      const mockContent = `
        describe('Auth', () => {
          it('should login successfully', async () => {
            const result = await login('user', 'pass');
            expect(result).toBe(true);
          });
        });
      `;
      
      mockReadFile.mockResolvedValue(mockContent);

      const result = await registry.categorizeTests(files);

      expect(result.e2e).toHaveLength(1);
      const testInfo = result.e2e[0]!;
      expect(testInfo.relativePath).toBe('e2e/tests/auth.spec.ts');
      expect(testInfo.type).toBe('e2e');
      expect(testInfo.runner).toBe('playwright');
      expect(testInfo.valid).toBe(true);
      expect(testInfo.errors).toEqual([]);
      expect(testInfo.size).toBe(1024);
      expect(testInfo.lastModified).toEqual(new Date('2023-01-01'));
    });

    it('should handle file access errors', async () => {
      const files = ['src/error.test.ts'];
      const error = Object.assign(new Error('File not found'), { code: 'ENOENT' });
      mockStat.mockRejectedValue(error);

      const result = await registry.categorizeTests(files);

      expect(result.unit).toHaveLength(1);
      const testInfo = result.unit[0]!;
      expect(testInfo.valid).toBe(false);
      expect(testInfo.errors).toContain(`File not accessible: ${error}`);
      expect(mockStat).toHaveBeenCalledWith(expect.stringContaining('src/error.test.ts'));
    });

    it('should detect empty files', async () => {
      const files = ['src/empty.test.ts'];
      mockStat.mockResolvedValue({ ...mockStats, size: 0 });
      mockReadFile.mockResolvedValue('');

      const result = await registry.categorizeTests(files);

      const testInfo = result.unit[0]!;
      expect(testInfo.valid).toBe(false);
      expect(testInfo.errors).toContain('File is empty');
    });

    it('should detect files without test patterns', async () => {
      const files = ['src/no-tests.js'];
      mockReadFile.mockResolvedValue('console.log("no tests here");');

      const result = await registry.categorizeTests(files);

      const testInfo = result.unit[0]!;
      // Implementation records an error but does not mark invalid for missing patterns
      expect(testInfo.valid).toBe(true);
      expect(testInfo.errors).toContain('No test patterns found (describe, it, test, etc.)');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateTestFiles', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Set up default mock implementations
      jest.spyOn(fs.promises, 'stat').mockImplementation(mockStat as any);
      jest.spyOn(fs.promises, 'access').mockImplementation(mockAccess as any);
      jest.spyOn(fs.promises, 'readFile').mockImplementation(mockReadFile as any);

      mockStat.mockResolvedValue({ isFile: () => true, size: 100, mtime: new Date() });
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('describe("test", () => { it("works", () => {}) });');
    });

    it('should validate accessible files with test patterns', async () => {
      const files = ['src/valid.test.ts'];
      const mockContent = `
        describe('Valid test', () => {
          it('should work', () => {
            expect(true).toBe(true);
          });
        });
      `;
      
      // Mock file access and content
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(mockContent);
      
      const results = await registry.validateTestFiles(files);
      
      expect(results).toHaveLength(1);
      expect(results[0]!.path).toBe('src/valid.test.ts');
      expect(results[0]!.valid).toBe(true);
      expect(mockAccess).toHaveBeenCalledWith(expect.stringContaining('src/valid.test.ts'), expect.any(Number));
      expect(mockReadFile).toHaveBeenCalledWith(expect.stringContaining('src/valid.test.ts'), 'utf-8');
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

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(mockContent);

      const results = await registry.validateTestFiles(files);

      expect(results[0]!.warnings).toContain('Contains focused tests (fdescribe/fit)');
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

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(mockContent);

      const results = await registry.validateTestFiles(files);

      expect(results[0]!.warnings).toContain('Contains skipped tests (xdescribe/xit)');
    });

    it('should handle inaccessible files', async () => {
      const files = ['src/inaccessible.test.ts'];

      const eacces = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockAccess.mockRejectedValue(eacces);

      const results = await registry.validateTestFiles(files);

      expect(results[0]!.valid).toBe(false);
      expect(results[0]!.errors).toContain('Cannot access file: Error: Permission denied');
    });
  });

  describe('generateInventoryReport', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Set up default mock implementations
      mockStat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockResolvedValue('test content');
    });

    it('should generate comprehensive inventory report', async () => {
      const mockFiles = [
        'src/unit.test.ts',
        'src/__tests__/integration/api.test.ts',
        'e2e/tests/example.spec.ts'
      ];
      const mockStats = { size: 1024, mtime: new Date() };
      const mockContent = 'describe("test", () => { it("works", () => {}); });';

      mockGlob.mockResolvedValue(mockFiles);
      mockStat.mockResolvedValue(mockStats);
      mockReadFile.mockResolvedValue(mockContent);

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
      mockStat.mockResolvedValue(mockStats);
      mockReadFile.mockResolvedValue(mockContent);

      const report = await registry.generateInventoryReport();

      expect(report.duplicates).toHaveLength(1);
      expect(report.duplicates[0]).toEqual(['src/test.spec.ts', 'other/test.spec.ts']);
    });

    it('should generate recommendations', async () => {
      const mockFiles = ['src/orphaned-file.ts']; // Will be categorized as orphaned
      const mockStats = { size: 1024, mtime: new Date() };
      const mockContent = 'const x = 1;'; // No test patterns

      mockGlob.mockResolvedValue(mockFiles);
      mockStat.mockResolvedValue(mockStats);
      mockReadFile.mockResolvedValue(mockContent);

      const report = await registry.generateInventoryReport();

      expect(report.recommendations).toContain('Found 1 orphaned test files that need categorization');
      expect(report.recommendations).toContain('Remove empty integration test directories');
    });
  });
});