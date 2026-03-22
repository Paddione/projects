"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestFileRegistry = void 0;
var fs = require("fs");
var path = require("path");
var glob_1 = require("glob");
var TestFileRegistry = /** @class */ (function () {
    function TestFileRegistry(rootPath, options) {
        var _a;
        if (rootPath === void 0) { rootPath = process.cwd(); }
        var _b, _c, _d;
        this.rootPath = rootPath;
        this.excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/test-results/**',
            '**/test-artifacts/**',
            '**/playwright-report/**',
            '**/.git/**',
            '**/.next/**',
            '**/.nuxt/**',
            // Additional common heavy directories to skip
            '**/.cache/**',
            '**/.turbo/**',
            '**/.parcel-cache/**',
            '**/.svelte-kit/**',
            '**/storybook-static/**',
            '**/.angular/**',
            '**/out/**',
            '**/tmp/**'
        ];
        if ((_b = options === null || options === void 0 ? void 0 : options.excludePatterns) === null || _b === void 0 ? void 0 : _b.length) {
            (_a = this.excludePatterns).push.apply(_a, options.excludePatterns);
        }
        var envConcurrency = process.env.TEST_SCANNER_MAX_CONCURRENCY ? parseInt(process.env.TEST_SCANNER_MAX_CONCURRENCY, 10) : undefined;
        this.maxConcurrency = (_d = (_c = options === null || options === void 0 ? void 0 : options.maxConcurrency) !== null && _c !== void 0 ? _c : envConcurrency) !== null && _d !== void 0 ? _d : 16;
    }
    /**
     * Discover all test files in the repository
     */
    TestFileRegistry.prototype.discoverTestFiles = function () {
        return __awaiter(this, void 0, void 0, function () {
            var patterns, globOptions, results, uniqueFiles;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        patterns = [
                            '**/*.test.ts',
                            '**/*.test.tsx',
                            '**/*.test.js',
                            '**/*.test.jsx',
                            '**/*.spec.ts',
                            '**/*.spec.tsx',
                            '**/*.spec.js',
                            '**/*.spec.jsx',
                            '**/__tests__/**/*.ts',
                            '**/__tests__/**/*.tsx',
                            '**/__tests__/**/*.js',
                            '**/__tests__/**/*.jsx'
                        ];
                        globOptions = {
                            cwd: this.rootPath,
                            ignore: this.excludePatterns,
                            nodir: true
                        };
                        return [4 /*yield*/, Promise.all(patterns.map(function (pattern) {
                                return (0, glob_1.glob)(pattern, globOptions).catch(function (error) {
                                    console.warn("Error scanning pattern ".concat(pattern, ":"), error);
                                    return [];
                                });
                            }))];
                    case 1:
                        results = _a.sent();
                        uniqueFiles = Array.from(new Set(results.flat()));
                        return [2 /*return*/, this.categorizeTestFiles(uniqueFiles)];
                }
            });
        });
    };
    /**
     * Categorize test files by type
     */
    TestFileRegistry.prototype.categorizeTestFiles = function (files) {
        var categories = {
            unit: [],
            integration: [],
            e2e: [],
            performance: [],
            accessibility: [],
            cli: [],
            orphaned: []
        };
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            var category = this.determineTestCategory(file);
            categories[category].push(file);
        }
        return categories;
    };
    /**
     * Determine the category of a test file based on its path and name
     */
    TestFileRegistry.prototype.determineTestCategory = function (filePath) {
        var normalizedPath = filePath.toLowerCase();
        // Common helpers
        var hasTestPattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(normalizedPath);
        var isCyTest = /\.cy\.(ts|tsx|js|jsx)$/.test(normalizedPath);
        var inE2EDir = normalizedPath.includes('/e2e/') || normalizedPath.includes('\\e2e\\') || normalizedPath.startsWith('e2e/');
        var mentionsE2ERunner = normalizedPath.includes('playwright') || normalizedPath.includes('cypress');
        var inIntegrationDir = normalizedPath.includes('/integration/') || normalizedPath.includes('\\integration\\');
        var inUnitDir = normalizedPath.includes('/unit/') || normalizedPath.includes('\\unit\\');
        var inTestsDir = normalizedPath.includes('__tests__');
        // E2E tests: check this first as it's most specific
        if (isCyTest || (inE2EDir && hasTestPattern) || (mentionsE2ERunner && hasTestPattern)) {
            return 'e2e';
        }
        // CLI tests (folder-driven; may not have .test/.spec)
        if (normalizedPath.includes('/cli/') || normalizedPath.includes('\\cli\\')) {
            return 'cli';
        }
        // Performance tests (require test-like naming)
        if ((normalizedPath.includes('/performance/') || normalizedPath.includes('\\performance\\') ||
            normalizedPath.includes('load-test') || normalizedPath.includes('perf-test')) && (hasTestPattern || isCyTest)) {
            return 'performance';
        }
        // Accessibility tests (require test-like naming)
        if ((normalizedPath.includes('/accessibility/') || normalizedPath.includes('\\accessibility\\') ||
            normalizedPath.includes('a11y') || normalizedPath.includes('axe')) && (hasTestPattern || isCyTest)) {
            return 'accessibility';
        }
        // Integration tests: only when in integration context AND has test pattern, or explicit api.test/spec, or db.test/spec
        if ((inIntegrationDir && hasTestPattern) ||
            normalizedPath.includes('api.test') || normalizedPath.includes('api.spec') ||
            normalizedPath.includes('db.test') || normalizedPath.includes('db.spec')) {
            return 'integration';
        }
        // Unit tests (default for most test files with test patterns)
        if ((inUnitDir && hasTestPattern) ||
            (inTestsDir && hasTestPattern && !inE2EDir && !inIntegrationDir) ||
            (hasTestPattern && !inE2EDir && !mentionsE2ERunner && !inIntegrationDir)) {
            return 'unit';
        }
        // Files without test patterns or in unrecognized locations are orphaned
        return 'orphaned';
    };
    /**
     * Get detailed information about test files
     */
    TestFileRegistry.prototype.categorizeTests = function (files) {
        return __awaiter(this, void 0, void 0, function () {
            var categories, testInfos, _i, testInfos_1, testInfo;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        categories = {
                            unit: [],
                            integration: [],
                            e2e: [],
                            performance: [],
                            accessibility: [],
                            cli: [],
                            orphaned: []
                        };
                        return [4 /*yield*/, this.mapWithConcurrency(files, this.maxConcurrency, function (file) { return _this.getTestFileInfo(file); })];
                    case 1:
                        testInfos = _a.sent();
                        for (_i = 0, testInfos_1 = testInfos; _i < testInfos_1.length; _i++) {
                            testInfo = testInfos_1[_i];
                            categories[testInfo.type].push(testInfo);
                        }
                        return [2 /*return*/, categories];
                }
            });
        });
    };
    /**
     * Get detailed information about a test file
     */
    TestFileRegistry.prototype.getTestFileInfo = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fullPath, type, runner, stats, valid, errors, error_1, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fullPath = path.resolve(this.rootPath, filePath);
                        type = this.determineTestCategory(filePath);
                        runner = this.determineTestRunner(filePath, type);
                        valid = true;
                        errors = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, fs.promises.stat(fullPath)];
                    case 2:
                        stats = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        valid = false;
                        errors.push("File not accessible: ".concat(error_1));
                        stats = { size: 0, mtime: new Date() };
                        return [3 /*break*/, 4];
                    case 4:
                        if (!valid) return [3 /*break*/, 10];
                        _a.label = 5;
                    case 5:
                        _a.trys.push([5, 9, , 10]);
                        if (!(stats.size === 0)) return [3 /*break*/, 6];
                        valid = false;
                        errors.push('File is empty');
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, fs.promises.readFile(fullPath, 'utf-8')];
                    case 7:
                        content = _a.sent();
                        if (content.trim().length === 0) {
                            valid = false;
                            errors.push('File is empty');
                        }
                        // Check for basic test patterns
                        if (!this.hasTestPatterns(content)) {
                            valid = false;
                            errors.push('No test patterns found (describe, it, test, etc.)');
                        }
                        _a.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_2 = _a.sent();
                        valid = false;
                        errors.push("Cannot read file: ".concat(error_2));
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, {
                            path: fullPath,
                            relativePath: filePath,
                            type: type,
                            runner: runner,
                            valid: valid,
                            errors: errors,
                            size: stats.size,
                            lastModified: stats.mtime
                        }];
                }
            });
        });
    };
    /**
     * Determine which test runner should be used for a file
     */
    TestFileRegistry.prototype.determineTestRunner = function (filePath, type) {
        var normalizedPath = filePath.toLowerCase();
        // Playwright for E2E and accessibility tests
        if (type === 'e2e' || type === 'accessibility') {
            return 'playwright';
        }
        // Custom runner for performance tests
        if (type === 'performance') {
            return 'custom';
        }
        // Jest for unit, integration, and CLI tests
        if (type === 'unit' || type === 'integration' || type === 'cli') {
            return 'jest';
        }
        // Check file extensions and patterns
        if (normalizedPath.includes('playwright') || normalizedPath.includes('.spec.')) {
            return 'playwright';
        }
        if (normalizedPath.includes('.test.')) {
            return 'jest';
        }
        return 'unknown';
    };
    /**
     * Check if file contains test patterns
     */
    TestFileRegistry.prototype.hasTestPatterns = function (content) {
        var testPatterns = [
            /\bdescribe\s*\(/,
            /\bit\s*\(/,
            /\btest\s*\(/,
            /\bexpect\s*\(/,
            /\bassert\s*\(/,
            /\bbeforeEach\s*\(/,
            /\bafterEach\s*\(/,
            /\bbeforeAll\s*\(/,
            /\bafterAll\s*\(/
        ];
        return testPatterns.some(function (pattern) { return pattern.test(content); });
    };
    /**
     * Run async mapping with a concurrency limit
     */
    TestFileRegistry.prototype.mapWithConcurrency = function (items, limit, mapper) {
        return __awaiter(this, void 0, void 0, function () {
            var results, nextIndex, worker, workers, workerCount, i;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (items.length === 0)
                            return [2 /*return*/, []];
                        results = new Array(items.length);
                        nextIndex = 0;
                        worker = function () { return __awaiter(_this, void 0, void 0, function () {
                            var currentIndex, _a, _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        if (!true) return [3 /*break*/, 2];
                                        currentIndex = nextIndex++;
                                        if (currentIndex >= items.length)
                                            return [3 /*break*/, 2];
                                        _a = results;
                                        _b = currentIndex;
                                        return [4 /*yield*/, mapper(items[currentIndex], currentIndex)];
                                    case 1:
                                        _a[_b] = _c.sent();
                                        return [3 /*break*/, 0];
                                    case 2: return [2 /*return*/];
                                }
                            });
                        }); };
                        workers = [];
                        workerCount = Math.min(Math.max(1, limit), items.length);
                        for (i = 0; i < workerCount; i++)
                            workers.push(worker());
                        return [4 /*yield*/, Promise.all(workers)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * Validate test files for syntax and accessibility
     */
    TestFileRegistry.prototype.validateTestFiles = function (files) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.mapWithConcurrency(files, this.maxConcurrency, function (file) { return _this.validateTestFile(file); })];
            });
        });
    };
    /**
     * Validate a single test file
     */
    TestFileRegistry.prototype.validateTestFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var fullPath, errors, warnings, stats, content, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fullPath = path.resolve(this.rootPath, filePath);
                        errors = [];
                        warnings = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        // Check if file exists and is readable
                        return [4 /*yield*/, fs.promises.access(fullPath, fs.constants.R_OK)];
                    case 2:
                        // Check if file exists and is readable
                        _a.sent();
                        return [4 /*yield*/, fs.promises.stat(fullPath)];
                    case 3:
                        stats = _a.sent();
                        if (!(stats.size === 0)) return [3 /*break*/, 4];
                        errors.push('File is empty');
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, fs.promises.readFile(fullPath, 'utf-8')];
                    case 5:
                        content = _a.sent();
                        if (content.trim().length === 0) {
                            errors.push('File is empty');
                        }
                        // Check for test patterns
                        if (!this.hasTestPatterns(content)) {
                            warnings.push('No test patterns found');
                        }
                        // Check for common issues
                        if (content.includes('fdescribe') || content.includes('fit')) {
                            warnings.push('Contains focused tests (fdescribe/fit)');
                        }
                        if (content.includes('xdescribe') || content.includes('xit')) {
                            warnings.push('Contains skipped tests (xdescribe/xit)');
                        }
                        // Basic syntax check for TypeScript/JavaScript
                        if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
                            if (!content.includes('import') && !content.includes('require')) {
                                warnings.push('No imports found - might be incomplete');
                            }
                        }
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        error_3 = _a.sent();
                        errors.push("Cannot access file: ".concat(error_3));
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, {
                            path: filePath,
                            valid: errors.length === 0,
                            errors: errors,
                            warnings: warnings
                        }];
                }
            });
        });
    };
    /**
     * Generate comprehensive inventory report
     */
    TestFileRegistry.prototype.generateInventoryReport = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fileMap, allFiles, categories, summary, duplicates, recommendations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.discoverTestFiles()];
                    case 1:
                        fileMap = _a.sent();
                        allFiles = Object.values(fileMap).flat();
                        return [4 /*yield*/, this.categorizeTests(allFiles)];
                    case 2:
                        categories = _a.sent();
                        summary = {
                            totalFiles: allFiles.length,
                            byType: {
                                unit: fileMap.unit.length,
                                integration: fileMap.integration.length,
                                e2e: fileMap.e2e.length,
                                performance: fileMap.performance.length,
                                accessibility: fileMap.accessibility.length,
                                cli: fileMap.cli.length,
                                orphaned: fileMap.orphaned.length
                            },
                            byRunner: {
                                jest: 0,
                                playwright: 0,
                                custom: 0,
                                unknown: 0
                            },
                            validFiles: 0,
                            invalidFiles: 0
                        };
                        // Count by runner and validity
                        Object.values(categories).flat().forEach(function (file) {
                            if (file.runner in summary.byRunner) {
                                summary.byRunner[file.runner]++;
                            }
                            if (file.valid) {
                                summary.validFiles++;
                            }
                            else {
                                summary.invalidFiles++;
                            }
                        });
                        duplicates = this.findDuplicateFiles(allFiles);
                        recommendations = this.generateRecommendations(categories, duplicates);
                        return [2 /*return*/, {
                                summary: summary,
                                categories: categories,
                                duplicates: duplicates,
                                orphaned: categories.orphaned,
                                recommendations: recommendations
                            }];
                }
            });
        });
    };
    /**
     * Find duplicate test files
     */
    TestFileRegistry.prototype.findDuplicateFiles = function (files) {
        var filesByName = new Map();
        files.forEach(function (file) {
            var fileName = path.basename(file);
            if (!filesByName.has(fileName)) {
                filesByName.set(fileName, []);
            }
            filesByName.get(fileName).push(file);
        });
        return Array.from(filesByName.values()).filter(function (group) { return group.length > 1; });
    };
    /**
     * Generate recommendations for test organization
     */
    TestFileRegistry.prototype.generateRecommendations = function (categories, duplicates) {
        var recommendations = [];
        // Check for orphaned files
        if (categories.orphaned.length > 0) {
            recommendations.push("Found ".concat(categories.orphaned.length, " orphaned test files that need categorization"));
        }
        // Check for duplicates
        if (duplicates.length > 0) {
            recommendations.push("Found ".concat(duplicates.length, " sets of duplicate test files that should be consolidated"));
        }
        // Check for invalid files
        var invalidFiles = Object.values(categories).flat().filter(function (f) { return !f.valid; });
        if (invalidFiles.length > 0) {
            recommendations.push("Found ".concat(invalidFiles.length, " invalid test files that need fixing"));
        }
        // Check for empty directories (would need additional logic)
        recommendations.push('Remove empty integration test directories');
        // Performance recommendations
        var largeFiles = Object.values(categories).flat().filter(function (f) { return f.size > 50000; }); // 50KB
        if (largeFiles.length > 0) {
            recommendations.push("Consider splitting ".concat(largeFiles.length, " large test files for better maintainability"));
        }
        return recommendations;
    };
    return TestFileRegistry;
}());
exports.TestFileRegistry = TestFileRegistry;
