import type { AnalysisResult } from "./repository-analyzer.js";
import type { GitAnalysis } from "./git-analyzer.js";
import type { VulnerabilityReport } from "./vulnerability-scanner.js";
import type { CoverageReport } from "./coverage-analyzer.js";
import type { RuleEngineResult } from "./rule-engine.js";

export interface PRCommentOptions {
    format: "github" | "gitlab" | "markdown";
    includeScore: boolean;
    includeSummary: boolean;
    includeDetails: boolean;
    maxIssues?: number;
    maxSuggestions?: number;
}

export class PRCommentGenerator {
    private defaultOptions: PRCommentOptions = {
        format: "github",
        includeScore: true,
        includeSummary: true,
        includeDetails: true,
        maxIssues: 10,
        maxSuggestions: 5,
    };

    generate(
        analysis: AnalysisResult,
        gitAnalysis?: GitAnalysis,
        vulnerabilities?: VulnerabilityReport,
        coverage?: CoverageReport,
        ruleViolations?: RuleEngineResult,
        options?: Partial<PRCommentOptions>
    ): string {
        const opts = { ...this.defaultOptions, ...options };
        const sections: string[] = [];

        // Header
        sections.push(this.generateHeader(analysis, opts));

        // Summary section
        if (opts.includeSummary) {
            sections.push(this.generateSummary(analysis, gitAnalysis, vulnerabilities, coverage, ruleViolations));
        }

        // Score badge
        if (opts.includeScore) {
            sections.push(this.generateScoreBadge(analysis.score));
        }

        // Details sections
        if (opts.includeDetails) {
            // Repository structure
            sections.push(this.generateStructureSection(analysis));

            // Git analysis
            if (gitAnalysis?.isGitRepository) {
                sections.push(this.generateGitSection(gitAnalysis));
            }

            // Vulnerabilities
            if (vulnerabilities?.hasVulnerabilities) {
                sections.push(this.generateVulnerabilitySection(vulnerabilities));
            }

            // Coverage
            if (coverage?.hasCoverage) {
                sections.push(this.generateCoverageSection(coverage));
            }

            // Rule violations
            if (ruleViolations && ruleViolations.summary.total > 0) {
                sections.push(this.generateRuleViolationsSection(ruleViolations, opts.maxIssues));
            }

            // Issues
            if (analysis.issues.length > 0) {
                sections.push(this.generateIssuesSection(analysis, opts.maxIssues));
            }

            // Suggestions
            if (analysis.suggestions.length > 0) {
                sections.push(this.generateSuggestionsSection(analysis, opts.maxSuggestions));
            }
        }

        return sections.join("\n\n");
    }

    private generateHeader(analysis: AnalysisResult, options: PRCommentOptions): string {
        const emoji = analysis.score >= 80 ? "✅" : analysis.score >= 60 ? "⚠️" : "❌";
        return `# ${emoji} Repository Analysis Report`;
    }

    private generateSummary(
        analysis: AnalysisResult,
        gitAnalysis?: GitAnalysis,
        vulnerabilities?: VulnerabilityReport,
        coverage?: CoverageReport,
        ruleViolations?: RuleEngineResult
    ): string {
        const lines: string[] = ["## 📊 Summary"];

        lines.push(`- **Files**: ${analysis.structure.totalFiles}`);
        lines.push(`- **Total Size**: ${this.formatBytes(analysis.structure.totalSize)}`);
        lines.push(`- **Issues Found**: ${analysis.issues.length}`);

        if (gitAnalysis?.isGitRepository) {
            lines.push(`- **Commits Analyzed**: ${gitAnalysis.totalCommits}`);
            lines.push(`- **Contributors**: ${gitAnalysis.authors.length}`);
        }

        if (vulnerabilities?.hasVulnerabilities) {
            const critical = vulnerabilities.summary.critical + vulnerabilities.summary.high;
            lines.push(`- **Security Issues**: ${vulnerabilities.summary.total} (${critical} critical/high)`);
        }

        if (coverage?.hasCoverage) {
            lines.push(`- **Test Coverage**: ${coverage.summary.lines.percentage}%`);
        }

        if (ruleViolations) {
            lines.push(`- **Rule Violations**: ${ruleViolations.summary.total}`);
        }

        return lines.join("\n");
    }

