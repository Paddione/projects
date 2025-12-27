import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

jest.unstable_mockModule('fs', () => ({
    promises: {
        readFile: jest.fn(),
    },
    existsSync: jest.fn(),
}));

// Dynamic imports are required after unstable_mockModule
import type { CoverageAnalyzer as CoverageAnalyzerType } from "../../src/coverage-analyzer.js";
const { CoverageAnalyzer } = await import("../../src/coverage-analyzer.js");
const fs = await import("fs");

describe("CoverageAnalyzer", () => {
    let analyzer: CoverageAnalyzerType;
    const mockRootPath = "/test/repo";

    const mockedExistsSync = fs.existsSync as unknown as jest.Mock<any>;
    const mockedReadFile = fs.promises.readFile as unknown as jest.Mock<any>;

    beforeEach(() => {
        analyzer = new CoverageAnalyzer(mockRootPath);
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should return empty report when no coverage files exist", async () => {
        mockedExistsSync.mockReturnValue(false);

        const report = await analyzer.analyze();

        expect(report.hasCoverage).toBe(false);
        expect(report.summary.lines.total).toBe(0);
        expect(mockedExistsSync).toHaveBeenCalled();
    });

    it("should parse Istanbul JSON coverage format", async () => {
        mockedExistsSync.mockImplementation(((path: any) => path.endsWith("coverage-summary.json")) as any);

        const mockCoverageData = {
            total: {
                lines: { total: 100, covered: 79, pct: 79 },
                statements: { total: 100, covered: 80, pct: 80 },
                functions: { total: 50, covered: 40, pct: 80 },
                branches: { total: 20, covered: 10, pct: 50 }
            },
            "/test/repo/src/file1.ts": {
                lines: { total: 50, covered: 50, pct: 100 },
                statements: { total: 50, covered: 50, pct: 100 },
                functions: { total: 25, covered: 25, pct: 100 },
                branches: { total: 10, covered: 10, pct: 100 }
            },
            "/test/repo/src/file2.ts": {
                lines: { total: 50, covered: 29, pct: 58 },
                statements: { total: 50, covered: 30, pct: 60 },
                functions: { total: 25, covered: 15, pct: 60 },
                branches: { total: 10, covered: 0, pct: 0 }
            }
        };

        mockedReadFile.mockResolvedValue(JSON.stringify(mockCoverageData));

        const report = await analyzer.analyze();

        expect(report.hasCoverage).toBe(true);
        expect(report.summary.lines.percentage).toBe(79);
        expect(report.filesCoverage).toHaveLength(2);
        // file2 has lower coverage, checks suggestions
        expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it("should parse LCOV coverage format", async () => {
        mockedExistsSync.mockImplementation(((path: any) => path.endsWith("lcov.info")) as any);

        // We use path.join manually or just hardcode for string equality check in mock
        // Since we are mocking everything, we can just assume strings match
        const mockLcovContent = `
SF:${mockRootPath}/src/index.ts
FNF:10
FNH:8
BRF:5
BRH:5
LF:100
LH:85
end_of_record
SF:${mockRootPath}/src/utils.ts
FNF:2
FNH:0
BRF:2
BRH:0
LF:20
LH:0
end_of_record
`;

        mockedReadFile.mockResolvedValue(mockLcovContent);

        const report = await analyzer.analyze();

        expect(report.hasCoverage).toBe(true);
        expect(report.summary.lines.total).toBe(120);
        expect(report.summary.lines.covered).toBe(85);
        expect(report.untestedFiles).toContain("src/utils.ts");
    });

    it("should handle error during parsing", async () => {
        mockedExistsSync.mockReturnValue(true);
        mockedReadFile.mockRejectedValue(new Error("Read error"));

        const report = await analyzer.analyze();

        expect(report.hasCoverage).toBe(false);
    });
});
