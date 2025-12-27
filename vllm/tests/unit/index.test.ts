import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

// Mock fetch
const mockFetch: any = jest.fn();
global.fetch = mockFetch;

// Mock dependencies
jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: (jest.fn() as any).mockImplementation(() => ({
        setRequestHandler: jest.fn(),
        connect: (jest.fn() as any).mockResolvedValue(undefined),
        close: (jest.fn() as any).mockResolvedValue(undefined),
    })),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
    StdioServerTransport: jest.fn(),
}));

jest.unstable_mockModule('../../src/repository-analyzer.js', () => ({
    RepositoryAnalyzer: jest.fn().mockImplementation(() => ({
        analyze: (jest.fn() as any).mockResolvedValue({
            score: 85,
            structure: { totalFiles: 10, totalSize: 1024 * 1024, filesByExtension: {} },
            issues: [],
            suggestions: [],
        }),
        generatePRComment: (jest.fn() as any).mockResolvedValue("Mock PR Comment"),
    })),
}));

jest.unstable_mockModule('../../src/git-analyzer.js', () => ({
    GitAnalyzer: jest.fn().mockImplementation(() => ({
        analyze: (jest.fn() as any).mockResolvedValue({
            isGitRepository: true,
            totalCommits: 100,
            authors: [],
            branches: [],
            commitMessageQuality: {
                score: 90,
                goodPractices: 90,
                totalMessages: 100,
                issues: []
            },
            hotSpots: [],
            recentCommits: []
        }),
    })),
}));

jest.unstable_mockModule('../../src/vulnerability-scanner.js', () => ({
    VulnerabilityScanner: jest.fn().mockImplementation(() => ({
        scan: (jest.fn() as any).mockResolvedValue({
            hasVulnerabilities: false,
            summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
            vulnerabilities: [],
            outdatedDependencies: []
        }),
    })),
}));

jest.unstable_mockModule('../../src/coverage-analyzer.js', () => ({
    CoverageAnalyzer: jest.fn().mockImplementation(() => ({
        analyze: (jest.fn() as any).mockResolvedValue({
            hasCoverage: true,
            summary: {
                lines: { percentage: 80, covered: 80, total: 100 },
                statements: { percentage: 80, covered: 80, total: 100 },
                functions: { percentage: 80, covered: 80, total: 100 },
                branches: { percentage: 80, covered: 80, total: 100 }
            },
            files: [],
            untestedFiles: [],
            suggestions: [],
            filesCoverage: []
        }),
    })),
}));

jest.unstable_mockModule('../../src/rule-engine.js', () => ({
    RuleEngine: jest.fn().mockImplementation(() => ({
        execute: (jest.fn() as any).mockResolvedValue({ violations: [], summary: { total: 0 } }),
        loadCustomRules: (jest.fn() as any).mockResolvedValue(undefined),
        validateRules: (jest.fn() as any).mockResolvedValue({ valid: true, rules: [] }),
        getRules: (jest.fn() as any).mockReturnValue([]),
    })),
}));

jest.unstable_mockModule('../../src/pr-comment-generator.js', () => ({
    PRCommentGenerator: jest.fn().mockImplementation(() => ({
        generate: (jest.fn() as any).mockResolvedValue("Mock PR Comment"),
    })),
}));

// Helper to bypass TS for mocks
const mock = (fn: any) => fn as unknown as jest.Mock<any>;

jest.unstable_mockModule('fs/promises', () => ({
    readFile: (jest.fn() as any).mockResolvedValue("Mock File Content"),
    writeFile: (jest.fn() as any).mockResolvedValue(undefined),
}));

const mockDbPool = {
    query: jest.fn(),
    on: jest.fn(),
};

jest.unstable_mockModule('pg', () => ({
    default: {
        Pool: jest.fn(() => mockDbPool),
    }
}));

