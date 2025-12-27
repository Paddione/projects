import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// Mock MCP SDK
const mockServerInstance = {
    setRequestHandler: jest.fn<any>(),
    onerror: jest.fn<any>(),
    connect: jest.fn<any>().mockResolvedValue(undefined),
    close: jest.fn<any>().mockResolvedValue(undefined),
};

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/index.js', () => ({
    Server: jest.fn<any>(() => mockServerInstance),
}));

jest.unstable_mockModule('@modelcontextprotocol/sdk/server/stdio.js', () => ({
    StdioServerTransport: jest.fn<any>(),
}));

// Mock analyzers dynamically imported in handlers
// We can assert they are instantiated when tools are called
jest.unstable_mockModule('../../src/repository-analyzer.js', () => ({
    RepositoryAnalyzer: jest.fn<any>().mockImplementation(() => ({
        analyze: jest.fn<any>().mockResolvedValue({
            score: 100,
            structure: { totalFiles: 10, totalSize: 1000, filesByExtension: {} },
            issues: [],
            suggestions: [],
            gitAnalysis: {},
            vulnerabilities: { hasVulnerabilities: false },
            coverage: { hasCoverage: true },
            ruleViolations: { violations: [], summary: {} }
        }),
    })),
}));

jest.unstable_mockModule('../../src/git-analyzer.js', () => ({
    GitAnalyzer: jest.fn<any>().mockImplementation(() => ({
        analyze: jest.fn<any>().mockResolvedValue({ isGitRepository: false }),
    })),
}));

jest.unstable_mockModule('../../src/vulnerability-scanner.js', () => ({
    VulnerabilityScanner: jest.fn<any>().mockImplementation(() => ({
        scan: jest.fn<any>().mockResolvedValue({ hasVulnerabilities: false }),
    })),
}));

jest.unstable_mockModule('../../src/coverage-analyzer.js', () => ({
    CoverageAnalyzer: jest.fn<any>().mockImplementation(() => ({
        analyze: jest.fn<any>().mockResolvedValue({ hasCoverage: false }),
    })),
}));

jest.unstable_mockModule('../../src/rule-engine.js', () => ({
    RuleEngine: jest.fn<any>().mockImplementation(() => ({
        loadCustomRules: jest.fn<any>(),
        validateRules: jest.fn<any>().mockResolvedValue({ valid: true }),
        execute: jest.fn<any>().mockResolvedValue({ violations: [], summary: {}, rulesExecuted: 0 }),
        getRules: jest.fn<any>().mockReturnValue([]),
    })),
}));


const { VLLMServer } = await import("../../src/index.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = await import("@modelcontextprotocol/sdk/types.js");

describe("VLLMServer Integration", () => {
    let server: any;

    beforeEach(() => {
        jest.clearAllMocks();
        server = new VLLMServer();
    });

    it("should register tool handlers on initialization", () => {
        expect(mockServerInstance.setRequestHandler).toHaveBeenCalledTimes(2);
        expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(ListToolsRequestSchema, expect.any(Function));
        expect(mockServerInstance.setRequestHandler).toHaveBeenCalledWith(CallToolRequestSchema, expect.any(Function));
    });

    it("should list available tools", async () => {
        const listToolsHandler = mockServerInstance.setRequestHandler.mock.calls.find(
            (call: any) => call[0] === ListToolsRequestSchema
        )?.[1] as any;

        const result = await listToolsHandler();
        expect(result.tools).toBeDefined();
        expect(result.tools.length).toBeGreaterThan(0);
        expect(result.tools.find((t: any) => t.name === "analyze_repository")).toBeDefined();
    });

    it("should handle analyze_repository tool usage", async () => {
        const callToolHandler = mockServerInstance.setRequestHandler.mock.calls.find(
            (call: any) => call[0] === CallToolRequestSchema
        )?.[1] as any;

        const request = {
            params: {
                name: "analyze_repository",
                arguments: { repository_path: "/test/repo" }
            }
        };

        const result = await callToolHandler(request);

        expect(result.content).toBeDefined();
        expect(result.content[0].text).toContain("Repository Analysis Report");
        expect(result.isError).toBeUndefined();
    });

    it("should handle unknown tool error", async () => {
        const callToolHandler = mockServerInstance.setRequestHandler.mock.calls.find(
            (call: any) => call[0] === CallToolRequestSchema
        )?.[1] as any;

        const request = {
            params: {
                name: "unknown_tool",
                arguments: {}
            }
        };

        const result = await callToolHandler(request);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown tool");
    });
});
