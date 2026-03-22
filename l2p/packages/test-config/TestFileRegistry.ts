import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface TestFileMap {
  unit: string[];
  integration: string[];
  e2e: string[];
  performance: string[];
  accessibility: string[];
  cli: string[];
  orphaned: string[];
}

export interface TestCategories {
  unit: TestFileInfo[];
  integration: TestFileInfo[];
  e2e: TestFileInfo[];
  performance: TestFileInfo[];
  accessibility: TestFileInfo[];
  cli: TestFileInfo[];
  orphaned: TestFileInfo[];
}

export interface TestFileInfo {
  path: string;
  relativePath: string;
  type: TestType;
  runner: TestRunner;
  valid: boolean;
  errors: string[];
  size: number;
  lastModified: Date;
}

export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility' | 'cli' | 'orphaned';
export type TestRunner = 'jest' | 'playwright' | 'custom' | 'unknown';

export interface ValidationResult {
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestInventoryReport {
  summary: {
    totalFiles: number;
    byType: Record<TestType, number>;
    byRunner: Record<TestRunner, number>;
    validFiles: number;
    invalidFiles: number;
  };
  categories: TestCategories;
  duplicates: string[][];
  orphaned: TestFileInfo[];
  recommendations: string[];
}

export class TestFileRegistry {
  private rootPath: string;
  private excludePatterns: string[];
  private maxConcurrency: number;

  constructor(rootPath: string = process.cwd(), options?: { maxConcurrency?: number; excludePatterns?: string[] }) {
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
      '**/.nuxt/**',
      // Additional common heavy directories to skip
      '**/.cache/**',
      '**/.turbo/**',
      '**/.parcel-cache/**',
      '**/.svelte-kit/**',
      '**/storybook-static/**',
      '**/.angular/**',
      '**/out/**',
      '**/tmp/**'
    ];

    if (options?.excludePatterns?.length) {
      this.excludePatterns.push(...options.excludePatterns);
    }

    const envConcurrency = process.env.TEST_SCANNER_MAX_CONCURRENCY ? parseInt(process.env.TEST_SCANNER_MAX_CONCURRENCY, 10) : undefined;
    this.maxConcurrency = options?.maxConcurrency ?? envConcurrency ?? 16;
  }

  /**
   * Discover all test files in the repository
   */
  async discoverTestFiles(): Promise<TestFileMap> {
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

    const globOptions = {
      cwd: this.rootPath,
      ignore: this.excludePatterns,
      nodir: true
    } as const;

    const results = await Promise.all(patterns.map(pattern =>
      glob(pattern, globOptions).catch(error => {
        console.warn(`Error scanning pattern ${pattern}:`, error);
        return [] as string[];
      })
    ));

    // De-duplicate across patterns while avoiding unnecessary array churn
    const uniqueFiles = Array.from(new Set(results.flat()));

    return this.categorizeTestFiles(uniqueFiles);
  }

