import { promises as fs } from "fs";
import { join, relative } from "path";
import { existsSync } from "fs";

export interface CoverageReport {
    hasCoverage: boolean;
    summary: CoverageSummary;
    filesCoverage: FileCoverage[];
    untestedFiles: string[];
    suggestions: CoverageSuggestion[];
}

export interface CoverageSummary {
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
}

export interface CoverageMetric {
    total: number;
    covered: number;
    percentage: number;
}

export interface FileCoverage {
    file: string;
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
}

export interface CoverageSuggestion {
    priority: "high" | "medium" | "low";
    file: string;
    message: string;
    currentCoverage: number;
}

export class CoverageAnalyzer {
    private rootPath: string;

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    async analyze(): Promise<CoverageReport> {
        // Try to find coverage reports in common locations
        const coveragePaths = [
            join(this.rootPath, "coverage", "coverage-summary.json"),
            join(this.rootPath, "coverage", "lcov.info"),
            join(this.rootPath, ".nyc_output", "coverage-summary.json"),
        ];

        for (const path of coveragePaths) {
            if (existsSync(path)) {
                if (path.endsWith(".json")) {
                    return await this.parseJsonCoverage(path);
                } else if (path.endsWith(".info")) {
                    return await this.parseLcovCoverage(path);
                }
            }
        }

        return this.emptyReport();
    }

    private async parseJsonCoverage(path: string): Promise<CoverageReport> {
        try {
            const content = await fs.readFile(path, "utf-8");
            const data = JSON.parse(content);

            // Handle Istanbul/NYC JSON format
            if (data.total) {
                return this.parseIstanbulFormat(data);
            }

            // Handle Jest coverage-summary.json format
            return this.parseJestFormat(data);
        } catch (error) {
            console.error("Error parsing JSON coverage:", error);
            return this.emptyReport();
        }
    }

    private parseIstanbulFormat(data: any): CoverageReport {
        const summary: CoverageSummary = {
            lines: this.extractMetric(data.total.lines),
            statements: this.extractMetric(data.total.statements),
            functions: this.extractMetric(data.total.functions),
            branches: this.extractMetric(data.total.branches),
        };

        const filesCoverage: FileCoverage[] = [];
        const untestedFiles: string[] = [];

        for (const [filePath, fileData] of Object.entries(data)) {
            if (filePath === "total") continue;

            const file = relative(this.rootPath, filePath);
            const coverage = fileData as any;

            const lineCoverage = this.extractMetric(coverage.lines);

            if (lineCoverage.percentage === 0) {
                untestedFiles.push(file);
            }

            filesCoverage.push({
                file,
                lines: lineCoverage,
                statements: this.extractMetric(coverage.statements),
                functions: this.extractMetric(coverage.functions),
                branches: this.extractMetric(coverage.branches),
            });
        }

        const suggestions = this.generateSuggestions(filesCoverage, summary);

        return {
            hasCoverage: true,
            summary,
            filesCoverage: filesCoverage.sort((a, b) => a.lines.percentage - b.lines.percentage),
            untestedFiles,
            suggestions,
        };
    }

    private parseJestFormat(data: any): CoverageReport {
        // Jest format is similar to Istanbul
        return this.parseIstanbulFormat(data);
    }

    private async parseLcovCoverage(path: string): Promise<CoverageReport> {
        try {
            const content = await fs.readFile(path, "utf-8");
            return this.parseLcovContent(content);
        } catch (error) {
            console.error("Error parsing LCOV coverage:", error);
            return this.emptyReport();
        }
    }

