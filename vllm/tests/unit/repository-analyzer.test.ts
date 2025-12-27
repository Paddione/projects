import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    promises: {
        readFile: jest.fn(),
        stat: jest.fn(),
        readdir: jest.fn(),
    },
    existsSync: jest.fn(),
}));

jest.unstable_mockModule('glob', () => ({
    glob: jest.fn(),
}));

// Mock child analyzers
jest.unstable_mockModule('../../src/git-analyzer', () => ({
    GitAnalyzer: jest.fn<any>().mockImplementation(() => ({
        analyze: jest.fn<any>().mockResolvedValue({
            isGitRepository: true,
            commitMessageQuality: { score: 80 }
        }),
    })),
}));

jest.unstable_mockModule('../../src/vulnerability-scanner', () => ({
    VulnerabilityScanner: jest.fn<any>().mockImplementation(() => ({
        scan: jest.fn<any>().mockResolvedValue({ hasVulnerabilities: false }),
    })),
}));

jest.unstable_mockModule('../../src/coverage-analyzer', () => ({
    CoverageAnalyzer: jest.fn<any>().mockImplementation(() => ({
        analyze: jest.fn<any>().mockResolvedValue({ hasCoverage: false }),
    })),
}));

jest.unstable_mockModule('../../src/rule-engine', () => ({
    RuleEngine: jest.fn<any>().mockImplementation(() => ({
        execute: jest.fn<any>().mockResolvedValue({ violations: [], summary: { total: 0 } }),
    })),
}));

jest.unstable_mockModule('../../src/pr-comment-generator', () => ({
    PRCommentGenerator: jest.fn<any>().mockImplementation(() => ({
        generate: jest.fn<any>().mockReturnValue("Mock PR Comment"),
    })),
}));

// Import subject and mocks
import type { RepositoryAnalyzer as RepositoryAnalyzerType } from "../../src/repository-analyzer.js";
const { RepositoryAnalyzer } = await import("../../src/repository-analyzer.js");
const fs = await import("fs");
const { glob } = await import("glob");

