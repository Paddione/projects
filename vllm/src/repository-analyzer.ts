import { promises as fs } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";
import { GitAnalyzer, GitAnalysis } from "./git-analyzer.js";
import { VulnerabilityScanner, VulnerabilityReport } from "./vulnerability-scanner.js";
import { CoverageAnalyzer, CoverageReport } from "./coverage-analyzer.js";
import { RuleEngine, RuleEngineResult } from "./rule-engine.js";
import { PRCommentGenerator, PRCommentOptions } from "./pr-comment-generator.js";


export interface FileInfo {
    path: string;
    relativePath: string;
    extension: string;
    size: number;
    lines?: number;
}

export interface RepositoryStructure {
    rootPath: string;
    files: FileInfo[];
    directories: string[];
    totalFiles: number;
    totalSize: number;
    filesByExtension: Record<string, number>;
}

export interface AnalysisResult {
    structure: RepositoryStructure;
    issues: Issue[];
    suggestions: Suggestion[];
    score: number;
    gitAnalysis?: GitAnalysis;
    vulnerabilities?: VulnerabilityReport;
    coverage?: CoverageReport;
    ruleViolations?: RuleEngineResult;
}


export interface Issue {
    severity: "error" | "warning" | "info";
    category: string;
    file?: string;
    line?: number;
    message: string;
    rule?: string;
}

export interface Suggestion {
    category: string;
    priority: "high" | "medium" | "low";
    title: string;
    description: string;
    autoFixable: boolean;
    files?: string[];
}

export class RepositoryAnalyzer {
    private rootPath: string;
    private guidelines: string | null = null;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async loadGuidelines(): Promise<void> {
        try {
            const agentsPath = join(this.rootPath, "README.md");
            this.guidelines = await fs.readFile(agentsPath, "utf-8");
        } catch (error) {
            // No guidelines file found
            this.guidelines = null;
        }
    }

