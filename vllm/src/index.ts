#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    CallToolResult,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { RepositoryAnalyzer } from "./repository-analyzer.js";
import pg from "pg";
import { spawn, ChildProcess } from "child_process";
import { createInterface } from "readline";

interface DynamicServerInstance {
    name: string;
    image: string;
    process: ChildProcess;
    tools: Tool[];
    status: "running" | "stopped" | "error";
    error?: string;
}



interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface ChatCompletionRequest {
    model?: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
}

interface CompletionRequest {
    model?: string;
    prompt: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
}

class VLLMServer {
    private server: Server;
    private dbPool: pg.Pool;
    private vllmBaseUrl: string;
    private vllmApiKey: string;
    private dynamicServers: Map<string, DynamicServerInstance> = new Map();

    constructor() {
        this.vllmBaseUrl = process.env.VLLM_BASE_URL || "http://localhost:4100";
        this.vllmApiKey = process.env.VLLM_API_KEY || "";
        const dbUrl = process.env.DATABASE_URL || "postgresql://webui:webui@localhost:5432/webui";

        this.dbPool = new pg.Pool({
            connectionString: dbUrl,
            // Add some safety defaults
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            max: 10,
        });
        this.server = new Server(
            {
                name: "vllm-mcp-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
        this.setupErrorHandling();
    }

    private setupErrorHandling(): void {
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };

        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    private setupHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools: Tool[] = [
                {
                    name: "chat_completion",
                    description:
                        "Generate a chat completion using the vLLM model. Supports multi-turn conversations with system, user, and assistant messages.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            messages: {
                                type: "array",
                                description: "Array of chat messages",
                                items: {
                                    type: "object",
                                    properties: {
                                        role: {
                                            type: "string",
                                            enum: ["system", "user", "assistant"],
                                            description: "Role of the message sender",
                                        },
                                        content: {
                                            type: "string",
                                            description: "Content of the message",
                                        },
                                    },
                                    required: ["role", "content"],
                                },
                            },
                            model: {
                                type: "string",
                                description: "Model name (optional, uses default model if not specified)",
                            },
                            temperature: {
                                type: "number",
                                description: "Sampling temperature (0.0 to 2.0)",
                                minimum: 0,
                                maximum: 2,
                            },
                            max_tokens: {
                                type: "number",
                                description: "Maximum number of tokens to generate",
                            },
                            top_p: {
                                type: "number",
                                description: "Nucleus sampling parameter",
                                minimum: 0,
                                maximum: 1,
                            },
                        },
                        required: ["messages"],
                    },
                },
                {
                    name: "completion",
                    description:
                        "Generate a text completion using the vLLM model. Simple prompt-to-completion interface.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "Text prompt for completion",
                            },
                            model: {
                                type: "string",
                                description: "Model name (optional, uses default model if not specified)",
                            },
                            temperature: {
                                type: "number",
                                description: "Sampling temperature (0.0 to 2.0)",
                                minimum: 0,
                                maximum: 2,
                            },
                            max_tokens: {
                                type: "number",
                                description: "Maximum number of tokens to generate",
                            },
                            top_p: {
                                type: "number",
                                description: "Nucleus sampling parameter",
                                minimum: 0,
                                maximum: 1,
                            },
                        },
                        required: ["prompt"],
                    },
                },
                {
                    name: "list_models",
                    description: "List available models from the vLLM server",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "analyze_repository",
                    description:
                        "Analyze a repository's structure, detect issues, and provide improvement suggestions. Returns comprehensive analysis including file structure, best practice violations, and actionable recommendations.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository to analyze",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "review_code_with_ai",
                    description:
                        "Use the vLLM model to perform an intelligent code review of specific files. Provides detailed feedback on code quality, potential bugs, and improvement suggestions.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            file_path: {
                                type: "string",
                                description: "Path to the file to review",
                            },
                            focus_areas: {
                                type: "array",
                                description:
                                    "Specific areas to focus on (e.g., 'security', 'performance', 'readability')",
                                items: {
                                    type: "string",
                                },
                            },
                            context: {
                                type: "string",
                                description: "Additional context about the code or project",
                            },
                        },
                        required: ["file_path"],
                    },
                },
                {
                    name: "check_guidelines",
                    description:
                        "Check if the repository follows the guidelines specified in README.md or custom rules. Validates coding standards, naming conventions, and project structure.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                            guidelines_file: {
                                type: "string",
                                description: "Path to guidelines file (default: README.md)",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "suggest_improvements",
                    description:
                        "Generate prioritized improvement suggestions for a repository. Can optionally auto-apply simple fixes like adding missing files or updating configurations.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                            auto_fix: {
                                type: "boolean",
                                description: "Whether to automatically apply simple fixes (default: false)",
                            },
                            categories: {
                                type: "array",
                                description:
                                    "Filter suggestions by category (e.g., 'documentation', 'testing', 'security')",
                                items: {
                                    type: "string",
                                },
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "analyze_git_history",
                    description:
                        "Analyze Git commit history, author contributions, file change frequency, and commit message quality. Identifies code hot spots and provides insights into repository evolution.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the Git repository",
                            },
                            commit_limit: {
                                type: "number",
                                description: "Maximum number of commits to analyze (default: 100)",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "scan_vulnerabilities",
                    description:
                        "Scan repository dependencies for security vulnerabilities using npm audit. Provides detailed vulnerability reports with severity levels and fix recommendations.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "analyze_coverage",
                    description:
                        "Analyze test coverage reports from Jest, NYC, or other coverage tools. Identifies untested files and provides coverage improvement suggestions.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "generate_pr_comment",
                    description:
                        "Generate a comprehensive PR comment with repository analysis results. Formats all analysis data into a professional markdown report suitable for GitHub/GitLab.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                            format: {
                                type: "string",
                                enum: ["github", "gitlab", "markdown"],
                                description: "Output format (default: github)",
                            },
                            include_details: {
                                type: "boolean",
                                description: "Include detailed analysis sections (default: true)",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "validate_custom_rules",
                    description:
                        "Validate the repository against custom rules defined in .mcp/rules.json. Useful for enforcing project-specific standards.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            repository_path: {
                                type: "string",
                                description: "Absolute path to the repository",
                            },
                        },
                        required: ["repository_path"],
                    },
                },
                {
                    name: "db_describe_schema",
                    description: "List all tables and columns in the database to help understand the schema.",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "db_list_users",
                    description: "List all registered users in the Open-WebUI database.",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
                {
                    name: "db_run_query",
                    description: "Run a custom SQL query. Only SELECT queries are allowed for safety.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            sql: {
                                type: "string",
                                description: "The SQL query to execute (must be a SELECT statement)",
                            },
                        },
                        required: ["sql"],
                    },
                },
                {
                    name: "db_set_user_role",
                    description: "Set the role of a user (e.g., 'admin', 'user', 'pending').",
                    inputSchema: {
                        type: "object",
                        properties: {
                            email: {
                                type: "string",
                                description: "The email of the user to update",
                            },
                            role: {
                                type: "string",
                                enum: ["admin", "user", "pending"],
                                description: "The new role for the user",
                            },
                        },
                        required: ["email", "role"],
                    },
                },
                {
                    name: "mcp_add",
                    description: "Add and start a new MCP server from a Docker image.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Unique name for the server (e.g., 'dockerhub', 'context7')",
                            },
                            image: {
                                type: "string",
                                description: "Docker image (defaults to mcp/<name>)",
                            },
                            env: {
                                type: "object",
                                additionalProperties: { type: "string" },
                                description: "Optional environment variables",
                            }
                        },
                        required: ["name"],
                    },
                },
                {
                    name: "mcp_list",
                    description: "List all dynamically added MCP servers and their status.",
                    inputSchema: {
                        type: "object",
                        properties: {},
                    },
                },
            ];

            // Add dynamic tools from sub-servers
            for (const instance of this.dynamicServers.values()) {
                if (instance.status === "running") {
                    tools.push(...instance.tools.map(t => ({
                        ...t,
                        name: `${instance.name}__${t.name}` // Namespace tools
                    })));
                }
            }

            return { tools };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case "chat_completion":
                        return await this.handleChatCompletion(args as unknown as ChatCompletionRequest);
                    case "completion":
                        return await this.handleCompletion(args as unknown as CompletionRequest);
                    case "list_models":
                        return await this.handleListModels();
                    case "analyze_repository":
                        return await this.handleAnalyzeRepository(args as unknown as { repository_path: string });
                    case "review_code_with_ai":
                        return await this.handleReviewCodeWithAI(args as unknown as { file_path: string; focus_areas?: string[]; context?: string });
                    case "check_guidelines":
                        return await this.handleCheckGuidelines(args as unknown as { repository_path: string; guidelines_file?: string });
                    case "suggest_improvements":
                        return await this.handleSuggestImprovements(args as unknown as { repository_path: string; auto_fix?: boolean; categories?: string[] });
                    case "analyze_git_history":
                        return await this.handleAnalyzeGitHistory(args as unknown as { repository_path: string; commit_limit?: number });
                    case "scan_vulnerabilities":
                        return await this.handleScanVulnerabilities(args as unknown as { repository_path: string });
                    case "analyze_coverage":
                        return await this.handleAnalyzeCoverage(args as unknown as { repository_path: string });
                    case "generate_pr_comment":
                        return await this.handleGeneratePRComment(args as unknown as { repository_path: string; format?: string; include_details?: boolean });
                    case "validate_custom_rules":
                        return await this.handleValidateCustomRules(args as unknown as { repository_path: string });
                    case "db_describe_schema":
                        return await this.handleDbDescribeSchema();
                    case "db_list_users":
                        return await this.handleDbListUsers();
                    case "db_run_query":
                        return await this.handleDbRunQuery(args as unknown as { sql: string });
                    case "db_set_user_role":
                        return await this.handleDbSetUserRole(args as unknown as { email: string; role: string });
                    case "mcp_add":
                        return await this.handleMcpAdd(args as any);
                    case "mcp_list":
                        return await this.handleMcpList();
                    default:
                        // Check if it's a dynamic tool
                        if (name.includes("__")) {
                            const [serverName, toolName] = name.split("__");
                            return await this.handleDynamicToolCall(serverName, toolName, args);
                        }
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async handleMcpAdd(args: { name: string; image?: string; env?: Record<string, string> }): Promise<CallToolResult> {
        const name = args.name;
        const image = args.image || `mcp/${name}`;

        if (this.dynamicServers.has(name)) {
            throw new Error(`Server '${name}' is already added.`);
        }

        console.log(`[MCP_ADD] Adding server '${name}' from image '${image}'...`);

        // Pull image first
        await new Promise((resolve, reject) => {
            const pull = spawn("docker", ["pull", image]);
            pull.on("close", (code) => code === 0 ? resolve(null) : reject(new Error(`Docker pull failed with code ${code}`)));
        });

        // Start container
        const dockerArgs = [
            "run", "--rm", "-i", "--init",
            "--security-opt", "no-new-privileges",
            "--cpus", "1", "--memory", "2Gb",
            "-l", "docker-mcp=true",
            "-l", `docker-mcp-name=${name}`,
            "-e", "MCP_TRANSPORT=stdio"
        ];

        // Add secrets if they exist in env
        if (name === "dockerhub" && process.env.DOCKERHUB_PAT_TOKEN) {
            dockerArgs.push("-e", `DOCKERHUB_PAT_TOKEN=${process.env.DOCKERHUB_PAT_TOKEN}`);
        }
        if (process.env.GIT_Pers_acc) {
            dockerArgs.push("-e", `GITHUB_PERSONAL_ACCESS_TOKEN=${process.env.GIT_Pers_acc}`);
        }

        if (args.env) {
            for (const [key, value] of Object.entries(args.env)) {
                dockerArgs.push("-e", `${key}=${value}`);
            }
        }

        dockerArgs.push(image);

        const child = spawn("docker", dockerArgs);

        const instance: DynamicServerInstance = {
            name,
            image,
            process: child,
            tools: [],
            status: "running"
        };

        this.dynamicServers.set(name, instance);

        // Setup communication
        const rl = createInterface({ input: child.stdout! });

        // Error handling
        child.stderr?.on("data", (data) => console.error(`[${name}] ${data}`));
        child.on("close", (code) => {
            console.log(`[${name}] Server exited with code ${code}`);
            instance.status = "stopped";
        });

        // Discover tools (Request 'listTools')
        const toolsPromise = new Promise<Tool[]>((resolve, reject) => {
            const requestId = Date.now();
            const listRequest = JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/list",
                id: requestId,
                params: {}
            }) + "\n";

            const timeout = setTimeout(() => reject(new Error("Timeout waiting for tool discovery")), 10000);

            rl.on("line", (line) => {
                try {
                    const response = JSON.parse(line);
                    if (response.id === requestId) {
                        clearTimeout(timeout);
                        resolve(response.result.tools || []);
                        rl.removeAllListeners("line");
                    }
                } catch (e) {
                    // Ignore non-json output
                }
            });

            child.stdin!.write(listRequest);
        });

        try {
            instance.tools = await toolsPromise;
            return {
                content: [{
                    type: "text",
                    text: `Successfully added ${instance.tools.length} tools from server '${name}'.\n\nTools available with prefix '${name}__'.`
                }]
            };
        } catch (error) {
            instance.status = "error";
            instance.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    private async handleMcpList(): Promise<CallToolResult> {
        const list = Array.from(this.dynamicServers.entries()).map(([name, inst]) => ({
            name,
            image: inst.image,
            status: inst.status,
            toolsCount: inst.tools.length,
            error: inst.error
        }));

        return {
            content: [{
                type: "text",
                text: JSON.stringify(list, null, 2)
            }]
        };
    }

    private async handleDynamicToolCall(serverName: string, toolName: string, args: any): Promise<CallToolResult> {
        const instance = this.dynamicServers.get(serverName);
        if (!instance || instance.status !== "running") {
            throw new Error(`Server '${serverName}' is not running.`);
        }

        return new Promise<CallToolResult>((resolve, reject) => {
            const requestId = Date.now();
            const request = JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                id: requestId,
                params: {
                    name: toolName,
                    arguments: args
                }
            }) + "\n";

            const rl = createInterface({ input: instance.process.stdout! });
            const timeout = setTimeout(() => {
                rl.removeAllListeners("line");
                reject(new Error(`Timeout calling tool '${toolName}' on server '${serverName}'`));
            }, 30000);

            rl.on("line", (line) => {
                try {
                    const response = JSON.parse(line);
                    if (response.id === requestId) {
                        clearTimeout(timeout);
                        rl.removeAllListeners("line");
                        resolve(response.result as CallToolResult);
                    }
                } catch (e) {
                    // Ignore
                }
            });

            instance.process.stdin!.write(request);
        });
    }

    private async handleChatCompletion(args: ChatCompletionRequest): Promise<CallToolResult> {
        const url = `${this.vllmBaseUrl}/v1/chat/completions`;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.vllmApiKey) {
            headers["Authorization"] = `Bearer ${this.vllmApiKey}`;
        }

        const body = {
            messages: args.messages,
            ...(args.model && { model: args.model }),
            ...(args.temperature !== undefined && { temperature: args.temperature }),
            ...(args.max_tokens !== undefined && { max_tokens: args.max_tokens }),
            ...(args.top_p !== undefined && { top_p: args.top_p }),
            stream: false,
        };

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`vLLM API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        return {
            content: [
                {
                    type: "text",
                    text: data.choices[0]?.message?.content || "No response generated",
                },
            ],
        };
    }

    private async handleCompletion(args: CompletionRequest): Promise<CallToolResult> {
        const url = `${this.vllmBaseUrl}/v1/completions`;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.vllmApiKey) {
            headers["Authorization"] = `Bearer ${this.vllmApiKey}`;
        }

        const body = {
            prompt: args.prompt,
            ...(args.model && { model: args.model }),
            ...(args.temperature !== undefined && { temperature: args.temperature }),
            ...(args.max_tokens !== undefined && { max_tokens: args.max_tokens }),
            ...(args.top_p !== undefined && { top_p: args.top_p }),
            stream: false,
        };

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`vLLM API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        return {
            content: [
                {
                    type: "text",
                    text: data.choices[0]?.text || "No response generated",
                },
            ],
        };
    }

    private async handleListModels(): Promise<CallToolResult> {
        const url = `${this.vllmBaseUrl}/v1/models`;

        const headers: Record<string, string> = {};

        if (this.vllmApiKey) {
            headers["Authorization"] = `Bearer ${this.vllmApiKey}`;
        }

        const response = await fetch(url, {
            method: "GET",
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`vLLM API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }

    private async handleAnalyzeRepository(args: { repository_path: string }): Promise<CallToolResult> {
        const analyzer = new RepositoryAnalyzer(args.repository_path);
        const analysis = await analyzer.analyze();

        const report = {
            summary: {
                score: analysis.score,
                totalFiles: analysis.structure.totalFiles,
                totalSize: `${(analysis.structure.totalSize / 1024 / 1024).toFixed(2)} MB`,
                issues: analysis.issues.length,
                suggestions: analysis.suggestions.length,
            },
            filesByExtension: analysis.structure.filesByExtension,
            issues: analysis.issues,
            suggestions: analysis.suggestions,
        };

        return {
            content: [
                {
                    type: "text",
                    text: `# Repository Analysis Report\n\n## Summary\n- **Quality Score**: ${analysis.score}/100\n- **Total Files**: ${analysis.structure.totalFiles}\n- **Total Size**: ${(analysis.structure.totalSize / 1024 / 1024).toFixed(2)} MB\n- **Issues Found**: ${analysis.issues.length}\n- **Suggestions**: ${analysis.suggestions.length}\n\n## Issues\n${analysis.issues.map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.message}${issue.file ? ` (${issue.file})` : ""}`).join("\n")}\n\n## Suggestions\n${analysis.suggestions.map((s) => `### ${s.title} (${s.priority} priority)\n${s.description}\n${s.autoFixable ? "✅ Auto-fixable" : "⚠️ Manual fix required"}`).join("\n\n")}\n\n## Detailed Data\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
                },
            ],
        };
    }

    private async handleReviewCodeWithAI(args: {
        file_path: string;
        focus_areas?: string[];
        context?: string;
    }): Promise<CallToolResult> {
        const fs = await import("fs/promises");
        const fileContent = await fs.readFile(args.file_path, "utf-8");

        const focusAreasText = args.focus_areas?.length
            ? `Focus particularly on: ${args.focus_areas.join(", ")}`
            : "";

        const contextText = args.context ? `\n\nContext: ${args.context}` : "";

        const prompt = `You are an expert code reviewer. Review the following code and provide detailed feedback.

${focusAreasText}${contextText}

File: ${args.file_path}

\`\`\`
${fileContent}
\`\`\`

Please provide:
1. Overall code quality assessment
2. Potential bugs or issues
3. Security concerns
4. Performance improvements
5. Readability and maintainability suggestions
6. Best practices violations

Be specific and actionable in your feedback.`;

        const response = await this.handleChatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        "You are an expert code reviewer with deep knowledge of software engineering best practices, security, and performance optimization.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });

        return response;
    }

    private async handleCheckGuidelines(args: {
        repository_path: string;
        guidelines_file?: string;
    }): Promise<CallToolResult> {
        const fs = await import("fs/promises");
        const path = await import("path");

        const guidelinesPath = args.guidelines_file
            ? path.join(args.repository_path, args.guidelines_file)
            : path.join(args.repository_path, "README.md");

        let guidelines: string;
        try {
            guidelines = await fs.readFile(guidelinesPath, "utf-8");
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No guidelines file found at ${guidelinesPath}. Please ensure project guidelines are in README.md or specify a guidelines file.`,
                    },
                ],
            };
        }

        const analyzer = new RepositoryAnalyzer(args.repository_path);
        const analysis = await analyzer.analyze();

        // Use AI to check compliance with guidelines
        const prompt = `You are a repository auditor. Check if this repository follows the guidelines below.

GUIDELINES:
${guidelines}

REPOSITORY ANALYSIS:
- Total Files: ${analysis.structure.totalFiles}
- Issues Found: ${JSON.stringify(analysis.issues, null, 2)}
- Current Suggestions: ${JSON.stringify(analysis.suggestions, null, 2)}

Please provide:
1. Compliance score (0-100)
2. Specific guideline violations
3. Recommendations to align with guidelines
4. Priority actions to take

Be specific and reference the guidelines directly.`;

        const response = await this.handleChatCompletion({
            messages: [
                {
                    role: "system",
                    content:
                        "You are a meticulous repository auditor who ensures projects follow established guidelines and best practices.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.2,
            max_tokens: 2000,
        });

        return response;
    }

    private async handleSuggestImprovements(args: {
        repository_path: string;
        auto_fix?: boolean;
        categories?: string[];
    }): Promise<CallToolResult> {
        const analyzer = new RepositoryAnalyzer(args.repository_path);
        const analysis = await analyzer.analyze();

        let suggestions = analysis.suggestions;

        // Filter by categories if specified
        if (args.categories && args.categories.length > 0) {
            suggestions = suggestions.filter((s) => args.categories!.includes(s.category));
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        let autoFixResults: string[] = [];

        if (args.auto_fix) {
            const fs = await import("fs/promises");
            const path = await import("path");

            for (const suggestion of suggestions.filter((s) => s.autoFixable)) {
                try {
                    if (suggestion.title === "Add README.md") {
                        const readmePath = path.join(args.repository_path, "README.md");
                        const readmeContent = `# Project\n\nDescription of your project.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\nDescribe how to use your project.\n\n## License\n\nMIT\n`;
                        await fs.writeFile(readmePath, readmeContent);
                        autoFixResults.push(`✅ Created README.md`);
                    }
                    // Add more auto-fixes as needed
                } catch (error) {
                    autoFixResults.push(
                        `❌ Failed to apply: ${suggestion.title} - ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }

        const report = `# Improvement Suggestions\n\n${suggestions.map((s, i) => `## ${i + 1}. ${s.title}\n**Priority**: ${s.priority}\n**Category**: ${s.category}\n**Auto-fixable**: ${s.autoFixable ? "Yes" : "No"}\n\n${s.description}\n${s.files ? `\n**Affected files**: ${s.files.join(", ")}` : ""}`).join("\n\n")}${autoFixResults.length > 0 ? `\n\n## Auto-Fix Results\n${autoFixResults.join("\n")}` : ""}`;

        return {
            content: [
                {
                    type: "text",
                    text: report,
                },
            ],
        };
    }

    private async handleAnalyzeGitHistory(args: { repository_path: string; commit_limit?: number }): Promise<CallToolResult> {
        const { GitAnalyzer } = await import("./git-analyzer.js");
        const analyzer = new GitAnalyzer(args.repository_path);
        const analysis = await analyzer.analyze(args.commit_limit || 100);

        if (!analysis.isGitRepository) {
            return {
                content: [
                    {
                        type: "text",
                        text: "This directory is not a Git repository.",
                    },
                ],
            };
        }

        const report = `# Git History Analysis

## Summary
- **Total Commits**: ${analysis.totalCommits}
- **Contributors**: ${analysis.authors.length}
- **Branches**: ${analysis.branches.length}
- **Commit Message Quality**: ${analysis.commitMessageQuality.score.toFixed(1)}/100

## Top Contributors
${analysis.authors.slice(0, 5).map((author, i) => `${i + 1}. **${author.name}** (${author.email})
   - Commits: ${author.commits}
   - Lines Added: +${author.linesAdded}
   - Lines Deleted: -${author.linesDeleted}
   - Active: ${author.firstCommit.toLocaleDateString()} to ${author.lastCommit.toLocaleDateString()}`).join("\n\n")}

## Hot Spots (Most Changed Files)
${analysis.hotSpots.slice(0, 10).map((spot, i) => `${i + 1}. \`${spot.file}\`
   - Changes: ${spot.changeCount}
   - Authors: ${spot.authors.length}
   - Last Modified: ${spot.lastModified.toLocaleDateString()}`).join("\n\n")}