    private generateScoreBadge(score: number): string {
        const color = score >= 80 ? "🟢" : score >= 60 ? "🟡" : "🔴";
        const rating = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Improvement";

        return `## ${color} Overall Score: ${score}/100 (${rating})`;
    }

    private generateStructureSection(analysis: AnalysisResult): string {
        const lines: string[] = ["## 📁 Repository Structure"];

        const topExtensions = Object.entries(analysis.structure.filesByExtension)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        lines.push("\n**File Types:**");
        for (const [ext, count] of topExtensions) {
            lines.push(`- ${ext || "(no extension)"}: ${count} files`);
        }

        return lines.join("\n");
    }

    private generateGitSection(gitAnalysis: GitAnalysis): string {
        const lines: string[] = ["## 🔀 Git Analysis"];

        // Top contributors
        lines.push("\n**Top Contributors:**");
        const topAuthors = gitAnalysis.authors.slice(0, 5);
        for (const author of topAuthors) {
            lines.push(`- ${author.name}: ${author.commits} commits (+${author.linesAdded}/-${author.linesDeleted})`);
        }

        // Hot spots
        if (gitAnalysis.hotSpots.length > 0) {
            lines.push("\n**Most Changed Files:**");
            const topHotSpots = gitAnalysis.hotSpots.slice(0, 5);
            for (const hotSpot of topHotSpots) {
                lines.push(`- \`${hotSpot.file}\`: ${hotSpot.changeCount} changes`);
            }
        }

        // Commit message quality
        const quality = gitAnalysis.commitMessageQuality;
        lines.push(`\n**Commit Message Quality:** ${quality.score.toFixed(1)}/100`);
        lines.push(`- Good practices: ${quality.goodPractices}/${quality.totalMessages}`);

        if (quality.issues.length > 0) {
            lines.push(`- Issues found: ${quality.issues.length}`);
        }

        return lines.join("\n");
    }

    private generateVulnerabilitySection(vulnerabilities: VulnerabilityReport): string {
        const lines: string[] = ["## 🔒 Security Vulnerabilities"];

        const summary = vulnerabilities.summary;
        lines.push("\n**Severity Breakdown:**");
        if (summary.critical > 0) lines.push(`- 🔴 Critical: ${summary.critical}`);
        if (summary.high > 0) lines.push(`- 🟠 High: ${summary.high}`);
        if (summary.moderate > 0) lines.push(`- 🟡 Moderate: ${summary.moderate}`);
        if (summary.low > 0) lines.push(`- 🔵 Low: ${summary.low}`);

        // Top vulnerabilities
        const topVulns = vulnerabilities.vulnerabilities.slice(0, 5);
        if (topVulns.length > 0) {
            lines.push("\n**Top Vulnerabilities:**");
            for (const vuln of topVulns) {
                const emoji = this.getSeverityEmoji(vuln.severity);
                lines.push(`- ${emoji} **${vuln.name}**: ${vuln.title}`);
                if (vuln.fixAvailable && vuln.recommendedVersion) {
                    lines.push(`  - Fix: Update to ${vuln.recommendedVersion}`);
                }
            }
        }

        return lines.join("\n");
    }

