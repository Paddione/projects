/**
 * Tests for CoverageReporter class
 */

import * as fs from 'fs';
import * as path from 'path';
import { CoverageReporter, CoverageReportOptions } from '../CoverageReporter';
import { CoverageReport, CoverageMetrics } from '../TestRunner';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('CoverageReporter', () => {
  let coverageReporter: CoverageReporter;
  let mockCoverageData: CoverageReport[];
  let tempDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = '/tmp/test-coverage';
    coverageReporter = new CoverageReporter(tempDir);

    // Mock fs.existsSync to return false for directories (they don't exist yet)
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => undefined);
    mockFs.writeFileSync.mockImplementation(() => undefined);
    mockFs.readFileSync.mockImplementation(() => '[]');

    // Create mock coverage data
    const mockMetrics: CoverageMetrics = {
      statements: { covered: 80, total: 100, percentage: 80 },
      branches: { covered: 75, total: 100, percentage: 75 },
      functions: { covered: 90, total: 100, percentage: 90 },
      lines: { covered: 85, total: 100, percentage: 85 }
    };

    mockCoverageData = [{
      overall: mockMetrics,
      byFile: new Map([
        ['src/utils.ts', mockMetrics],
        ['src/service.ts', { ...mockMetrics, lines: { covered: 70, total: 100, percentage: 70 } }]
      ]),
      byDirectory: new Map([
        ['src', mockMetrics]
      ]),
      uncoveredLines: [
        { file: 'src/utils.ts', line: 42, type: 'statement' },
        { file: 'src/service.ts', line: 15, type: 'branch' }
      ],
      thresholdsMet: true
    }];
  });

  describe('constructor', () => {
    it('should create output directory if it does not exist', () => {
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(tempDir, { recursive: true });
    });

    it('should use default output directory if none provided', () => {
      const reporter = new CoverageReporter();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('coverage-reports', { recursive: true });
    });
  });

  describe('generateReport', () => {
    const defaultOptions: CoverageReportOptions = {
      outputDir: tempDir,
      formats: ['html', 'json'],
      includeHistorical: false,
      includeUncovered: true,
      includeFileDetails: true
    };

    it('should generate reports in all requested formats', async () => {
      const reportPaths = await coverageReporter.generateReport(mockCoverageData, defaultOptions);

      expect(reportPaths).toHaveLength(2);
      expect(reportPaths.some(path => path.includes('coverage-report.html'))).toBe(true);
      expect(reportPaths.some(path => path.includes('coverage-report.json'))).toBe(true);
    });

    it('should handle single coverage report', async () => {
      const reportPaths = await coverageReporter.generateReport(mockCoverageData, defaultOptions);

      expect(reportPaths.length).toBeGreaterThan(0);
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should apply exclusion patterns when provided', async () => {
      const optionsWithExclusions: CoverageReportOptions = {
        ...defaultOptions,
        excludePatterns: ['**/*.test.ts', '**/node_modules/**']
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, optionsWithExclusions);

      expect(reportPaths.length).toBeGreaterThan(0);
    });

    it('should include historical data when requested', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify([
        {
          timestamp: new Date('2023-01-01').toISOString(),
          coverage: mockCoverageData[0]!.overall,
          testCount: 100
        }
      ]));

      const optionsWithHistorical: CoverageReportOptions = {
        ...defaultOptions,
        includeHistorical: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, optionsWithHistorical);

      expect(reportPaths.length).toBeGreaterThan(0);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    it('should handle empty coverage data gracefully', async () => {
      await expect(coverageReporter.generateReport([], defaultOptions))
        .rejects.toThrow('No coverage data provided');
    });
  });

  describe('checkThresholds', () => {
    it('should pass when all thresholds are met', () => {
      const thresholds = {
        statements: 70,
        branches: 70,
        functions: 80,
        lines: 80
      };

      const result = coverageReporter.checkThresholds(mockCoverageData[0]!, thresholds);

      expect(result.met).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.summary).toContain('All coverage thresholds met');
    });

    it('should fail when thresholds are not met', () => {
      const thresholds = {
        statements: 90,
        branches: 90,
        functions: 95,
        lines: 95
      };

      const result = coverageReporter.checkThresholds(mockCoverageData[0]!, thresholds);

      expect(result.met).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
      expect(result.summary).toContain('threshold(s) failed');
    });

    it('should provide detailed failure information', () => {
      const thresholds = {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90
      };

      const result = coverageReporter.checkThresholds(mockCoverageData[0]!, thresholds);

      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metric: 'statements',
            actual: 80,
            expected: 90,
            difference: 10
          }),
          expect.objectContaining({
            metric: 'functions',
            actual: 90,
            expected: 95,
            difference: 5
          }),
          expect.objectContaining({
            metric: 'lines',
            actual: 85,
            expected: 90,
            difference: 5
          })
        ])
      );
    });
  });

  describe('exportFormats', () => {
    it('should export coverage in multiple formats', async () => {
      const formats = ['html', 'json', 'lcov', 'xml'] as const;
      
      const exports = await coverageReporter.exportFormats(
        mockCoverageData[0]!,
        [...formats],
        tempDir
      );

      expect(Object.keys(exports)).toHaveLength(4);
      expect(exports.html).toContain('coverage-report.html');
      expect(exports.json).toContain('coverage-report.json');
      expect(exports.lcov).toContain('lcov.info');
      expect(exports.xml).toContain('coverage-report.xml');
    });

    it('should handle unsupported formats gracefully', async () => {
      // This should be caught by TypeScript, but test runtime behavior
      const formats = ['unsupported'] as any;
      
      await expect(coverageReporter.exportFormats(mockCoverageData[0]!, formats))
        .rejects.toThrow('Unsupported coverage report format');
    });
  });

  describe('aggregateCoverageData', () => {
    it('should return single report when only one provided', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['json'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport([mockCoverageData[0]!], options);
      expect(reportPaths.length).toBe(1);
    });

    it('should aggregate multiple coverage reports correctly', async () => {
      const secondReport: CoverageReport = {
        overall: {
          statements: { covered: 60, total: 80, percentage: 75 },
          branches: { covered: 50, total: 80, percentage: 62.5 },
          functions: { covered: 70, total: 80, percentage: 87.5 },
          lines: { covered: 65, total: 80, percentage: 81.25 }
        },
        byFile: new Map([
          ['src/another.ts', {
            statements: { covered: 60, total: 80, percentage: 75 },
            branches: { covered: 50, total: 80, percentage: 62.5 },
            functions: { covered: 70, total: 80, percentage: 87.5 },
            lines: { covered: 65, total: 80, percentage: 81.25 }
          }]
        ]),
        byDirectory: new Map(),
        uncoveredLines: [
          { file: 'src/another.ts', line: 10, type: 'statement' }
        ],
        thresholdsMet: false
      };

      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['json'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport([mockCoverageData[0]!, secondReport], options);
      expect(reportPaths.length).toBe(1);

      // Verify that writeFileSync was called with aggregated data
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('coverage-report.json')
      );
      expect(writeCall).toBeDefined();
      
      if (writeCall) {
        const writtenData = JSON.parse(writeCall[1] as string);
        // Check that data was aggregated (total lines should be 180)
        expect(writtenData.overall.lines.total).toBe(180);
        expect(writtenData.overall.lines.covered).toBe(150);
      }
    });
  });

  describe('HTML report generation', () => {
    it('should generate valid HTML report', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['html'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      expect(reportPaths).toHaveLength(1);
      expect(reportPaths[0]).toContain('coverage-report.html');

      const htmlWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('coverage-report.html')
      );
      expect(htmlWriteCall).toBeDefined();
      
      if (htmlWriteCall) {
        const htmlContent = htmlWriteCall[1] as string;
        expect(htmlContent).toContain('<!DOCTYPE html>');
        expect(htmlContent).toContain('Coverage Report');
        expect(htmlContent).toContain('85.0%'); // Lines coverage
        expect(htmlContent).toContain('src/utils.ts');
        expect(htmlContent).toContain('Uncovered Lines');
      }
    });

    it('should include threshold information in HTML report', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['html'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true,
        thresholds: {
          statements: 90,
          branches: 80,
          functions: 95,
          lines: 90
        }
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      const htmlWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('coverage-report.html')
      );
      
      if (htmlWriteCall) {
        const htmlContent = htmlWriteCall[1] as string;
        expect(htmlContent).toContain('Coverage Thresholds');
        expect(htmlContent).toContain('threshold-status');
      }
    });
  });

  describe('LCOV report generation', () => {
    it('should generate valid LCOV report', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['lcov'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      expect(reportPaths).toHaveLength(1);
      expect(reportPaths[0]).toContain('lcov.info');

      const lcovWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('lcov.info')
      );
      expect(lcovWriteCall).toBeDefined();
      
      if (lcovWriteCall) {
        const lcovContent = lcovWriteCall[1] as string;
        expect(lcovContent).toContain('SF:src/utils.ts');
        expect(lcovContent).toContain('LF:100');
        expect(lcovContent).toContain('LH:85');
        expect(lcovContent).toContain('end_of_record');
      }
    });
  });

  describe('Badge generation', () => {
    it('should generate coverage badge SVG', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['badge'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      expect(reportPaths).toHaveLength(1);
      expect(reportPaths[0]).toContain('coverage-badge.svg');

      const badgeWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('coverage-badge.svg')
      );
      expect(badgeWriteCall).toBeDefined();
      
      if (badgeWriteCall) {
        const svgContent = badgeWriteCall[1] as string;
        expect(svgContent).toContain('<svg');
        expect(svgContent).toContain('coverage');
        expect(svgContent).toContain('85.0%');
      }
    });
  });

  describe('Historical data handling', () => {
    it('should save historical data when includeHistorical is true', async () => {
      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['json'],
        includeHistorical: true,
        includeUncovered: true,
        includeFileDetails: true
      };

      await coverageReporter.generateReport(mockCoverageData, options);

      const historicalWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('historical-coverage.json')
      );
      expect(historicalWriteCall).toBeDefined();
    });

    it('should calculate trends when historical data exists', async () => {
      const existingHistoricalData = [
        {
          timestamp: new Date('2023-01-01').toISOString(),
          coverage: {
            statements: { covered: 70, total: 100, percentage: 70 },
            branches: { covered: 65, total: 100, percentage: 65 },
            functions: { covered: 80, total: 100, percentage: 80 },
            lines: { covered: 75, total: 100, percentage: 75 }
          },
          testCount: 100
        }
      ];

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(existingHistoricalData));

      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['html'],
        includeHistorical: true,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      const htmlWriteCall = mockFs.writeFileSync.mock.calls.find(call => 
        call[0].toString().includes('coverage-report.html')
      );
      
      if (htmlWriteCall) {
        const htmlContent = htmlWriteCall[1] as string;
        expect(htmlContent).toContain('Trends');
        expect(htmlContent).toContain('improving'); // Coverage should be improving
      }
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['html'],
        includeHistorical: false,
        includeUncovered: true,
        includeFileDetails: true
      };

      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);

      // Should return empty array when all formats fail
      expect(reportPaths).toHaveLength(0);
    });

    it('should handle malformed historical data', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');

      const options: CoverageReportOptions = {
        outputDir: tempDir,
        formats: ['json'],
        includeHistorical: true,
        includeUncovered: true,
        includeFileDetails: true
      };

      // Should not throw error, just log warning
      const reportPaths = await coverageReporter.generateReport(mockCoverageData, options);
      expect(reportPaths.length).toBeGreaterThan(0);
    });
  });
});