  /**
   * Categorize test files by type
   */
  categorizeTestFiles(files: string[]): TestFileMap {
    const categories: TestFileMap = {
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
  private determineTestCategory(filePath: string): TestType {
    const normalizedPath = filePath.toLowerCase();

    // Common helpers
    const hasTestPattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(normalizedPath);
    const isCyTest = /\.cy\.(ts|tsx|js|jsx)$/.test(normalizedPath);
    const inE2EDir = normalizedPath.includes('/e2e/') || normalizedPath.includes('\\e2e\\') || normalizedPath.startsWith('e2e/');
    const mentionsE2ERunner = normalizedPath.includes('playwright') || normalizedPath.includes('cypress');
    const inIntegrationDir = normalizedPath.includes('/integration/') || normalizedPath.includes('\\integration\\');
    const inUnitDir = normalizedPath.includes('/unit/') || normalizedPath.includes('\\unit\\');
    const inTestsDir = normalizedPath.includes('__tests__');

    // E2E tests: check this first as it's most specific
    if (isCyTest || (inE2EDir && hasTestPattern) || (mentionsE2ERunner && hasTestPattern)) {
      return 'e2e';
    }

    // CLI tests (folder-driven; may not have .test/.spec)
    if (normalizedPath.includes('/cli/') || normalizedPath.includes('\\cli\\')) {
      return 'cli';
    }

    // Performance tests (require test-like naming)
    if ((normalizedPath.includes('/performance/') || normalizedPath.includes('\\performance\\') ||
         normalizedPath.includes('load-test') || normalizedPath.includes('perf-test')) && (hasTestPattern || isCyTest)) {
      return 'performance';
    }

    // Accessibility tests (require test-like naming)
    if ((normalizedPath.includes('/accessibility/') || normalizedPath.includes('\\accessibility\\') ||
         normalizedPath.includes('a11y') || normalizedPath.includes('axe')) && (hasTestPattern || isCyTest)) {
      return 'accessibility';
    }

    // Integration tests: only when in integration context AND has test pattern, or explicit api.test/spec, or db.test/spec
    if ((inIntegrationDir && hasTestPattern) || 
        normalizedPath.includes('api.test') || normalizedPath.includes('api.spec') ||
        normalizedPath.includes('db.test') || normalizedPath.includes('db.spec')) {
      return 'integration';
    }

    // Unit tests: include files in __tests__ directories even without test patterns,
    // or files with test patterns that aren't in specific other categories
    if ((inUnitDir) || 
        (inTestsDir && !inE2EDir && !inIntegrationDir) || 
        (hasTestPattern && !inE2EDir && !mentionsE2ERunner && !inIntegrationDir)) {
      return 'unit';
    }

    // Files without test patterns or in unrecognized locations are orphaned
    return 'orphaned';
  }

  /**
   * Get detailed information about test files
   */
  async categorizeTests(files: string[]): Promise<TestCategories> {
    const categories: TestCategories = {
      unit: [],
      integration: [],
      e2e: [],
      performance: [],
      accessibility: [],
      cli: [],
      orphaned: []
    };

    const testInfos = await this.mapWithConcurrency(files, this.maxConcurrency, (file) => this.getTestFileInfo(file));

    for (const testInfo of testInfos) {
      categories[testInfo.type].push(testInfo);
    }

    return categories;
  }

  /**
   * Get detailed information about a test file
   */
  private async getTestFileInfo(filePath: string): Promise<TestFileInfo> {
    const fullPath = path.resolve(this.rootPath, filePath);
    const type = this.determineTestCategory(filePath);
    const runner = this.determineTestRunner(filePath, type);
    
    let stats: fs.Stats;
    let valid = true;
    const errors: string[] = [];

    try {
      stats = await fs.promises.stat(fullPath);
    } catch (error) {
      valid = false;
      errors.push(`File not accessible: ${error}`);
      stats = { size: 0, mtime: new Date() } as fs.Stats;
    }

    // Basic syntax validation
    if (valid) {
      try {
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        if (stats.size === 0 || content.trim().length === 0) {
          valid = false;
          errors.push('File is empty');
        } else {
          // Check for basic test patterns
          if (!this.hasTestPatterns(content)) {
            errors.push('No test patterns found (describe, it, test, etc.)');
          }
        }
      } catch (error) {
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
  private determineTestRunner(filePath: string, type: TestType): TestRunner {
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
  private hasTestPatterns(content: string): boolean {
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
   * Run async mapping with a concurrency limit
   */
  private async mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex++;
        if (currentIndex >= items.length) break;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    };

    const workers: Promise<void>[] = [];
    const workerCount = Math.min(Math.max(1, limit), items.length);
    for (let i = 0; i < workerCount; i++) workers.push(worker());

    await Promise.all(workers);
    return results;
  }

  /**
   * Validate test files for syntax and accessibility
   */
  async validateTestFiles(files: string[]): Promise<ValidationResult[]> {
    return this.mapWithConcurrency(files, this.maxConcurrency, (file) => this.validateTestFile(file));
  }

  /**
   * Validate a single test file
   */
  private async validateTestFile(filePath: string): Promise<ValidationResult> {
    const fullPath = path.resolve(this.rootPath, filePath);
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check if file exists and is readable
      await fs.promises.access(fullPath, fs.constants.R_OK);

      // Prefer stat first to avoid reading empty files
      const stats = await fs.promises.stat(fullPath);

      if (stats.size === 0) {
        errors.push('File is empty');
      } else {
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

    } catch (error) {
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
  async generateInventoryReport(): Promise<TestInventoryReport> {
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
      } as Record<TestType, number>,
      byRunner: {
        jest: 0,
        playwright: 0,
        custom: 0,
        unknown: 0
      } as Record<TestRunner, number>,
      validFiles: 0,
      invalidFiles: 0
    };
    
    // Count by runner and validity
    Object.values(categories).flat().forEach(file => {
      if (file.runner in summary.byRunner) {
        summary.byRunner[file.runner as TestRunner]++;
      }
      if (file.valid) {
        summary.validFiles++;
      } else {
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
  private findDuplicateFiles(files: string[]): string[][] {
    const filesByName = new Map<string, string[]>();
    
    files.forEach((file: string) => {
      const fileName = path.basename(file);
      if (!filesByName.has(fileName)) {
        filesByName.set(fileName, []);
      }
      filesByName.get(fileName)!.push(file);
    });
    
    return Array.from(filesByName.values()).filter(group => group.length > 1);
  }

  /**
   * Generate recommendations for test organization
   */
  private generateRecommendations(categories: TestCategories, duplicates: string[][]): string[] {
    const recommendations: string[] = [];
    
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