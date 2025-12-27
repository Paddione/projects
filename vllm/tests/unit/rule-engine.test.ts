import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';

jest.unstable_mockModule('fs', () => ({
    promises: {
        readFile: jest.fn(),
    },
    existsSync: jest.fn(),
}));

jest.unstable_mockModule('yaml', () => ({
    default: {
        parse: jest.fn(),
        stringify: jest.fn(),
    },
}));

jest.unstable_mockModule('glob', () => ({
    glob: jest.fn(),
}));

import type { RuleEngine as RuleEngineType } from "../../src/rule-engine.js";
const { RuleEngine } = await import("../../src/rule-engine.js");
const fs = await import("fs");
const YAML = (await import("yaml")).default;
const { glob } = await import("glob");

describe("RuleEngine", () => {
    let engine: RuleEngineType;
    const mockRootPath = "/test/repo";

    const mockedExistsSync = fs.existsSync as unknown as jest.Mock<any>;
    const mockedReadFile = fs.promises.readFile as unknown as jest.Mock<any>;
    const mockedGlob = glob as unknown as jest.Mock<any>;
    const mockedYamlParse = YAML.parse as unknown as jest.Mock<any>;
    const mockedYamlStringify = YAML.stringify as unknown as jest.Mock<any>;

    beforeEach(() => {
        engine = new RuleEngine(mockRootPath);
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should initialize with built-in rules", async () => {
        mockedExistsSync.mockReturnValue(false);
        await engine.loadCustomRules();
        const rules = engine.getRules();
        expect(rules.length).toBeGreaterThan(0);
        expect(rules.some(r => r.id === "no-console-log")).toBe(true);
    });

    it("should load custom rules from .analyzer-rules.yml", async () => {
        mockedExistsSync.mockReturnValue(true);
        mockedReadFile.mockResolvedValue("custom config");
        mockedYamlParse.mockReturnValue({
            rules: [
                {
                    id: "custom-rule",
                    name: "Custom Rule",
                    severity: "error",
                    type: "pattern",
                    pattern: "todo",
                    enabled: true,
                }
            ]
        });

        await engine.loadCustomRules();
        const rules = engine.getRules();
        expect(rules.some(r => r.id === "custom-rule")).toBe(true);
    });

    it("should execute pattern rules", async () => {
        mockedExistsSync.mockReturnValue(false);
        mockedGlob.mockResolvedValue(["src/test.ts"]);
        mockedReadFile.mockResolvedValue(`
            function test() {
                console.log("debug");
                debugger;
            }
        `);

        const result = await engine.execute();
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations.find(v => v.ruleId === "no-console-log")).toBeDefined();
        expect(result.violations.find(v => v.ruleId === "no-debugger")).toBeDefined();
    });

    it("should execute file structure rules (tsconfig check)", async () => {
        mockedExistsSync.mockImplementation(((path: string) => path.endsWith("tsconfig.json")) as any);
        mockedGlob.mockResolvedValue([]);
        mockedReadFile.mockResolvedValue(JSON.stringify({ compilerOptions: { strict: false } }));

        const result = await engine.execute();
        expect(result.violations.find(v => v.ruleId === "require-strict-mode")).toBeDefined();
    });

    it("should handle invalid JSON in file structure rule", async () => {
        mockedExistsSync.mockImplementation(((path: string) => path.endsWith("tsconfig.json")) as any);
        mockedReadFile.mockResolvedValue("invalid json");

        const result = await engine.execute();
        expect(result).toBeDefined();
    });

    it("should validate rules correctly", async () => {
        await engine.loadCustomRules(); // Initialize rules
        const validation = await engine.validateRules();
        expect(validation.valid).toBe(true);
    });

    it("should handle error in loadCustomRules", async () => {
        mockedExistsSync.mockReturnValue(true);
        mockedReadFile.mockRejectedValue(new Error("Read Error"));

        await engine.loadCustomRules();
        expect(engine.getRules().length).toBeGreaterThan(0);
    });

    it("should merge custom rules with overrides", async () => {
        mockedExistsSync.mockReturnValue(true);
        mockedReadFile.mockResolvedValue("custom config");
        mockedYamlParse.mockReturnValue({
            rules: [
                { id: "no-console-log", name: "Overridden", enabled: false }
            ]
        });

        await engine.loadCustomRules();
        expect(engine.getRules().find(r => r.id === "no-console-log")).toBeUndefined();
    });

    it("should execute naming rule placeholder", async () => {
        jest.spyOn(engine, 'loadCustomRules').mockResolvedValue(undefined);
        // @ts-ignore - reaching into private rules
        engine.rules = [{ id: "naming", name: "Naming", type: "naming", enabled: true }];
        const result = await engine.execute();
        expect(result.rulesExecuted).toBe(1);
    });
});
