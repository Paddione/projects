import { simpleGit } from "simple-git";
import type { SimpleGit, LogResult } from "simple-git";
import { join } from "path";

export interface GitAnalysis {
    isGitRepository: boolean;
    totalCommits: number;
    authors: AuthorStats[];
    recentCommits: CommitInfo[];
    hotSpots: FileHotSpot[];
    commitMessageQuality: CommitMessageQuality;
    branches: BranchInfo[];
}

export interface AuthorStats {
    name: string;
    email: string;
    commits: number;
    linesAdded: number;
    linesDeleted: number;
    firstCommit: Date;
    lastCommit: Date;
}

export interface CommitInfo {
    hash: string;
    author: string;
    email: string;
    date: Date;
    message: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
}

export interface FileHotSpot {
    file: string;
    changeCount: number;
    authors: string[];
    lastModified: Date;
}

export interface CommitMessageQuality {
    score: number;
    issues: string[];
    goodPractices: number;
    totalMessages: number;
}

export interface BranchInfo {
    name: string;
    current: boolean;
    lastCommit: Date;
}

export class GitAnalyzer {
    private git: SimpleGit;
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.git = simpleGit(rootPath);
    }

    async analyze(commitLimit: number = 100): Promise<GitAnalysis> {
        const isRepo = await this.isGitRepository();

        if (!isRepo) {
            return {
                isGitRepository: false,
                totalCommits: 0,
                authors: [],
                recentCommits: [],
                hotSpots: [],
                commitMessageQuality: {
                    score: 0,
                    issues: [],
                    goodPractices: 0,
                    totalMessages: 0,
                },
                branches: [],
            };
        }

        const [commits, branches] = await Promise.all([
            this.getCommitHistory(commitLimit),
            this.getBranches(),
        ]);

        const authors = this.analyzeAuthors(commits);
        const hotSpots = await this.identifyHotSpots(commits);
        const commitMessageQuality = this.analyzeCommitMessages(commits);

        return {
            isGitRepository: true,
            totalCommits: commits.length,
            authors,
            recentCommits: commits.slice(0, 20),
            hotSpots,
            commitMessageQuality,
            branches,
        };
    }

    private async isGitRepository(): Promise<boolean> {
        try {
            await this.git.status();
            return true;
        } catch {
            return false;
        }
    }

    private async getCommitHistory(limit: number): Promise<CommitInfo[]> {
        try {
            const log = await this.git.log({ maxCount: limit, "--numstat": null });
            const commits: CommitInfo[] = [];

            for (const commit of log.all) {
                const stats = await this.getCommitStats(commit.hash);
                commits.push({
                    hash: commit.hash,
                    author: commit.author_name,
                    email: commit.author_email,
                    date: new Date(commit.date),
                    message: commit.message,
                    filesChanged: stats.filesChanged,
                    insertions: stats.insertions,
                    deletions: stats.deletions,
                });
            }

            return commits;
        } catch (error) {
            console.error("Error getting commit history:", error);
            return [];
        }
    }

    private async getCommitStats(hash: string): Promise<{
        filesChanged: number;
        insertions: number;
        deletions: number;
    }> {
        try {
            const diff = await this.git.show([hash, "--numstat", "--format="]);
            const lines = diff.split("\n").filter((line) => line.trim());

            let insertions = 0;
            let deletions = 0;
            let filesChanged = 0;

            for (const line of lines) {
                const parts = line.split("\t");
                if (parts.length >= 2) {
                    const added = parseInt(parts[0]) || 0;
                    const deleted = parseInt(parts[1]) || 0;
                    insertions += added;
                    deletions += deleted;
                    filesChanged++;
                }
            }

            return { filesChanged, insertions, deletions };
        } catch {
            return { filesChanged: 0, insertions: 0, deletions: 0 };
        }
    }

    private analyzeAuthors(commits: CommitInfo[]): AuthorStats[] {
        const authorMap = new Map<string, AuthorStats>();

        for (const commit of commits) {
            const key = commit.email;

            if (!authorMap.has(key)) {
                authorMap.set(key, {
                    name: commit.author,
                    email: commit.email,
                    commits: 0,
                    linesAdded: 0,
                    linesDeleted: 0,
                    firstCommit: commit.date,
                    lastCommit: commit.date,
                });
            }

            const stats = authorMap.get(key)!;
            stats.commits++;
            stats.linesAdded += commit.insertions;
            stats.linesDeleted += commit.deletions;

            if (commit.date < stats.firstCommit) {
                stats.firstCommit = commit.date;
            }
            if (commit.date > stats.lastCommit) {
                stats.lastCommit = commit.date;
            }
        }

        return Array.from(authorMap.values()).sort((a, b) => b.commits - a.commits);
    }

    private async identifyHotSpots(commits: CommitInfo[]): Promise<FileHotSpot[]> {
        const fileMap = new Map<string, { count: number; authors: Set<string>; lastModified: Date }>();

        try {
            for (const commit of commits) {
                const files = await this.getCommitFiles(commit.hash);

                for (const file of files) {
                    if (!fileMap.has(file)) {
                        fileMap.set(file, {
                            count: 0,
                            authors: new Set(),
                            lastModified: commit.date,
                        });
                    }

                    const stats = fileMap.get(file)!;
                    stats.count++;
                    stats.authors.add(commit.author);

                    if (commit.date > stats.lastModified) {
                        stats.lastModified = commit.date;
                    }
                }
            }

            const hotSpots: FileHotSpot[] = Array.from(fileMap.entries())
                .map(([file, stats]) => ({
                    file,
                    changeCount: stats.count,
                    authors: Array.from(stats.authors),
                    lastModified: stats.lastModified,
                }))
                .sort((a, b) => b.changeCount - a.changeCount)
                .slice(0, 20);

            return hotSpots;
        } catch {
            return [];
        }
    }

    private async getCommitFiles(hash: string): Promise<string[]> {
        try {
            const diff = await this.git.show([hash, "--name-only", "--format="]);
            return diff.split("\n").filter((line) => line.trim());
        } catch {
            return [];
        }
    }

    private analyzeCommitMessages(commits: CommitInfo[]): CommitMessageQuality {
        let score = 100;
        const issues: string[] = [];
        let goodPractices = 0;

        for (const commit of commits) {
            const message = commit.message.split("\n")[0]; // First line

            // Check message length
            if (message.length < 10) {
                score -= 1;
                issues.push(`Short commit message: "${message.substring(0, 30)}..."`);
            } else if (message.length > 72) {
                score -= 0.5;
            } else {
                goodPractices++;
            }

            // Check for conventional commits
            const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/;
            if (conventionalPattern.test(message)) {
                goodPractices++;
                score += 0.5;
            }

            // Check for imperative mood (starts with verb)
            const imperativePattern = /^(Add|Fix|Update|Remove|Refactor|Improve|Implement|Create|Delete|Move|Rename)/i;
            if (imperativePattern.test(message)) {
                goodPractices++;
            }

            // Penalize generic messages
            const genericMessages = ["update", "fix", "changes", "wip", "tmp", "test"];
            if (genericMessages.some((generic) => message.toLowerCase() === generic)) {
                score -= 2;
                issues.push(`Generic commit message: "${message}"`);
            }
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            issues: issues.slice(0, 10), // Limit to top 10 issues
            goodPractices,
            totalMessages: commits.length,
        };
    }

    private async getBranches(): Promise<BranchInfo[]> {
        try {
            const branchSummary = await this.git.branch();
            const branches: BranchInfo[] = [];

            for (const [name, branch] of Object.entries(branchSummary.branches)) {
                try {
                    const log = await this.git.log({ maxCount: 1, [name]: null });
                    branches.push({
                        name,
                        current: name === branchSummary.current,
                        lastCommit: log.latest ? new Date(log.latest.date) : new Date(),
                    });
                } catch {
                    // Skip branches with errors
                }
            }

            return branches;
        } catch {
            return [];
        }
    }
}
