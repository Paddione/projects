import { promises as fs } from "fs";
import { join, relative } from "path";
import { existsSync } from "fs";
import * as YAML from "yaml";
import { glob } from "glob";

export interface CustomRule {
    id: string;
    name: string;
    description?: string;
    severity: "error" | "warning" | "info";
    enabled: boolean;
    type: "pattern" | "file-structure" | "naming" | "custom";
    pattern?: string;
    filePattern?: string;
    exclude?: string[];
    config?: Record<string, any>;
}

export interface RuleViolation {
    ruleId: string;
    ruleName: string;
    severity: "error" | "warning" | "info";
    file: string;
    line?: number;
    message: string;
    suggestion?: string;
}

export interface RuleEngineResult {
    violations: RuleViolation[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
        total: number;
    };
    rulesExecuted: number;
}

export class RuleEngine {
    private rootPath: string;
    private rules: CustomRule[] = [];
    private builtInRules: CustomRule[] = [];

    constructor(rootPath: string) {
        this.rootPath = rootPath;
        this.initializeBuiltInRules();
    }

    private initializeBuiltInRules(): void {
        this.builtInRules = [
            {
                id: "no-console-log",
                name: "Avoid console.log in production code",
                description: "Console statements should not be present in production code",
                severity: "warning",
                enabled: true,
                type: "pattern",
                pattern: "console\\.log\\(",
                filePattern: "**/*.{ts,js,tsx,jsx}",
                exclude: ["**/*.test.*", "**/*.spec.*", "**/test/**", "**/tests/**"],
            },
            {
                id: "no-debugger",
                name: "Remove debugger statements",
                description: "Debugger statements should not be committed",
                severity: "error",
                enabled: true,
                type: "pattern",
                pattern: "debugger;",
                filePattern: "**/*.{ts,js,tsx,jsx}",
            },
            {
                id: "no-todo-comments",
                name: "Resolve TODO comments",
                description: "TODO comments should be tracked in issue tracker",
                severity: "info",
                enabled: true,
                type: "pattern",
                pattern: "//\\s*TODO:",
                filePattern: "**/*.{ts,js,tsx,jsx}",
            },
            {
                id: "require-strict-mode",
                name: "Use TypeScript strict mode",
                description: "TypeScript should be configured with strict mode enabled",
                severity: "warning",
                enabled: true,
                type: "file-structure",
                filePattern: "tsconfig.json",
            },
            {
                id: "no-any-type",
                name: "Avoid 'any' type",
                description: "Using 'any' defeats the purpose of TypeScript",
                severity: "warning",
                enabled: true,
                type: "pattern",
                pattern: ":\\s*any\\b",
                filePattern: "**/*.{ts,tsx}",
                exclude: ["**/*.test.*", "**/*.spec.*"],
            },
        ];
    }

    async loadCustomRules(): Promise<void> {
        const rulesPath = join(this.rootPath, ".analyzer-rules.yml");

        if (!existsSync(rulesPath)) {
            this.rules = [...this.builtInRules];
            return;
        }

        try {
            const content = await fs.readFile(rulesPath, "utf-8");
            const config = YAML.parse(content);

            if (config.rules && Array.isArray(config.rules)) {
                const customRules = config.rules.map((rule: any) => ({
                    id: rule.id,
                    name: rule.name,
                    description: rule.description,
                    severity: rule.severity || "warning",
                    enabled: rule.enabled !== false,
                    type: rule.type || "pattern",
                    pattern: rule.pattern,
                    filePattern: rule.filePattern || "**/*",
                    exclude: rule.exclude || [],
                    config: rule.config || {},
                }));

                // Merge custom rules with built-in rules
                // Custom rules can override built-in rules by ID
                const ruleMap = new Map<string, CustomRule>();

                for (const rule of this.builtInRules) {
                    ruleMap.set(rule.id, rule);
                }

                for (const rule of customRules) {
                    ruleMap.set(rule.id, rule);
                }

                this.rules = Array.from(ruleMap.values()).filter((r) => r.enabled);
            } else {
                this.rules = [...this.builtInRules];
            }
        } catch (error) {
            console.error("Error loading custom rules:", error);
            this.rules = [...this.builtInRules];
        }
    }