    private parseLcovContent(content: string): CoverageReport {
        const lines = content.split("\n");
        const filesCoverage: FileCoverage[] = [];
        const untestedFiles: string[] = [];

        let currentFile = "";
        let linesFound = 0;
        let linesHit = 0;
        let functionsFound = 0;
        let functionsHit = 0;
        let branchesFound = 0;
        let branchesHit = 0;

        let totalLinesFound = 0;
        let totalLinesHit = 0;
        let totalFunctionsFound = 0;
        let totalFunctionsHit = 0;
        let totalBranchesFound = 0;
        let totalBranchesHit = 0;

        for (const line of lines) {
            if (line.startsWith("SF:")) {
                currentFile = relative(this.rootPath, line.substring(3));
            } else if (line.startsWith("LF:")) {
                linesFound = parseInt(line.substring(3)) || 0;
            } else if (line.startsWith("LH:")) {
                linesHit = parseInt(line.substring(3)) || 0;
            } else if (line.startsWith("FNF:")) {
                functionsFound = parseInt(line.substring(4)) || 0;
            } else if (line.startsWith("FNH:")) {
                functionsHit = parseInt(line.substring(4)) || 0;
            } else if (line.startsWith("BRF:")) {
                branchesFound = parseInt(line.substring(4)) || 0;
            } else if (line.startsWith("BRH:")) {
                branchesHit = parseInt(line.substring(4)) || 0;
            } else if (line === "end_of_record") {
                if (currentFile) {
                    const lineCoverage = this.calculatePercentage(linesHit, linesFound);

                    if (lineCoverage === 0) {
                        untestedFiles.push(currentFile);
                    }

                    filesCoverage.push({
                        file: currentFile,
                        lines: { total: linesFound, covered: linesHit, percentage: lineCoverage },
                        statements: { total: linesFound, covered: linesHit, percentage: lineCoverage },
                        functions: {
                            total: functionsFound,
                            covered: functionsHit,
                            percentage: this.calculatePercentage(functionsHit, functionsFound)
                        },
                        branches: {
                            total: branchesFound,
                            covered: branchesHit,
                            percentage: this.calculatePercentage(branchesHit, branchesFound)
                        },
                    });

                    totalLinesFound += linesFound;
                    totalLinesHit += linesHit;
                    totalFunctionsFound += functionsFound;
                    totalFunctionsHit += functionsHit;
                    totalBranchesFound += branchesFound;
                    totalBranchesHit += branchesHit;
                }

                // Reset for next file
                currentFile = "";
                linesFound = 0;
                linesHit = 0;
                functionsFound = 0;
                functionsHit = 0;
                branchesFound = 0;
                branchesHit = 0;
            }
        }

        const summary: CoverageSummary = {
            lines: {
                total: totalLinesFound,
                covered: totalLinesHit,
                percentage: this.calculatePercentage(totalLinesHit, totalLinesFound)
            },
            statements: {
                total: totalLinesFound,
                covered: totalLinesHit,
                percentage: this.calculatePercentage(totalLinesHit, totalLinesFound)
            },
            functions: {
                total: totalFunctionsFound,
                covered: totalFunctionsHit,
                percentage: this.calculatePercentage(totalFunctionsHit, totalFunctionsFound)
            },
            branches: {
                total: totalBranchesFound,
                covered: totalBranchesHit,
                percentage: this.calculatePercentage(totalBranchesHit, totalBranchesFound)
            },
        };

        const suggestions = this.generateSuggestions(filesCoverage, summary);

        return {
            hasCoverage: true,
            summary,
            filesCoverage: filesCoverage.sort((a, b) => a.lines.percentage - b.lines.percentage),
            untestedFiles,
            suggestions,
        };
    }

    private extractMetric(data: any): CoverageMetric {
        return {
            total: data.total || 0,
            covered: data.covered || 0,
            percentage: data.pct || 0,
        };
    }

    private calculatePercentage(covered: number, total: number): number {
        if (total === 0) return 0;
        return Math.round((covered / total) * 100 * 100) / 100;
    }

    private generateSuggestions(
        filesCoverage: FileCoverage[],
        summary: CoverageSummary
    ): CoverageSuggestion[] {
        const suggestions: CoverageSuggestion[] = [];

        // Overall coverage suggestions
        if (summary.lines.percentage < 50) {
            suggestions.push({
                priority: "high",
                file: "overall",
                message: `Overall line coverage is low (${summary.lines.percentage}%). Consider adding more tests.`,
                currentCoverage: summary.lines.percentage,
            });
        } else if (summary.lines.percentage < 80) {
            suggestions.push({
                priority: "medium",
                file: "overall",
                message: `Overall line coverage is ${summary.lines.percentage}%. Aim for 80%+ coverage.`,
                currentCoverage: summary.lines.percentage,
            });
        }

        // Per-file suggestions (focus on worst offenders)
        const lowCoverageFiles = filesCoverage
            .filter((f) => f.lines.percentage < 50)
            .slice(0, 5);

        for (const file of lowCoverageFiles) {
            suggestions.push({
                priority: file.lines.percentage === 0 ? "high" : "medium",
                file: file.file,
                message: `Low coverage (${file.lines.percentage}%) - add tests for this file`,
                currentCoverage: file.lines.percentage,
            });
        }

        return suggestions.sort((a, b) => {
            const priorityWeight = { high: 3, medium: 2, low: 1 };
            return priorityWeight[b.priority] - priorityWeight[a.priority];
        });
    }

    private emptyReport(): CoverageReport {
        return {
            hasCoverage: false,
            summary: {
                lines: { total: 0, covered: 0, percentage: 0 },
                statements: { total: 0, covered: 0, percentage: 0 },
                functions: { total: 0, covered: 0, percentage: 0 },
                branches: { total: 0, covered: 0, percentage: 0 },
            },
            filesCoverage: [],
            untestedFiles: [],
            suggestions: [],
        };
    }
}
