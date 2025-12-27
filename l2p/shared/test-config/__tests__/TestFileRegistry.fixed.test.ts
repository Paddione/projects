import { TestFileRegistry } from '../TestFileRegistry';
import * as fs from 'fs';

// Create mock functions
const mockStat = jest.fn().mockResolvedValue({ size: 123, mtime: new Date(), isFile: () => true });
const mockAccess = jest.fn().mockResolvedValue(undefined);
const mockReadFile = jest.fn().mockResolvedValue('describe("test", () => { it("works", () => {}) });');

// Mock 'glob' with a simple jest.fn to avoid recursion
jest.mock('glob', () => ({ glob: jest.fn() }));
const { glob } = require('glob');
const mockGlob = glob as jest.Mock;

// Re-export mocks for use in tests (if imported elsewhere)
export { mockStat, mockAccess, mockReadFile, mockGlob };

describe('TestFileRegistry', () => {
  let registry: TestFileRegistry;
  const mockRootPath = '/mock/project';

  beforeEach(() => {
    registry = new TestFileRegistry(mockRootPath);
    jest.clearAllMocks();
    // Spy on fs.promises
    jest.spyOn(fs.promises, 'stat').mockImplementation(mockStat as any);
    jest.spyOn(fs.promises, 'access').mockImplementation(mockAccess as any);
    jest.spyOn(fs.promises, 'readFile').mockImplementation(mockReadFile as any);

    mockStat.mockResolvedValue({ size: 123, mtime: new Date(), isFile: () => true });
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('describe("test", () => { it("works", () => {}) });');
  });

  describe('discoverTestFiles', () => {
    it('should discover test files in the project', async () => {
      const mockFiles = ['src/components/Button.test.tsx'];
      
      // Mock implementation to return our test files for any pattern
      mockGlob.mockImplementation((pattern, options) => {
        // Return mock files for any pattern that matches our test file
        if (pattern.endsWith('.test.ts') || pattern.includes('__tests__')) {
          return Promise.resolve(mockFiles);
        }
        return Promise.resolve([]);
      });
      
      const result = await registry.discoverTestFiles();
      
      // Verify glob was called with the expected patterns
      const expectedPatterns = [
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
      
      // Verify glob was called with all expected patterns
      expectedPatterns.forEach(pattern => {
        expect(mockGlob).toHaveBeenCalledWith(
          pattern,
          expect.objectContaining({
            cwd: mockRootPath,
            ignore: expect.any(Array) // The actual implementation includes ignore patterns
          })
        );
      });
      
      // Verify the result contains our test files in the unit category
      expect(result.unit).toEqual(expect.arrayContaining(mockFiles));
      
      // Verify no other categories have files
      expect(result.integration).toHaveLength(0);
      expect(result.e2e).toHaveLength(0);
      expect(result.orphaned).toHaveLength(0);
    });
  });

  describe('categorizeTestFiles', () => {
    it('should categorize unit tests correctly', () => {
      const files = ['src/components/Button.test.tsx'];
      const result = registry.categorizeTestFiles(files);
      expect(result.unit).toHaveLength(1);
    });
    
    it('should categorize integration tests correctly', () => {
      const files = ['src/__tests__/integration/api.test.ts'];
      const result = registry.categorizeTestFiles(files);
      expect(result.integration).toHaveLength(1);
    });
  });
});