    async execute(): Promise<RuleEngineResult> {
        await this.loadCustomRules();

        const violations: RuleViolation[] = [];
        let rulesExecuted = 0;

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            rulesExecuted++;

            switch (rule.type) {
                case "pattern":
                    violations.push(...(await this.executePatternRule(rule)));
                    break;
                case "file-structure":
                    violations.push(...(await this.executeFileStructureRule(rule)));
                    break;
                case "naming":
                    violations.push(...(await this.executeNamingRule(rule)));
                    break;
            }
        }

        const summary = {
            errors: violations.filter((v) => v.severity === "error").length,
            warnings: violations.filter((v) => v.severity === "warning").length,
            info: violations.filter((v) => v.severity === "info").length,
            total: violations.length,
        };

        return {
            violations: violations.sort((a, b) => {
                const severityWeight = { error: 3, warning: 2, info: 1 };
                return severityWeight[b.severity] - severityWeight[a.severity];
            }),
            summary,
            rulesExecuted,
        };
    }

    private async executePatternRule(rule: CustomRule): Promise<RuleViolation[]> {
        if (!rule.pattern || !rule.filePattern) return [];

        const violations: RuleViolation[] = [];
        const pattern = new RegExp(rule.pattern, "g");

        try {
            const files = await glob(rule.filePattern, {
                cwd: this.rootPath,
                ignore: rule.exclude || [],
                nodir: true,
            });

            for (const file of files) {
                const filePath = join(this.rootPath, file);

                try {
                    const content = await fs.readFile(filePath, "utf-8");
                    const lines = content.split("\n");

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (pattern.test(line)) {
                            violations.push({
                                ruleId: rule.id,
                                ruleName: rule.name,
                                severity: rule.severity,
                                file: relative(this.rootPath, filePath),
                                line: i + 1,
                                message: rule.description || rule.name,
                                suggestion: this.getSuggestion(rule.id),
                            });
                        }
                        pattern.lastIndex = 0; // Reset regex state
                    }
                } catch {
                    // Skip binary or unreadable files
                }
            }
        } catch (error) {
            console.error(`Error executing pattern rule ${rule.id}:`, error);
        }

        return violations;
    }

    private async executeFileStructureRule(rule: CustomRule): Promise<RuleViolation[]> {
        const violations: RuleViolation[] = [];

        if (rule.id === "require-strict-mode") {
            const tsconfigPath = join(this.rootPath, "tsconfig.json");

            if (existsSync(tsconfigPath)) {
                try {
                    const content = await fs.readFile(tsconfigPath, "utf-8");
                    const config = JSON.parse(content);

                    if (!config.compilerOptions?.strict) {
                        violations.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            severity: rule.severity,
                            file: "tsconfig.json",
                            message: "TypeScript strict mode is not enabled",
                            suggestion: 'Add "strict": true to compilerOptions',
                        });
                    }
                } catch {
                    // Invalid JSON or read error
                }
            }
        }

        return violations;
    }

    private async executeNamingRule(rule: CustomRule): Promise<RuleViolation[]> {
        // Placeholder for naming convention rules
        // Can be extended to check file naming, variable naming, etc.
        return [];
    }

    private getSuggestion(ruleId: string): string | undefined {
        const suggestions: Record<string, string> = {
            "no-console-log": "Use a proper logging library or remove the console.log statement",
            "no-debugger": "Remove the debugger statement before committing",
            "no-todo-comments": "Create an issue in your tracker and remove the TODO comment",
            "no-any-type": "Use a more specific type instead of 'any'",
        };

        return suggestions[ruleId];
    }

    getRules(): CustomRule[] {
        return this.rules;
    }

    async validateRules(): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        for (const rule of this.rules) {
            if (!rule.id) {
                errors.push("Rule missing required 'id' field");
            }
            if (!rule.name) {
                errors.push(`Rule ${rule.id} missing required 'name' field`);
            }
            if (!["error", "warning", "info"].includes(rule.severity)) {
                errors.push(`Rule ${rule.id} has invalid severity: ${rule.severity}`);
            }
            if (rule.type === "pattern" && !rule.pattern) {
                errors.push(`Pattern rule ${rule.id} missing 'pattern' field`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