jest.unstable_mockModule('path', () => ({
    join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

const mockSpawn: any = jest.fn();
const mockChildProcess: any = {
    on: jest.fn(),
    stdout: {
        on: jest.fn(),
    },
    stderr: {
        on: jest.fn(),
    },
    stdin: {
        write: jest.fn(),
    },
};
mockSpawn.mockReturnValue(mockChildProcess);

jest.unstable_mockModule('child_process', () => ({
    spawn: mockSpawn,
    ChildProcess: jest.fn(),
}));

const mockReadlineInterface: any = {
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn(),
};

jest.unstable_mockModule('readline', () => ({
    createInterface: jest.fn(() => mockReadlineInterface),
}));

const { VLLMServer } = await import('../../src/index.js');
const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

describe("VLLMServer", () => {
    let server: any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
        mock(mockDbPool.query).mockResolvedValue({ rows: [], rowCount: 0 } as any);
        server = new VLLMServer();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize with correct name and version", () => {
        expect(Server).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "vllm-mcp-server",
            }),
            expect.anything()
        );
    });

    it("should handle chat_completion", async () => {
        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Hello from vLLM" } }]
            })
        });

        const result = await server.handleChatCompletion({
            messages: [{ role: "user", content: "Hi" }]
        });

        expect(result.content[0].text).toBe("Hello from vLLM");
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/v1/chat/completions"),
            expect.objectContaining({
                method: "POST",
                body: expect.stringContaining('"role":"user"')
            })
        );
    });

    it("should handle completion", async () => {
        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ text: "Completion text" }]
            })
        });

        const result = await server.handleCompletion({
            prompt: "Once upon a time"
        });

        expect(result.content[0].text).toBe("Completion text");
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/v1/completions"),
            expect.anything()
        );
    });

    it("should handle list_models", async () => {
        const mockModels = { data: [{ id: "model-1" }] };
        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockModels
        });

        const result = await server.handleListModels();

        expect(result.content[0].text).toContain("model-1");
    });

    it("should handle API error", async () => {
        (mockFetch as any).mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "Internal Server Error"
        });

        await expect(server.handleChatCompletion({ messages: [] }))
            .rejects.toThrow("vLLM API error (500): Internal Server Error");
    });

    it("should handle analyze_repository", async () => {
        const result = await server.handleAnalyzeRepository({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Repository Analysis Report");
        expect(result.content[0].text).toContain("85/100");
    });

    it("should handle suggest_improvements", async () => {
        const result = await server.handleSuggestImprovements({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Improvement Suggestions");
    });

    it("should handle generate_pr_comment", async () => {
        const result = await server.handleGeneratePRComment({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Mock PR Comment");
    });

    it("should handle analyze_git_history", async () => {
        // First we need to mock the dynamic import in index.ts
        // index.ts: const { GitAnalyzer } = await import("./git-analyzer.js");
        const result = await server.handleAnalyzeGitHistory({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Git History Analysis");
    });

    it("should handle scan_vulnerabilities", async () => {
        const result = await server.handleScanVulnerabilities({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("No vulnerabilities found");
    });

    it("should handle check_guidelines", async () => {
        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Guideline report" } }]
            })
        });

        const result = await server.handleCheckGuidelines({ repository_path: "/test/path" });
        expect(result.content[0].text).toBe("Guideline report");
    });

    it("should handle analyze_coverage", async () => {
        const result = await server.handleAnalyzeCoverage({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Test Coverage Analysis");
    });

    it("should handle validate_custom_rules", async () => {
        const result = await server.handleValidateCustomRules({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Custom Rules Validation Report");
    });

    it("should handle validate_custom_rules failure", async () => {
        const { RuleEngine } = await import('../../src/rule-engine.js');
        mock(RuleEngine).mockImplementationOnce(() => ({
            loadCustomRules: (jest.fn() as any).mockResolvedValue(undefined),
            validateRules: (jest.fn() as any).mockResolvedValue({ valid: false, errors: ["Invalid rule"] }),
            getRules: (jest.fn() as any).mockReturnValue([]),
        }));

        const result = await server.handleValidateCustomRules({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Rule Validation Failed");
        expect(result.content[0].text).toContain("Invalid rule");
    });

    it("should handle suggest_improvements with auto_fix", async () => {
        const { RepositoryAnalyzer } = await import('../../src/repository-analyzer.js');
        mock(RepositoryAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                suggestions: [{ title: "Add README.md", category: "documentation", priority: "high", autoFixable: true, description: "Add it" }],
                score: 50,
                structure: { totalFiles: 0, totalSize: 0, filesByExtension: {} },
                issues: []
            }),
        }));

        const result = await server.handleSuggestImprovements({ repository_path: "/test/path", auto_fix: true });
        expect(result.content[0].text).toContain("Auto-Fix Results");
        expect(result.content[0].text).toContain("✅ Created README.md");
    });

    it("should handle suggest_improvements with category filter", async () => {
        const { RepositoryAnalyzer } = await import('../../src/repository-analyzer.js');
        mock(RepositoryAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                suggestions: [
                    { title: "Add README.md", category: "documentation", priority: "high", autoFixable: true, description: "Add it" },
                    { title: "Add Tests", category: "testing", priority: "medium", autoFixable: false, description: "Add tests" }
                ],
                score: 50,
                structure: { totalFiles: 0, totalSize: 0, filesByExtension: {} },
                issues: []
            }),
        }));

        const result = await server.handleSuggestImprovements({ repository_path: "/test/path", categories: ["testing"] });
        expect(result.content[0].text).toContain("Add Tests");
        expect(result.content[0].text).not.toContain("Add README.md");
    });

    it("should handle check_guidelines with missing file", async () => {
        const fs = await import('fs/promises');
        mock(fs.readFile).mockRejectedValueOnce(new Error("File not found"));

        const result = await server.handleCheckGuidelines({ repository_path: "/test/path", guidelines_file: "NONEXISTENT.md" });
        expect(result.content[0].text).toContain("No guidelines file found");
    });

    it("should handle analyze_git_history for non-git repo", async () => {
        const { GitAnalyzer } = await import('../../src/git-analyzer.js');
        mock(GitAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({ isGitRepository: false }),
        }));

        const result = await server.handleAnalyzeGitHistory({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("not a Git repository");
    });

    it("should handle analyze_coverage with no coverage records", async () => {
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        mock(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({ hasCoverage: false }),
        }));

        const result = await server.handleAnalyzeCoverage({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("No coverage reports found");
    });

    it("should handle scan_vulnerabilities with vulnerabilities found", async () => {
        const { VulnerabilityScanner } = await import('../../src/vulnerability-scanner.js');
        mock(VulnerabilityScanner).mockImplementationOnce(() => ({
            scan: (jest.fn() as any).mockResolvedValue({
                hasVulnerabilities: true,
                summary: { total: 1, critical: 1, high: 0, moderate: 0, low: 0, info: 0 },
                vulnerabilities: [{
                    name: "test-vuln",
                    severity: "critical",
                    title: "Critical Vuln",
                    description: "Bad stuff",
                    version: "1.0.0",
                    fixAvailable: true,
                    cves: ["CVE-123"],
                }],
                outdatedDependencies: []
            }),
        }));

        const result = await server.handleScanVulnerabilities({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Security Vulnerability Report");
        expect(result.content[0].text).toContain("test-vuln");
    });

    it("should handle review_code_with_ai", async () => {
        const fs = await import('fs/promises');
        mock(fs.readFile).mockResolvedValueOnce("some code");

        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Code review feedback" } }]
            })
        });

        const result = await server.handleReviewCodeWithAI({ file_path: "test.ts", focus_areas: ["security"] });
        expect(result.content[0].text).toBe("Code review feedback");
    });

    it("should dispatch tools correctly", async () => {
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;
        const setRequestHandler = mock(latestServer.setRequestHandler);

        // Find the CallToolRequest handler by looking for a handler that includes 'switch (name)' in its source
        const callToolHandler: any = setRequestHandler.mock.calls.find(
            (call: any) => call[1].toString().includes('switch (name)')
        )?.[1];

        expect(callToolHandler).toBeDefined();

        // Mock a tool call
        const result = await callToolHandler({
            params: {
                name: "chat_completion",
                arguments: { messages: [{ role: "user", content: "Hi" }] }
            }
        });

        expect(result.content).toBeDefined();
    });

    it("should handle unknown tool in dispatcher", async () => {
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;
        const setRequestHandler = mock(latestServer.setRequestHandler);

        const callToolHandler: any = setRequestHandler.mock.calls.find(
            (call: any) => call[1].toString().includes('switch (name)')
        )?.[1];

        const result = await callToolHandler({
            params: {
                name: "unknown_tool",
                arguments: {}
            }
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown tool: unknown_tool");
    });

    it("should handle all registered tools in dispatcher", async () => {
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;
        const setRequestHandler = mock(latestServer.setRequestHandler);

        const callToolHandler: any = setRequestHandler.mock.calls.find(
            (call: any) => call[1].toString().includes('switch (name)')
        )?.[1];

        const tools = [
            { name: "chat_completion", args: { messages: [] } },
            { name: "completion", args: { prompt: "test" } },
            { name: "list_models", args: {} },
            { name: "analyze_repository", args: { repository_path: "/test" } },
            { name: "review_code_with_ai", args: { file_path: "/test/file.ts" } },
            { name: "check_guidelines", args: { repository_path: "/test" } },
            { name: "suggest_improvements", args: { repository_path: "/test" } },
            { name: "analyze_git_history", args: { repository_path: "/test" } },
            { name: "scan_vulnerabilities", args: { repository_path: "/test" } },
            { name: "analyze_coverage", args: { repository_path: "/test" } },
            { name: "generate_pr_comment", args: { repository_path: "/test" } },
            { name: "db_describe_schema", args: {} },
            { name: "db_list_users", args: {} },
            { name: "db_run_query", args: { sql: "SELECT * FROM users" } },
            { name: "db_set_user_role", args: { email: "test@example.com", role: "admin" } },
        ];

        for (const tool of tools) {
            const result = await callToolHandler({
                params: {
                    name: tool.name,
                    arguments: tool.args
                }
            });
            expect(result.isError).toBeUndefined();
        }
    });

    it("should handle Authorization header when VLLM_API_KEY is set", async () => {
        // We need to bypass the constructor or set the env before
        process.env.VLLM_API_KEY = "test-key";
        const serverWithKey = new VLLMServer();

        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: "Ok" } }] })
        });

        await (serverWithKey as any).handleChatCompletion({ messages: [] });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "Authorization": "Bearer test-key"
                })
            })
        );
        delete process.env.VLLM_API_KEY;
    });

    it("should handle db_describe_schema", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rows: [
                { table_name: "users", column_name: "id", data_type: "integer", is_nullable: "NO" },
                { table_name: "users", column_name: "email", data_type: "text", is_nullable: "NO" },
            ]
        } as any);

        const result = await server.handleDbDescribeSchema();
        expect(result.content[0].text).toContain("users");
        expect(result.content[0].text).toContain("email");
    });

    it("should handle db_list_users", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rows: [
                { id: 1, name: "Admin", email: "admin@example.com", role: "admin", created_at: new Date() },
            ]
        } as any);

        const result = await server.handleDbListUsers();
        expect(result.content[0].text).toContain("admin@example.com");
    });

    it("should handle db_list_users when table does not exist", async () => {
        mock(mockDbPool.query).mockRejectedValueOnce(new Error('relation "user" does not exist') as any);

        const result = await server.handleDbListUsers();
        expect(result.content[0].text).toContain("No users found");
    });

    it("should handle db_run_query", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rows: [{ count: 10 }]
        } as any);

        const result = await server.handleDbRunQuery({ sql: "SELECT count(*) FROM users" });
        expect(result.content[0].text).toContain("10");
    });

    it("should reject non-SELECT queries", async () => {
        await expect(server.handleDbRunQuery({ sql: "DROP TABLE users" }))
            .rejects.toThrow("Only SELECT queries are allowed");
    });

    it("should handle db_set_user_role", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id: 1, email: "user@example.com", role: "admin" }]
        } as any);

        const result = await server.handleDbSetUserRole({ email: "user@example.com", role: "admin" });
        expect(result.content[0].text).toContain("Successfully updated role");
    });

    it("should handle db_set_user_role user not found", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rowCount: 0,
            rows: []
        } as any);

        const result = await server.handleDbSetUserRole({ email: "nonexistent@example.com", role: "admin" });
        expect(result.content[0].text).toContain("not found");
    });

    it("should handle server run", async () => {
        await server.run();
        // Should connect transport
    });

    it("should handle SIGINT", async () => {
        const processOnSpy = jest.spyOn(process, 'on').mockImplementation((event: any, handler: any) => {
            if (event === 'SIGINT') {
                handler();
            }
            return process;
        });
        const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });

        // Re-initialize to trigger setupErrorHandling
        const newServer = new VLLMServer();

        // Give it some time to run the async handler
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        // handler was called by our mock spy
        expect(processExitSpy).toHaveBeenCalledWith(0);

        processOnSpy.mockRestore();
        processExitSpy.mockRestore();
    });

    it("should handle server error", async () => {
        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;

        expect(latestServer.onerror).toBeDefined();
        // Just call it to ensure coverage
        latestServer.onerror(new Error("Test Error"));
    });

    it("should handle db_describe_schema error", async () => {
        mock(mockDbPool.query).mockRejectedValueOnce(new Error("DB Error"));
        await expect(server.handleDbDescribeSchema()).rejects.toThrow("Database error: DB Error");
    });

    it("should handle db_list_users general error", async () => {
        mock(mockDbPool.query).mockRejectedValueOnce(new Error("DB Error"));
        await expect(server.handleDbListUsers()).rejects.toThrow("Database error: DB Error");
    });

    it("should handle db_run_query error", async () => {
        mock(mockDbPool.query).mockRejectedValueOnce(new Error("SQL Error"));
        await expect(server.handleDbRunQuery({ sql: "SELECT * FROM users" })).rejects.toThrow("SQL Error: SQL Error");
    });

    it("should handle db_set_user_role error", async () => {
        mock(mockDbPool.query).mockRejectedValueOnce(new Error("DB Error"));
        await expect(server.handleDbSetUserRole({ email: "test@example.com", role: "admin" })).rejects.toThrow("Database error: DB Error");
    });

    it("should handle analyze_coverage with excellent coverage", async () => {
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        mock(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                hasCoverage: true,
                summary: {
                    lines: { percentage: 90, covered: 90, total: 100 },
                    statements: { percentage: 90, covered: 90, total: 100 },
                    functions: { percentage: 90, covered: 90, total: 100 },
                    branches: { percentage: 90, covered: 90, total: 100 }
                },
                suggestions: [],
                filesCoverage: [],
                untestedFiles: []
            }),
        }));
        const result = await server.handleAnalyzeCoverage({ repository_path: "/test" });
        expect(result.content[0].text).toContain("Excellent coverage!");
    });

    it("should handle analyze_coverage with low coverage", async () => {
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        mock(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                hasCoverage: true,
                summary: {
                    lines: { percentage: 40, covered: 40, total: 100 },
                    statements: { percentage: 40, covered: 40, total: 100 },
                    functions: { percentage: 40, covered: 40, total: 100 },
                    branches: { percentage: 40, covered: 40, total: 100 }
                },
                suggestions: [],
                filesCoverage: [],
                untestedFiles: []
            }),
        }));
        const result = await server.handleAnalyzeCoverage({ repository_path: "/test" });
        expect(result.content[0].text).toContain("Low coverage - needs attention");
    });

    it("should handle mcp_add success", async () => {
        // Mock docker pull
        mockSpawn.mockImplementationOnce((cmd: string, args: string[]) => {
            if (args[0] === "pull") {
                return {
                    on: (event: string, cb: any) => { if (event === "close") cb(0); }
                };
            }
            return mockChildProcess;
        });

        // Mock tool discovery
        mockReadlineInterface.on.mockImplementation((event: string, cb: any) => {
            if (event === "line") {
                cb(JSON.stringify({
                    id: 1, // This might need to match Date.now() but let's see
                    result: { tools: [{ name: "test_tool", description: "test desc", inputSchema: {} }] }
                }));
            }
        });

        // Mock the requestId in handleMcpAdd
        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1);

        const result = await server.handleMcpAdd({ name: "test-server", image: "test-image" });
        expect(result.content[0].text).toContain("Successfully added 1 tools");
        dateSpy.mockRestore();
    });

    it("should handle mcp_add already added", async () => {
        // Manually add to dynamicServers
        (server as any).dynamicServers.set("test-server", {});
        await expect(server.handleMcpAdd({ name: "test-server" })).rejects.toThrow("Server 'test-server' is already added");
    });

    it("should handle mcp_add pull failure", async () => {
        mockSpawn.mockImplementationOnce((cmd: string, args: string[]) => {
            return {
                on: (event: string, cb: any) => { if (event === "close") cb(1); }
            };
        });

        await expect(server.handleMcpAdd({ name: "fail-server" })).rejects.toThrow("Docker pull failed with code 1");
    });

    it("should handle mcp_list", async () => {
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            image: "test-image",
            status: "running",
            tools: [{ name: "t1" }],
            error: null
        });

        const result = await server.handleMcpList();
        expect(result.content[0].text).toContain("test-server");
        expect(result.content[0].text).toContain("running");
    });

    it("should handle handleDynamicToolCall", async () => {
        const mockProc: any = {
            stdin: { write: jest.fn() },
            stdout: { on: jest.fn() }
        };
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            status: "running",
            process: mockProc
        });

        mockReadlineInterface.on.mockImplementationOnce((event: string, cb: any) => {
            if (event === "line") {
                cb(JSON.stringify({
                    id: 1,
                    result: { content: [{ type: "text", text: "dynamic result" }] }
                }));
            }
        });

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1);
        const result = await server.handleDynamicToolCall("test-server", "tool", {});
        expect(result.content[0].text).toBe("dynamic result");
        dateSpy.mockRestore();
    });

    it("should handle handleDynamicToolCall for non-running server", async () => {
        (server as any).dynamicServers.set("test-server", { status: "stopped" });
        await expect(server.handleDynamicToolCall("test-server", "tool", {}))
            .rejects.toThrow("Server 'test-server' is not running");
    });

    it("should handle handleDynamicToolCall timeout", async () => {
        const mockProc: any = {
            stdin: { write: jest.fn() },
            stdout: { on: jest.fn() }
        };
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            status: "running",
            process: mockProc
        });

        jest.useFakeTimers();
        const callPromise = server.handleDynamicToolCall("test-server", "tool", {});
        jest.advanceTimersByTime(31000);
        await expect(callPromise).rejects.toThrow("Timeout calling tool 'tool'");
        jest.useRealTimers();
    });

    it("should handle suggest_improvements auto-fix failure", async () => {
        const { RepositoryAnalyzer } = await import('../../src/repository-analyzer.js');
        mock(RepositoryAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                suggestions: [{ title: "Add README.md", category: "documentation", priority: "high", autoFixable: true, description: "Add it" }],
                score: 50,
                structure: { totalFiles: 0, totalSize: 0, filesByExtension: {} },
                issues: []
            }),
        }));

        const fs = await import('fs/promises');
        mock(fs.writeFile).mockRejectedValueOnce(new Error("Write Error"));

        const result = await server.handleSuggestImprovements({ repository_path: "/test", auto_fix: true });
        expect(result.content[0].text).toContain("❌ Failed to apply: Add README.md - Write Error");
    });

    it("should handle generate_pr_comment in gitlab format", async () => {
        const result = await server.handleGeneratePRComment({ repository_path: "/test", format: "gitlab" });
        expect(result.content[0].text).toContain("Mock PR Comment");
    });

    it("should list dynamic tools", async () => {
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            status: "running",
            tools: [{ name: "tool1", description: "desc1", inputSchema: {} }]
        });

        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;
        const setRequestHandler = mock(latestServer.setRequestHandler);

        const listToolsHandler: any = setRequestHandler.mock.calls.find(
            (call: any) => call[0] === ListToolsRequestSchema
        )?.[1];

        const result = await listToolsHandler();
        expect(result.tools.some((t: any) => t.name === "test-server__tool1")).toBe(true);
    });

    it("should handle review_code_with_ai without focus areas or context", async () => {
        const fs = await import('fs/promises');
        mock(fs.readFile).mockResolvedValueOnce("some code");

        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Code review feedback" } }]
            })
        });

        const result = await server.handleReviewCodeWithAI({ file_path: "test.ts" });
        expect(result.content[0].text).toBe("Code review feedback");
    });

    it("should handle check_guidelines with default README.md", async () => {
        (mockFetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Guideline report" } }]
            })
        });

        const result = await server.handleCheckGuidelines({ repository_path: "/test/path" });
        expect(result.content[0].text).toBe("Guideline report");
    });

    it("should handle analyze_coverage with many untested files", async () => {
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        mock(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                hasCoverage: true,
                summary: {
                    lines: { percentage: 50, covered: 50, total: 100 },
                    statements: { percentage: 50, covered: 50, total: 100 },
                    functions: { percentage: 50, covered: 50, total: 100 },
                    branches: { percentage: 50, covered: 50, total: 100 }
                },
                suggestions: [],
                filesCoverage: [],
                untestedFiles: Array(15).fill(0).map((_, i) => `file${i}.ts`)
            }),
        }));
        const result = await server.handleAnalyzeCoverage({ repository_path: "/test" });
        expect(result.content[0].text).toContain("Untested Files (15)");
        expect(result.content[0].text).toContain("... and 5 more");
    });

    it("should handle validate_custom_rules with different severities", async () => {
        const { RuleEngine } = await import('../../src/rule-engine.js');
        mock(RuleEngine).mockImplementationOnce(() => ({
            loadCustomRules: (jest.fn() as any).mockResolvedValue(undefined),
            validateRules: (jest.fn() as any).mockResolvedValue({ valid: true, rules: [] }),
            getRules: (jest.fn() as any).mockReturnValue([]),
            execute: (jest.fn() as any).mockResolvedValue({
                rulesExecuted: 1,
                summary: { total: 2, errors: 0, warnings: 1, info: 1 },
                violations: [
                    { ruleName: "Rule1", severity: "warning", file: "f1.ts", message: "m1", suggestion: "s1" },
                    { ruleName: "Rule2", severity: "info", file: "f2.ts", message: "m2" }
                ]
            }),
        }));

        const result = await server.handleValidateCustomRules({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("⚠️ Rule1");
        expect(result.content[0].text).toContain("ℹ️ Rule2");
    });

    it("should handle generate_pr_comment in markdown format", async () => {
        const result = await server.handleGeneratePRComment({ repository_path: "/test", format: "markdown", include_details: false });
        expect(result.content[0].text).toContain("Mock PR Comment");
    });

    it("should handle mcp_add with environment variables", async () => {
        mockSpawn.mockImplementation((cmd: any, args: any) => {
            if (args[0] === "pull") {
                return { on: (event: string, cb: any) => { if (event === "close") cb(0); } };
            }
            return {
                on: (event: string, cb: any) => { if (event === "close") cb(0); },
                stdout: { on: jest.fn() },
                stderr: { on: (event: string, cb: any) => { } },
                stdin: { write: jest.fn() }
            };
        });

        mockReadlineInterface.on.mockImplementation((event: string, cb: any) => {
            if (event === "line") {
                cb(JSON.stringify({ id: 1, result: { tools: [] } }));
            }
        });

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1);
        process.env.DOCKERHUB_PAT_TOKEN = "token1";
        process.env.GIT_Pers_acc = "token2";

        await server.handleMcpAdd({ name: "dockerhub", env: { CUSTOM_VAR: "value" } });

        const lastSpawnArgs = mockSpawn.mock.calls[mockSpawn.mock.calls.length - 1][1];
        expect(lastSpawnArgs).toContain("DOCKERHUB_PAT_TOKEN=token1");
        expect(lastSpawnArgs).toContain("GITHUB_PERSONAL_ACCESS_TOKEN=token2");
        expect(lastSpawnArgs).toContain("CUSTOM_VAR=value");

        delete process.env.DOCKERHUB_PAT_TOKEN;
        delete process.env.GIT_Pers_acc;
        dateSpy.mockRestore();
    });

    it("should dispatch call to dynamic tool", async () => {
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            status: "running",
            process: {
                stdin: { write: jest.fn() },
                stdout: { on: jest.fn() }
            },
            tools: [{ name: "tool1" }]
        });

        mockReadlineInterface.on.mockImplementationOnce((event: string, cb: any) => {
            if (event === "line") {
                cb(JSON.stringify({
                    id: 1,
                    result: { content: [{ type: "text", text: "dynamic result" }] }
                }));
            }
        });

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1);

        const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
        const latestServer = mock(Server).mock.results[mock(Server).mock.results.length - 1].value;
        const callToolHandler: any = mock(latestServer.setRequestHandler).mock.calls.find(
            (call: any) => call[1].toString().includes('switch (name)')
        )?.[1];

        const result = await callToolHandler({
            params: {
                name: "test-server__tool1",
                arguments: {}
            }
        });

        expect(result.content[0].text).toBe("dynamic result");
        dateSpy.mockRestore();
    });

    it("should handle validate_custom_rules with rule list", async () => {
        const { RuleEngine } = await import('../../src/rule-engine.js');
        mock(RuleEngine).mockImplementationOnce(() => ({
            loadCustomRules: (jest.fn() as any).mockResolvedValue(undefined),
            validateRules: (jest.fn() as any).mockResolvedValue({ valid: true, rules: [] }),
            getRules: (jest.fn() as any).mockReturnValue([
                { id: "R1", name: "Rule 1", severity: "error", type: "file_presence", description: "Desc 1" }
            ]),
            execute: (jest.fn() as any).mockResolvedValue({
                rulesExecuted: 1,
                summary: { total: 0, errors: 0, warnings: 0, info: 0 },
                violations: []
            }),
        }));

        const result = await server.handleValidateCustomRules({ repository_path: "/test/path" });
        expect(result.content[0].text).toContain("Rule 1");
        expect(result.content[0].text).toContain("Desc 1");
    });

    it("should handle db_describe_schema with nullable columns", async () => {
        mock(mockDbPool.query).mockResolvedValueOnce({
            rows: [
                { table_name: "users", column_name: "otp", data_type: "text", is_nullable: "YES" },
            ]
        } as any);

        const result = await server.handleDbDescribeSchema();
        expect(result.content[0].text).toContain('"nullable": true');
    });

    it("should handle db_list_users with last_active_at", async () => {
        const now = new Date();
        mock(mockDbPool.query).mockResolvedValueOnce({
            rows: [
                { id: 1, name: "User", email: "user@example.com", role: "user", created_at: now, last_active_at: now },
            ]
        } as any);

        const result = await server.handleDbListUsers();
        expect(result.content[0].text).toContain(now.toLocaleString());
    });

    it("should handle mcp_add with non-json line and wrong request id", async () => {
        mockSpawn.mockImplementation((cmd: string, args: string[]) => {
            if (args[0] === "pull") return { on: (ev: string, cb: any) => { if (ev === "close") cb(0); } };
            return mockChildProcess;
        });

        let lineCallback: any;
        mockReadlineInterface.on.mockImplementation((event: string, cb: any) => {
            if (event === "line") lineCallback = cb;
        });

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(100);

        const addPromise = server.handleMcpAdd({ name: "test" });

        // Give it a tiny bit of time to reach the rl.on call
        await new Promise(resolve => process.nextTick(resolve));

        if (lineCallback) {
            // Send invalid JSON
            lineCallback("not json");
            // Send wrong ID
            lineCallback(JSON.stringify({ id: 999, result: { tools: [] } }));
            // Send correct ID
            lineCallback(JSON.stringify({ id: 100, result: { tools: [{ name: "t" }] } }));
        }

        const result = await addPromise;
        expect(result.content[0].text).toContain("Successfully added 1 tools");
        dateSpy.mockRestore();
    });

    it("should handle analyze_coverage with files coverage details", async () => {
        const { CoverageAnalyzer } = await import('../../src/coverage-analyzer.js');
        mock(CoverageAnalyzer).mockImplementationOnce(() => ({
            analyze: (jest.fn() as any).mockResolvedValue({
                hasCoverage: true,
                summary: {
                    lines: { percentage: 80, covered: 80, total: 100 },
                    statements: { percentage: 80, covered: 80, total: 100 },
                    functions: { percentage: 80, covered: 80, total: 100 },
                    branches: { percentage: 80, covered: 80, total: 100 }
                },
                suggestions: [
                    { file: "low.ts", priority: "low", message: "low msg", currentCoverage: 10 },
                    { file: "med.ts", priority: "medium", message: "med msg", currentCoverage: 50 },
                ],
                untestedFiles: [],
                filesCoverage: [
                    {
                        file: "src/index.ts",
                        lines: { percentage: 50 },
                        functions: { percentage: 50 },
                        branches: { percentage: 50 }
                    }
                ]
            }),
        }));
        const result = await server.handleAnalyzeCoverage({ repository_path: "/test" });
        expect(result.content[0].text).toContain("🔵 **low.ts**");
        expect(result.content[0].text).toContain("🟡 **med.ts**");
    });

    it("should handle handleDynamicToolCall with non-json line", async () => {
        const mockProc: any = {
            stdin: { write: jest.fn() },
            stdout: { on: jest.fn() }
        };
        (server as any).dynamicServers.set("test-server", {
            name: "test-server",
            status: "running",
            process: mockProc
        });

        let lineCallback: any;
        mockReadlineInterface.on.mockImplementation((event: string, cb: any) => {
            if (event === "line") lineCallback = cb;
        });

        const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1);
        const callPromise = server.handleDynamicToolCall("test-server", "tool", {});

        await new Promise(resolve => process.nextTick(resolve));

        lineCallback("internal log");
        lineCallback(JSON.stringify({ id: 1, result: { content: [{ type: "text", text: "ok" }] } }));

        const result = await callPromise;
        expect(result.content[0].text).toBe("ok");
        dateSpy.mockRestore();
    });
});
