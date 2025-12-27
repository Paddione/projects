import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { PRCommentGenerator } from '../../src/pr-comment-generator.js';

describe("PRCommentGenerator", () => {
    let generator: PRCommentGenerator;

    const mockAnalysisResult: any = {
        score: 85,
        structure: {
            totalFiles: 10,
            totalSize: 1024,
            filesByExtension: { ".ts": 10 }
        },
        issues: [
            { severity: "error", category: "security", message: "Critical issue", file: "src/bad.ts" },
            { severity: "warning", category: "style", message: "Style issue" }
        ],
        suggestions: [
            { priority: "high", title: "Fix security", description: "Do it now" },
            { priority: "medium", title: "Improve style", description: "Make it pretty" }
        ]
    };

    const mockGitAnalysis: any = {
        isGitRepository: true,
        totalCommits: 100,
        authors: [{ name: "Dev", commits: 10 }],
        hotSpots: [{ file: "src/busy.ts", changeCount: 5 }],
        commitMessageQuality: { score: 90, goodPractices: 90, totalMessages: 100, issues: [] }
    };

    const mockVulnerabilities: any = {
        hasVulnerabilities: true,
        summary: { total: 2, critical: 1, high: 0, moderate: 1, low: 0, info: 0 },
        vulnerabilities: [
            { severity: "critical", name: "bad-lib", title: "RCE", version: "1.0.0" }
        ]
    };

    const mockCoverage: any = {
        hasCoverage: true,
        summary: {
            lines: { percentage: 80, covered: 80, total: 100 },
            functions: { percentage: 90, covered: 90, total: 100 },
            branches: { percentage: 70, covered: 70, total: 100 }
        },
        untestedFiles: ["src/untested.ts"]
    };

    const mockRuleViolations: any = {
        summary: { total: 1, errors: 1 },
        violations: [
            { severity: "error", ruleName: "No Console", file: "src/log.ts", message: "Remove console.log" }
        ]
    };

    beforeEach(() => {
        generator = new PRCommentGenerator();
    });

    it("should generate a basic report with default options", () => {
        const comment = generator.generate(mockAnalysisResult);
        expect(comment).toContain("Repository Analysis Report");
        expect(comment).toContain("Overall Score: 85/100");
        expect(comment).toContain("Summary");
        expect(comment).toContain("**Issues Found**: 2");
    });

    it("should include specific sections when data is provided", () => {
        const comment = generator.generate(
            mockAnalysisResult,
            mockGitAnalysis,
            mockVulnerabilities,
            mockCoverage,
            mockRuleViolations
        );

        expect(comment).toContain("Git Analysis");
        expect(comment).toContain("Security Vulnerabilities");
        expect(comment).toContain("Test Coverage");
        expect(comment).toContain("Rule Violations");

        expect(comment).toContain("Fix security"); // Suggestion
        expect(comment).toContain("Critical issue"); // Issue
        expect(comment).toContain("bad-lib"); // Vulnerability
        expect(comment).toContain("80%"); // Coverage
    });

    it("should respect options to exclude sections", () => {
        const comment = generator.generate(
            mockAnalysisResult,
            undefined,
            undefined,
            undefined,
            undefined,
            { includeScore: false, includeDetails: false }
        );

        expect(comment).not.toContain("Overall Score");
        expect(comment).not.toContain("Repository Structure"); // Details
    });

    it("should format markdown correctly for GitHub", () => {
        const comment = generator.generate(mockAnalysisResult, undefined, undefined, undefined, undefined, { format: "github" });
        // Basic check for markdown headers
        expect(comment).toContain("# ✅ Repository Analysis Report");
    });

    it("should respect maxIssues and maxSuggestions limits", () => {
        const manyIssues = Array(20).fill({ severity: "warning", category: "limit", message: "Problem" });
        const analysisWithManyIssues = { ...mockAnalysisResult, issues: manyIssues };

        const comment = generator.generate(analysisWithManyIssues, undefined, undefined, undefined, undefined, { maxIssues: 3 });

        const issueLines = comment.split('\n').filter(l => l.includes('Problem'));
        expect(issueLines.length).toBe(3);
        expect(comment).toContain("17 more issues");
    });

    it("should handle mixed severity vulnerability report", () => {
        const mixedVulns = {
            hasVulnerabilities: true,
            summary: { total: 4, critical: 1, high: 1, moderate: 1, low: 1, info: 0 },
            vulnerabilities: [
                { severity: "critical", name: "v1", title: "T1", version: "1", description: "D", fixAvailable: true, cves: [] },
                { severity: "high", name: "v2", title: "T2", version: "1", description: "D", fixAvailable: true, cves: [] },
                { severity: "moderate", name: "v3", title: "T3", version: "1", description: "D", fixAvailable: true, cves: [] },
                { severity: "low", name: "v4", title: "T4", version: "1", description: "D", fixAvailable: true, cves: [] },
            ],
            outdatedDependencies: []
        } as any;
        const comment = generator.generate(mockAnalysisResult, undefined, mixedVulns);
        expect(comment).toContain("Critical: 1");
        expect(comment).toContain("High: 1");
        expect(comment).toContain("Moderate: 1");
        expect(comment).toContain("Low: 1");
    });

    it("should handle empty structure case", () => {
        const emptyResult = {
            ...mockAnalysisResult,
            structure: { totalFiles: 0, totalSize: 0, filesByExtension: {} }
        };
        const comment = generator.generate(emptyResult);
        expect(comment).toContain("0 Bytes");
    });
});