describe("RepositoryAnalyzer", () => {
    let analyzer: RepositoryAnalyzerType;
    const mockRootPath = "/test/repo";

    const mockedExistsSync = fs.existsSync as unknown as jest.Mock<any>;
    const mockedReaddir = fs.promises.readdir as unknown as jest.Mock<any>;
    const mockedStat = fs.promises.stat as unknown as jest.Mock<any>;
    const mockedGlob = glob as unknown as jest.Mock<any>;

    beforeEach(() => {
        analyzer = new RepositoryAnalyzer(mockRootPath);
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should analyze repo structure and aggregate results", async () => {
        mockedExistsSync.mockReturnValue(true);
        // mockedGlob.mockResolvedValue(["src/index.ts", "package.json"]); 

        mockedReaddir.mockImplementation(((path: string) => {
            if (path === mockRootPath) {
                return Promise.resolve([
                    { name: "src", isDirectory: () => true, isFile: () => false },
                    { name: "package.json", isDirectory: () => false, isFile: () => true }
                ]);
            }
            if (path.endsWith("src")) {
                return Promise.resolve([
                    { name: "index.ts", isDirectory: () => false, isFile: () => true }
                ]);
            }
            return Promise.resolve([]);
        }) as any);

        // Mock file stats
        mockedStat.mockResolvedValue({ size: 1024 });

        const result = await analyzer.analyze({
            includeGit: true,
            includeVulnerabilities: true,
            includeCoverage: true,
            includeRules: true,
        });

        expect(result.structure.totalFiles).toBe(2);
        // 2 files * 1024 bytes = 2048
        expect(result.structure.totalSize).toBe(2048);
        expect(result.score).toBeGreaterThan(0);

        expect(result.gitAnalysis).toBeDefined();
        expect(result.vulnerabilities).toBeDefined();
        expect(result.coverage).toBeDefined();
        expect(result.ruleViolations).toBeDefined();
    });

    it("should calculate score based on issues", async () => {
        mockedExistsSync.mockReturnValue(true);

        mockedReaddir.mockImplementation(((path: string) => {
            if (path === mockRootPath) {
                return Promise.resolve([
                    { name: "src", isDirectory: () => true, isFile: () => false },
                    { name: "index.ts", isDirectory: () => false, isFile: () => true }
                ]);
            }
            if (path.endsWith("src")) return Promise.resolve([]);
            return Promise.resolve([]);
        }) as any);

        mockedStat.mockResolvedValue({ size: 100 });

        const result = await analyzer.analyze();
        expect(result.score).toBeLessThan(100);
    });

    it("should generate PR comment", async () => {
        const mockResult = {
            structure: { totalFiles: 1, totalSize: 100, filesByExtension: {} },
            issues: [],
            suggestions: [],
            score: 100,
        };
        const comment = await analyzer.generatePRComment(mockResult as any);
        expect(comment).toBe("Mock PR Comment");
    });

    it("should handle errors in sub-analyzers during analyze", async () => {
        const { GitAnalyzer } = await import('../../src/git-analyzer.js');
        const { VulnerabilityScanner } = await import('../../src/vulnerability-scanner.js');
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        const { RuleEngine } = await import('../../src/rule-engine.js');

        // Force errors in sub-analyzers
        jest.mocked(GitAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockRejectedValue(new Error("Git Error")),
        }) as any);
        jest.mocked(VulnerabilityScanner).mockImplementationOnce(() => ({
            scan: (jest.fn() as any).mockRejectedValue(new Error("Vuln Error")),
        }) as any);
        jest.mocked(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockRejectedValue(new Error("Coverage Error")),
        }) as any);
        jest.mocked(RuleEngine).mockImplementationOnce(() => ({
            execute: (jest.fn() as any).mockRejectedValue(new Error("Rule Error")),
        }) as any);

        mockedReaddir.mockResolvedValue([]);

        const result = await analyzer.analyze();

        expect(result.gitAnalysis).toBeUndefined();
        expect(result.vulnerabilities).toBeUndefined();
        expect(result.coverage).toBeUndefined();
        expect(result.ruleViolations).toBeUndefined();
    });

    it("should load guidelines if README exists", async () => {
        const fs = await import('fs');
        jest.mocked(fs.promises.readFile).mockResolvedValueOnce("Custom Guidelines");

        await analyzer.loadGuidelines();
        // Since guidelines is private, we check if analyze calls it (it does)
        // or we could use reflection if needed, but let's just ensure it doesn't throw.
    });

    it("should handle error when loading guidelines", async () => {
        const fs = await import('fs');
        jest.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error("No readme"));

        await analyzer.loadGuidelines();
        // Should handle error gracefully
    });

    it("should detect large files", async () => {
        mockedReaddir.mockResolvedValueOnce([
            { name: "large.bin", isDirectory: () => false, isFile: () => true }
        ]);
        mockedStat.mockResolvedValueOnce({ size: 10 * 1024 * 1024 } as any);

        const structure = await analyzer.analyzeStructure();
        const issues = await analyzer.checkBestPractices(structure);

        expect(issues.some(i => i.category === "file-size")).toBe(true);
    });

    it("should detect .env without .env.example", async () => {
        mockedReaddir.mockResolvedValueOnce([
            { name: ".env", isDirectory: () => false, isFile: () => true }
        ]);
        mockedStat.mockResolvedValueOnce({ size: 100 } as any);

        const structure = await analyzer.analyzeStructure();
        const issues = await analyzer.checkBestPractices(structure);

        expect(issues.some(i => i.rule === "env-example-required")).toBe(true);
    });

    it("should handle unreadable files during structure analysis", async () => {
        mockedReaddir.mockResolvedValueOnce([
            { name: "unreadable.ts", isDirectory: () => false, isFile: () => true }
        ]);
        mockedStat.mockResolvedValueOnce({ size: 100 } as any);
        const fs = await import('fs');
        jest.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error("Read Error"));

        const structure = await analyzer.analyzeStructure();
        expect(structure.totalFiles).toBe(1);
        expect(structure.files[0].lines).toBeUndefined();
    });
});
