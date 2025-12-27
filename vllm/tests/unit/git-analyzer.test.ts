import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import type { GitAnalyzer as GitAnalyzerType } from "../../src/git-analyzer.js";

const mockSimpleGitInstance = {
    status: jest.fn<any>(),
    log: jest.fn<any>(),
    show: jest.fn<any>(),
    branch: jest.fn<any>(),
};

jest.unstable_mockModule('simple-git', () => ({
    simpleGit: jest.fn(() => mockSimpleGitInstance),
}));

const { GitAnalyzer } = await import("../../src/git-analyzer.js");

describe("GitAnalyzer", () => {
    let analyzer: GitAnalyzerType;
    const mockRootPath = "/test/repo";

    beforeEach(() => {
        analyzer = new GitAnalyzer(mockRootPath);
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should handle non-git repositories", async () => {
        mockSimpleGitInstance.status.mockRejectedValue(new Error("Not a git repo"));

        const analysis = await analyzer.analyze();

        expect(analysis.isGitRepository).toBe(false);
        expect(analysis.totalCommits).toBe(0);
    });

    it("should analyze git repository successfully", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});

        // Mock log
        mockSimpleGitInstance.log.mockResolvedValue({
            all: [
                {
                    hash: "hash1",
                    author_name: "User1",
                    author_email: "user1@example.com",
                    date: "2023-01-01T10:00:00Z",
                    message: "feat: initial commit",
                },
                {
                    hash: "hash2",
                    author_name: "User1",
                    author_email: "user1@example.com",
                    date: "2023-01-02T10:00:00Z",
                    message: "fix: bug fix",
                },
                {
                    hash: "hash3",
                    author_name: "User2",
                    author_email: "user2@example.com",
                    date: "2023-01-03T10:00:00Z",
                    message: "chore: update deps",
                },
            ]
        });

        // Mock show (stats)
        mockSimpleGitInstance.show.mockImplementation((args: string[]) => {
            if (args[1] === "--numstat") {
                // filesChanged, insertions, deletions
                return Promise.resolve("10\t5\tsrc/file1.ts\n5\t2\tsrc/file2.ts");
            }
            if (args[1] === "--name-only") {
                return Promise.resolve("src/file1.ts\nsrc/file2.ts");
            }
            return Promise.resolve("");
        });

        // Mock branches
        mockSimpleGitInstance.branch.mockResolvedValue({
            current: "main",
            branches: {
                main: { name: "main", commit: "hash3", label: "main" },
                develop: { name: "develop", commit: "hash2", label: "develop" },
            }
        });

        const analysis = await analyzer.analyze();

        expect(analysis.isGitRepository).toBe(true);
        expect(analysis.totalCommits).toBe(3);
        expect(analysis.authors).toHaveLength(2); // User1, User2
        expect(analysis.branches).toHaveLength(2);

        // Verify author stats
        const user1 = analysis.authors.find(a => a.name === "User1");
        expect(user1).toBeDefined();
        expect(user1?.commits).toBe(2);

        // Verify commit message quality
        expect(analysis.commitMessageQuality.score).toBeGreaterThan(0);
        expect(analysis.commitMessageQuality.goodPractices).toBeGreaterThan(0);
    });

    it("should identify hot spots", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});
        mockSimpleGitInstance.log.mockResolvedValue({
            all: [
                {
                    hash: "hash1",
                    author_name: "User1",
                    author_email: "user1@example.com",
                    date: "2023-01-01T10:00:00Z",
                    message: "update file1",
                },
                {
                    hash: "hash2",
                    author_name: "User2",
                    author_email: "user2@example.com",
                    date: "2023-01-02T10:00:00Z",
                    message: "update file1 again",
                }
            ]
        });

        mockSimpleGitInstance.show.mockImplementation((args: string[]) => {
            if (args[1] === "--name-only") {
                return Promise.resolve("src/file1.ts");
            }
            return Promise.resolve("1\t1\tsrc/file1.ts");
        });

        mockSimpleGitInstance.branch.mockResolvedValue({ branches: {} });

        const analysis = await analyzer.analyze();

        expect(analysis.hotSpots).toHaveLength(1);
        expect(analysis.hotSpots[0].file).toBe("src/file1.ts");
        expect(analysis.hotSpots[0].changeCount).toBe(2);
        expect(analysis.hotSpots[0].authors).toHaveLength(2);
    });

    it("should penalize generic commit messages", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});
        mockSimpleGitInstance.log.mockResolvedValue({
            all: [
                {
                    hash: "hash1",
                    author_name: "User1",
                    author_email: "user1@example.com",
                    date: "2023-01-01T10:00:00Z",
                    message: "fix",
                },
            ]
        });
        mockSimpleGitInstance.show.mockImplementation(() => Promise.resolve("1\t1\tfile.ts"));
        mockSimpleGitInstance.branch.mockResolvedValue({ branches: {} });

        const analysis = await analyzer.analyze();
        expect(analysis.commitMessageQuality.issues).toContain('Generic commit message: "fix"');
    });

    it("should handle error in getCommitHistory", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});
        mockSimpleGitInstance.log.mockRejectedValue(new Error("Log error"));
        mockSimpleGitInstance.branch.mockResolvedValue({ branches: {} });

        const analysis = await analyzer.analyze();
        expect(analysis.totalCommits).toBe(0);
    });

    it("should handle error in show for stats", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});
        mockSimpleGitInstance.log.mockResolvedValue({
            all: [{ hash: "hash1", author_name: "U", author_email: "E", date: "2023", message: "M" }]
        });
        mockSimpleGitInstance.show.mockRejectedValue(new Error("Show error"));
        mockSimpleGitInstance.branch.mockResolvedValue({ branches: {} });

        const analysis = await analyzer.analyze();
        expect(analysis.totalCommits).toBe(1);
        expect(analysis.recentCommits[0].insertions).toBe(0);
    });

    it("should handle error in getBranches", async () => {
        mockSimpleGitInstance.status.mockResolvedValue({});
        mockSimpleGitInstance.log.mockResolvedValue({ all: [] });
        mockSimpleGitInstance.branch.mockRejectedValue(new Error("Branch error"));

        const analysis = await analyzer.analyze();
        expect(analysis.branches).toHaveLength(0);
    });
});