    private generateCoverageSection(coverage: CoverageReport): string {
        const lines: string[] = ["## 🧪 Test Coverage"];

        const summary = coverage.summary;
        lines.push("\n**Coverage Metrics:**");
        lines.push(`- Lines: ${summary.lines.percentage}% (${summary.lines.covered}/${summary.lines.total})`);
        lines.push(`- Functions: ${summary.functions.percentage}% (${summary.functions.covered}/${summary.functions.total})`);
        lines.push(`- Branches: ${summary.branches.percentage}% (${summary.branches.covered}/${summary.branches.total})`);

        if (coverage.untestedFiles.length > 0) {
            lines.push(`\n**Untested Files:** ${coverage.untestedFiles.length}`);
            const topUntested = coverage.untestedFiles.slice(0, 5);
            for (const file of topUntested) {
                lines.push(`- \`${file}\``);
            }
            if (coverage.untestedFiles.length > 5) {
                lines.push(`- ... and ${coverage.untestedFiles.length - 5} more`);
            }
        }

        return lines.join("\n");
    }

    private generateRuleViolationsSection(ruleViolations: RuleEngineResult, maxIssues?: number): string {
        const lines: string[] = ["## 📋 Rule Violations"];

        const summary = ruleViolations.summary;
        lines.push(`\n**Total Violations:** ${summary.total}`);
        if (summary.errors > 0) lines.push(`- ❌ Errors: ${summary.errors}`);
        if (summary.warnings > 0) lines.push(`- ⚠️ Warnings: ${summary.warnings}`);
        if (summary.info > 0) lines.push(`- ℹ️ Info: ${summary.info}`);

        const limit = maxIssues || 10;
        const topViolations = ruleViolations.violations.slice(0, limit);

        if (topViolations.length > 0) {
            lines.push("\n**Top Violations:**");
            for (const violation of topViolations) {
                const emoji = violation.severity === "error" ? "❌" : violation.severity === "warning" ? "⚠️" : "ℹ️";
                const location = violation.line ? `:${violation.line}` : "";
                lines.push(`- ${emoji} \`${violation.file}${location}\`: ${violation.message}`);
                if (violation.suggestion) {
                    lines.push(`  - 💡 ${violation.suggestion}`);
                }
            }

            if (ruleViolations.violations.length > limit) {
                lines.push(`\n... and ${ruleViolations.violations.length - limit} more violations`);
            }
        }

        return lines.join("\n");
    }

    private generateIssuesSection(analysis: AnalysisResult, maxIssues?: number): string {
        const lines: string[] = ["## ⚠️ Issues"];

        const limit = maxIssues || 10;
        const topIssues = analysis.issues.slice(0, limit);

        for (const issue of topIssues) {
            const emoji = issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
            const location = issue.file ? ` in \`${issue.file}\`` : "";
            lines.push(`- ${emoji} **${issue.category}**${location}: ${issue.message}`);
        }

        if (analysis.issues.length > limit) {
            lines.push(`\n... and ${analysis.issues.length - limit} more issues`);
        }

        return lines.join("\n");
    }

    private generateSuggestionsSection(analysis: AnalysisResult, maxSuggestions?: number): string {
        const lines: string[] = ["## 💡 Suggestions"];

        const limit = maxSuggestions || 5;
        const topSuggestions = analysis.suggestions
            .sort((a, b) => {
                const priorityWeight = { high: 3, medium: 2, low: 1 };
                return priorityWeight[b.priority] - priorityWeight[a.priority];
            })
            .slice(0, limit);

        for (const suggestion of topSuggestions) {
            const emoji = suggestion.priority === "high" ? "🔴" : suggestion.priority === "medium" ? "🟡" : "🔵";
            lines.push(`- ${emoji} **${suggestion.title}**`);
            lines.push(`  ${suggestion.description}`);
        }

        if (analysis.suggestions.length > limit) {
            lines.push(`\n... and ${analysis.suggestions.length - limit} more suggestions`);
        }

        return lines.join("\n");
    }

    private getSeverityEmoji(severity: string): string {
        const emojiMap: Record<string, string> = {
            critical: "🔴",
            high: "🟠",
            moderate: "🟡",
            low: "🔵",
            info: "ℹ️",
        };
        return emojiMap[severity] || "⚪";
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    }
}