    async analyzeStructure(): Promise<RepositoryStructure> {
        const files: FileInfo[] = [];
        const directories: string[] = [];
        const filesByExtension: Record<string, number> = {};
        let totalSize = 0;

        const walk = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                const relPath = relative(this.rootPath, fullPath);

                // Skip common ignore patterns
                if (this.shouldIgnore(relPath)) {
                    continue;
                }

                if (entry.isDirectory()) {
                    directories.push(relPath);
                    await walk(fullPath);
                } else if (entry.isFile()) {
                    const stats = await fs.stat(fullPath);
                    const ext = extname(entry.name);

                    const fileInfo: FileInfo = {
                        path: fullPath,
                        relativePath: relPath,
                        extension: ext,
                        size: stats.size,
                    };

                    // Count lines for text files
                    if (this.isTextFile(ext)) {
                        try {
                            const content = await fs.readFile(fullPath, "utf-8");
                            fileInfo.lines = content.split("\n").length;
                        } catch {
                            // Binary or unreadable file
                        }
                    }

                    files.push(fileInfo);
                    totalSize += stats.size;

                    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
                }
            }
        };

        await walk(this.rootPath);

        return {
            rootPath: this.rootPath,
            files,
            directories,
            totalFiles: files.length,
            totalSize,
            filesByExtension,
        };
    }

    async checkBestPractices(structure: RepositoryStructure): Promise<Issue[]> {
        const issues: Issue[] = [];

        // Check for README
        if (!structure.files.some((f) => f.relativePath.toLowerCase() === "readme.md")) {
            issues.push({
                severity: "warning",
                category: "documentation",
                message: "Missing README.md file",
                rule: "readme-required",
            });
        }

        // Check for .gitignore
        if (!structure.files.some((f) => f.relativePath === ".gitignore")) {
            issues.push({
                severity: "warning",
                category: "version-control",
                message: "Missing .gitignore file",
                rule: "gitignore-required",
            });
        }

        // Check for package.json in Node.js projects
        const hasPackageJson = structure.files.some((f) => f.relativePath === "package.json");
        const hasNodeModules = structure.directories.some((d) => d === "node_modules");

        if (hasPackageJson && !hasNodeModules) {
            issues.push({
                severity: "info",
                category: "dependencies",
                message: "node_modules not found - run 'npm install'",
                rule: "dependencies-installed",
            });
        }

        // Check for large files
        for (const file of structure.files) {
            if (file.size > 1024 * 1024) {
                // > 1MB
                issues.push({
                    severity: "warning",
                    category: "file-size",
                    file: file.relativePath,
                    message: `Large file detected (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
                    rule: "file-size-limit",
                });
            }
        }

        // Check for environment files
        const hasEnvExample = structure.files.some((f) => f.relativePath === ".env.example");
        const hasEnv = structure.files.some((f) => f.relativePath === ".env");

        if (hasEnv && !hasEnvExample) {
            issues.push({
                severity: "warning",
                category: "security",
                message: "Found .env but missing .env.example template",
                rule: "env-example-required",
            });
        }

        return issues;
    }

    async generateSuggestions(
        structure: RepositoryStructure,
        issues: Issue[]
    ): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        // Documentation suggestions
        const hasReadme = structure.files.some((f) => f.relativePath.toLowerCase() === "readme.md");
        if (!hasReadme) {
            suggestions.push({
                category: "documentation",
                priority: "high",
                title: "Add README.md",
                description:
                    "Create a comprehensive README with project description, setup instructions, and usage examples",
                autoFixable: true,
            });
        }

        // TypeScript suggestions
        const hasTsFiles = structure.files.some((f) => f.extension === ".ts");
        const hasTsConfig = structure.files.some((f) => f.relativePath === "tsconfig.json");

        if (hasTsFiles && !hasTsConfig) {
            suggestions.push({
                category: "configuration",
                priority: "high",
                title: "Add TypeScript configuration",
                description: "Create tsconfig.json with strict mode and proper compiler options",
                autoFixable: true,
            });
        }

        // Testing suggestions
        const hasTests = structure.files.some(
            (f) =>
                f.relativePath.includes("test") ||
                f.relativePath.includes("spec") ||
                f.extension === ".test.ts" ||
                f.extension === ".spec.ts"
        );

        if (!hasTests && structure.totalFiles > 5) {
            suggestions.push({
                category: "testing",
                priority: "medium",
                title: "Add test coverage",
                description: "Implement unit tests for core functionality",
                autoFixable: false,
            });
        }

        // CI/CD suggestions
        const hasCIConfig = structure.files.some(
            (f) =>
                f.relativePath.startsWith(".github/workflows") ||
                f.relativePath === ".gitlab-ci.yml" ||
                f.relativePath === ".travis.yml"
        );

        if (!hasCIConfig && structure.totalFiles > 10) {
            suggestions.push({
                category: "ci-cd",
                priority: "medium",
                title: "Add CI/CD pipeline",
                description: "Set up automated testing and deployment with GitHub Actions or similar",
                autoFixable: true,
            });
        }

        // Code organization
        const srcFiles = structure.files.filter((f) => f.extension === ".ts" || f.extension === ".js");
        const hasSourceDir = structure.directories.some((d) => d === "src" || d === "lib");

        if (srcFiles.length > 5 && !hasSourceDir) {
            suggestions.push({
                category: "organization",
                priority: "medium",
                title: "Organize source files",
                description: "Move source files into a dedicated 'src' directory for better structure",
                autoFixable: false,
                files: srcFiles.map((f) => f.relativePath),
            });
        }

        return suggestions;
    }

    calculateScore(
        issues: Issue[],
        gitAnalysis?: GitAnalysis,
        coverage?: CoverageReport
    ): number {
        let score = 100;

        for (const issue of issues) {
            switch (issue.severity) {
                case "error":
                    score -= 10;
                    break;
                case "warning":
                    score -= 5;
                    break;
                case "info":
                    score -= 2;
                    break;
            }
        }

        // Bonus points for good Git practices
        if (gitAnalysis?.isGitRepository) {
            const commitQuality = gitAnalysis.commitMessageQuality.score;
            score += (commitQuality - 50) / 10; // -5 to +5 points based on commit quality
        }

        // Bonus points for good test coverage
        if (coverage?.hasCoverage) {
            const coveragePercent = coverage.summary.lines.percentage;
            if (coveragePercent >= 80) {
                score += 10;
            } else if (coveragePercent >= 60) {
                score += 5;
            }
        }

        return Math.max(0, Math.min(100, Math.round(score)));
    }


    async analyze(options?: {
        includeGit?: boolean;
        includeVulnerabilities?: boolean;
        includeCoverage?: boolean;
        includeRules?: boolean;
    }): Promise<AnalysisResult> {
        const opts = {
            includeGit: true,
            includeVulnerabilities: true,
            includeCoverage: true,
            includeRules: true,
            ...options,
        };

        await this.loadGuidelines();
        const structure = await this.analyzeStructure();
        const issues = await this.checkBestPractices(structure);
        const suggestions = await this.generateSuggestions(structure, issues);

        // Run new analyzers in parallel
        const [gitAnalysis, vulnerabilities, coverage, ruleViolations] = await Promise.all([
            opts.includeGit ? this.analyzeGit() : Promise.resolve(undefined),
            opts.includeVulnerabilities ? this.scanVulnerabilities() : Promise.resolve(undefined),
            opts.includeCoverage ? this.analyzeCoverage() : Promise.resolve(undefined),
            opts.includeRules ? this.executeRules() : Promise.resolve(undefined),
        ]);

        // Merge issues from rule violations
        if (ruleViolations) {
            for (const violation of ruleViolations.violations) {
                issues.push({
                    severity: violation.severity,
                    category: "custom-rule",
                    file: violation.file,
                    line: violation.line,
                    message: violation.message,
                    rule: violation.ruleId,
                });
            }
        }

        // Add issues from vulnerabilities
        if (vulnerabilities?.hasVulnerabilities) {
            const criticalCount = vulnerabilities.summary.critical + vulnerabilities.summary.high;
            if (criticalCount > 0) {
                issues.push({
                    severity: "error",
                    category: "security",
                    message: `Found ${criticalCount} critical/high severity vulnerabilities`,
                    rule: "security-vulnerabilities",
                });
            }
        }

        // Add issues from low coverage
        if (coverage?.hasCoverage && coverage.summary.lines.percentage < 50) {
            issues.push({
                severity: "warning",
                category: "testing",
                message: `Low test coverage: ${coverage.summary.lines.percentage}%`,
                rule: "test-coverage",
            });
        }

        const score = this.calculateScore(issues, gitAnalysis, coverage);

        return {
            structure,
            issues,
            suggestions,
            score,
            gitAnalysis,
            vulnerabilities,
            coverage,
            ruleViolations,
        };
    }

    private async analyzeGit(): Promise<GitAnalysis | undefined> {
        try {
            const gitAnalyzer = new GitAnalyzer(this.rootPath);
            return await gitAnalyzer.analyze(100);
        } catch (error) {
            console.error("Error analyzing Git:", error);
            return undefined;
        }
    }

    private async scanVulnerabilities(): Promise<VulnerabilityReport | undefined> {
        try {
            const scanner = new VulnerabilityScanner(this.rootPath);
            return await scanner.scan();
        } catch (error) {
            console.error("Error scanning vulnerabilities:", error);
            return undefined;
        }
    }

    private async analyzeCoverage(): Promise<CoverageReport | undefined> {
        try {
            const coverageAnalyzer = new CoverageAnalyzer(this.rootPath);
            return await coverageAnalyzer.analyze();
        } catch (error) {
            console.error("Error analyzing coverage:", error);
            return undefined;
        }
    }

    private async executeRules(): Promise<RuleEngineResult | undefined> {
        try {
            const ruleEngine = new RuleEngine(this.rootPath);
            return await ruleEngine.execute();
        } catch (error) {
            console.error("Error executing rules:", error);
            return undefined;
        }
    }

    async generatePRComment(
        analysis: AnalysisResult,
        options?: Partial<PRCommentOptions>
    ): Promise<string> {
        const generator = new PRCommentGenerator();
        return generator.generate(
            analysis,
            analysis.gitAnalysis,
            analysis.vulnerabilities,
            analysis.coverage,
            analysis.ruleViolations,
            options
        );
    }


    private shouldIgnore(path: string): boolean {
        const ignorePatterns = [
            "node_modules",
            ".git",
            "build",
            "dist",
            ".next",
            "coverage",
            ".cache",
            ".vscode",
            ".idea",
            "*.log",
        ];

        return ignorePatterns.some((pattern) => {
            if (pattern.includes("*")) {
                const regex = new RegExp(pattern.replace("*", ".*"));
                return regex.test(path);
            }
            return path.includes(pattern);
        });
    }

    private isTextFile(ext: string): boolean {
        const textExtensions = [
            ".ts",
            ".js",
            ".tsx",
            ".jsx",
            ".json",
            ".md",
            ".txt",
            ".yml",
            ".yaml",
            ".sh",
            ".py",
            ".go",
            ".rs",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".css",
            ".scss",
            ".html",
        ];
        return textExtensions.includes(ext);
    }
}