## Recent Commits
${analysis.recentCommits.slice(0, 10).map((commit) => `- **${commit.hash.substring(0, 7)}** by ${commit.author} (${commit.date.toLocaleDateString()})
  ${commit.message.split("\n")[0]}
  Files: ${commit.filesChanged}, +${commit.insertions}/-${commit.deletions}`).join("\n\n")}

## Commit Message Quality
- **Score**: ${analysis.commitMessageQuality.score.toFixed(1)}/100
- **Good Practices**: ${analysis.commitMessageQuality.goodPractices}/${analysis.commitMessageQuality.totalMessages}
${analysis.commitMessageQuality.issues.length > 0 ? `\n**Issues Found**:\n${analysis.commitMessageQuality.issues.slice(0, 5).map((issue) => `- ${issue}`).join("\n")}` : ""}

## Detailed Data
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\``;

        return {
            content: [
                {
                    type: "text",
                    text: report,
                },
            ],
        };
    }

    private async handleScanVulnerabilities(args: { repository_path: string }): Promise<CallToolResult> {
        const { VulnerabilityScanner } = await import("./vulnerability-scanner.js");
        const scanner = new VulnerabilityScanner(args.repository_path);
        const report = await scanner.scan();

        if (!report.hasVulnerabilities) {
            return {
                content: [
                    {
                        type: "text",
                        text: "✅ No vulnerabilities found! Your dependencies are secure.",
                    },
                ],
            };
        }

        const summary = report.summary;
        const reportText = `# Security Vulnerability Report

## Summary
- **Total Vulnerabilities**: ${summary.total}
- 🔴 **Critical**: ${summary.critical}
- 🟠 **High**: ${summary.high}
- 🟡 **Moderate**: ${summary.moderate}
- 🔵 **Low**: ${summary.low}
- ℹ️ **Info**: ${summary.info}

## Vulnerabilities

${report.vulnerabilities.map((vuln, i) => {
            const emoji = vuln.severity === "critical" ? "🔴" : vuln.severity === "high" ? "🟠" : vuln.severity === "moderate" ? "🟡" : vuln.severity === "low" ? "🔵" : "ℹ️";
            return `### ${i + 1}. ${emoji} ${vuln.name} (${vuln.severity})

**${vuln.title}**

${vuln.description}

- **Affected Version**: ${vuln.version}
- **Fix Available**: ${vuln.fixAvailable ? "✅ Yes" : "❌ No"}
${vuln.recommendedVersion ? `- **Recommended Version**: ${vuln.recommendedVersion}` : ""}
${vuln.cves.length > 0 ? `- **CVEs**: ${vuln.cves.join(", ")}` : ""}
${vuln.url ? `- **More Info**: ${vuln.url}` : ""}`;
        }).join("\n\n")}

## Detailed Data
\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\``;

        return {
            content: [
                {
                    type: "text",
                    text: reportText,
                },
            ],
        };
    }

    private async handleAnalyzeCoverage(args: { repository_path: string }): Promise<CallToolResult> {
        const { CoverageAnalyzer } = await import("./coverage-analyzer.js");
        const analyzer = new CoverageAnalyzer(args.repository_path);
        const report = await analyzer.analyze();

        if (!report.hasCoverage) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No coverage reports found. Please run your tests with coverage enabled (e.g., `npm test -- --coverage`).",
                    },
                ],
            };
        }

        const summary = report.summary;
        const reportText = `# Test Coverage Analysis

## Summary
- **Lines**: ${summary.lines.percentage}% (${summary.lines.covered}/${summary.lines.total})
- **Statements**: ${summary.statements.percentage}% (${summary.statements.covered}/${summary.statements.total})
- **Functions**: ${summary.functions.percentage}% (${summary.functions.covered}/${summary.functions.total})
- **Branches**: ${summary.branches.percentage}% (${summary.branches.covered}/${summary.branches.total})

## Coverage Status
${summary.lines.percentage >= 80 ? "✅ Excellent coverage!" : summary.lines.percentage >= 60 ? "⚠️ Good coverage, but could be improved" : "❌ Low coverage - needs attention"}

${report.untestedFiles.length > 0 ? `## Untested Files (${report.untestedFiles.length})
${report.untestedFiles.slice(0, 10).map((file) => `- \`${file}\``).join("\n")}
${report.untestedFiles.length > 10 ? `\n... and ${report.untestedFiles.length - 10} more` : ""}` : ""}

## Suggestions
${report.suggestions.map((suggestion, i) => {
            const emoji = suggestion.priority === "high" ? "🔴" : suggestion.priority === "medium" ? "🟡" : "🔵";
            return `${i + 1}. ${emoji} **${suggestion.file}**
   ${suggestion.message}
   Current Coverage: ${suggestion.currentCoverage}%`;
        }).join("\n\n")}

## Files with Lowest Coverage
${report.filesCoverage.slice(0, 10).map((file, i) => `${i + 1}. \`${file.file}\`
   - Lines: ${file.lines.percentage}%
   - Functions: ${file.functions.percentage}%
   - Branches: ${file.branches.percentage}%`).join("\n\n")}

## Detailed Data
\`\`\`json
${JSON.stringify(report, null, 2)}
\`\`\``;

        return {
            content: [
                {
                    type: "text",
                    text: reportText,
                },
            ],
        };
    }

    private async handleGeneratePRComment(args: {
        repository_path: string;
        format?: string;
        include_details?: boolean;
    }): Promise<CallToolResult> {
        const analyzer = new RepositoryAnalyzer(args.repository_path);
        const analysis = await analyzer.analyze();

        const comment = await analyzer.generatePRComment(analysis, {
            format: (args.format as "github" | "gitlab" | "markdown") || "github",
            includeDetails: args.include_details !== false,
        });

        return {
            content: [
                {
                    type: "text",
                    text: comment,
                },
            ],
        };
    }

    private async handleValidateCustomRules(args: { repository_path: string }): Promise<CallToolResult> {
        const { RuleEngine } = await import("./rule-engine.js");
        const engine = new RuleEngine(args.repository_path);

        await engine.loadCustomRules();
        const validation = await engine.validateRules();

        if (!validation.valid) {
            return {
                content: [
                    {
                        type: "text",
                        text: `# Rule Validation Failed\n\n**Errors:**\n${validation.errors.map((err) => `- ${err}`).join("\n")}`,
                    },
                ],
            };
        }

        const result = await engine.execute();

        const reportText = `# Custom Rules Validation Report

## Summary
- **Rules Executed**: ${result.rulesExecuted}
- **Total Violations**: ${result.summary.total}
- ❌ **Errors**: ${result.summary.errors}
- ⚠️ **Warnings**: ${result.summary.warnings}
- ℹ️ **Info**: ${result.summary.info}

## Active Rules
${engine.getRules().map((rule, i) => `${i + 1}. **${rule.name}** (${rule.id})
   - Severity: ${rule.severity}
   - Type: ${rule.type}
   ${rule.description ? `- ${rule.description}` : ""}`).join("\n\n")}

${result.violations.length > 0 ? `## Violations

${result.violations.map((violation, i) => {
            const emoji = violation.severity === "error" ? "❌" : violation.severity === "warning" ? "⚠️" : "ℹ️";
            return `### ${i + 1}. ${emoji} ${violation.ruleName}

**File**: \`${violation.file}\`${violation.line ? `:${violation.line}` : ""}
**Message**: ${violation.message}
${violation.suggestion ? `**Suggestion**: ${violation.suggestion}` : ""}`;
        }).join("\n\n")}` : "✅ No violations found!"}

## Detailed Data
\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\``;

        return {
            content: [
                {
                    type: "text",
                    text: reportText,
                },
            ],
        };
    }

    private async handleDbDescribeSchema(): Promise<CallToolResult> {
        try {
            const res = await this.dbPool.query(`
                SELECT 
                    table_name, 
                    column_name, 
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                ORDER BY table_name, ordinal_position
            `);

            const tables: Record<string, any[]> = {};
            res.rows.forEach(row => {
                const tableName = row.table_name as string;
                if (!tables[tableName]) tables[tableName] = [];
                tables[tableName].push({
                    column: row.column_name,
                    type: row.data_type,
                    nullable: row.is_nullable === 'YES'
                });
            });

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `# Database Schema\n\n\`\`\`json\n${JSON.stringify(tables, null, 2)}\n\`\`\``,
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Database error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleDbListUsers(): Promise<CallToolResult> {
        try {
            const res = await this.dbPool.query(`
                SELECT id, email, name, role, last_active_at, created_at 
                FROM "user"
                ORDER BY created_at DESC
            `);

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `# Registered Users\n\n| ID | Name | Email | Role | Last Active |\n|---|---|---|---|---|\n${res.rows.map(u => `| ${u.id} | ${u.name} | ${u.email} | ${u.role} | ${u.last_active_at ? new Date(u.last_active_at).toLocaleString() : 'Never'} |`).join('\n')}`,
                    },
                ],
            };
        } catch (error) {
            if (error instanceof Error && error.message.includes('relation "user" does not exist')) {
                return {
                    content: [{ type: "text" as const, text: "No users found. The 'user' table does not exist yet (Open-WebUI may still be initializing)." }]
                };
            }
            throw new Error(`Database error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleDbRunQuery(args: { sql: string }): Promise<CallToolResult> {
        if (!args.sql.trim().toLowerCase().startsWith("select")) {
            throw new Error("Only SELECT queries are allowed for safety reasons.");
        }

        try {
            const res = await this.dbPool.query(args.sql);
            return {
                content: [
                    {
                        type: "text" as const,
                        text: `# Query Results\n\n\`\`\`json\n${JSON.stringify(res.rows, null, 2)}\n\`\`\``,
                    },
                ],
            };
        } catch (error) {
            throw new Error(`SQL Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleDbSetUserRole(args: { email: string; role: string }): Promise<CallToolResult> {
        try {
            const res = await this.dbPool.query(
                'UPDATE "user" SET role = $1 WHERE email = $2 RETURNING id, email, role',
                [args.role, args.email]
            );

            if (res.rowCount === 0) {
                return {
                    content: [{ type: "text" as const, text: `User with email ${args.email} not found.` }]
                };
            }

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `✅ Successfully updated role for ${args.email} to ${args.role}.\n\n\`\`\`json\n${JSON.stringify(res.rows[0], null, 2)}\n\`\`\``,
                    },
                ],
            };
        } catch (error) {
            throw new Error(`Database error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }


    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("vLLM MCP Server running on stdio");
        console.error(`Connected to vLLM at: ${this.vllmBaseUrl}`);
    }
}

export { VLLMServer };

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const server = new VLLMServer();
    server.run().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}
