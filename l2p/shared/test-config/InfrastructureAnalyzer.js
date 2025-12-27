import * as fs from 'fs';
import * as path from 'path';
import { TestFileRegistry } from './TestFileRegistry';
export class InfrastructureAnalyzer {
    constructor(rootPath = process.cwd()) {
        this.rootPath = rootPath;
        this.registry = new TestFileRegistry(rootPath);
    }
    /**
     * Analyze the current test infrastructure for cleanup opportunities
     */
    async analyzeInfrastructure() {
        console.log('🔍 Analyzing test infrastructure...\n');
        const fileMap = await this.registry.discoverTestFiles();
        const categories = await this.registry.categorizeTests(Object.values(fileMap).flat());
        const analysis = {
            duplicateFiles: await this.findDuplicateFiles(categories),
            emptyDirectories: await this.findEmptyDirectories(),
            redundantConfigurations: await this.findRedundantConfigurations(),
            legacyScripts: await this.findLegacyScripts(),
            orphanedFiles: categories.orphaned.map(f => f.relativePath),
            recommendations: []
        };
        analysis.recommendations = this.generateRecommendations(analysis);
        return analysis;
    }
    /**
     * Find duplicate test files
     */
    async findDuplicateFiles(categories) {
        const duplicateGroups = [];
        const filesByName = new Map();
        // Group files by name
        Object.values(categories).flat().forEach(file => {
            const fileName = path.basename(file.relativePath);
            if (!filesByName.has(fileName)) {
                filesByName.set(fileName, []);
            }
            filesByName.get(fileName).push(file);
        });
        // Find duplicates
        for (const [fileName, files] of filesByName.entries()) {
            if (files.length > 1) {
                const group = await this.analyzeDuplicateGroup(fileName, files);
                if (group) {
                    duplicateGroups.push(group);
                }
            }
        }
        return duplicateGroups;
    }
    /**
     * Analyze a group of duplicate files to determine the preferred location
     */
    async analyzeDuplicateGroup(fileName, files) {
        const locations = files.map(f => f.relativePath);
        // Determine preferred location based on patterns
        let preferredLocation = locations[0];
        let reason = 'First occurrence';
        // Prefer consolidated E2E directory over src/__tests__/e2e/
        const e2eConsolidated = locations.find(loc => loc.includes('frontend/e2e/tests/'));
        const e2eSrc = locations.find(loc => loc.includes('frontend/src/__tests__/e2e/'));
        if (e2eConsolidated && e2eSrc) {
            preferredLocation = e2eConsolidated;
            reason = 'Prefer consolidated E2E directory (frontend/e2e/tests/) over src/__tests__/e2e/';
        }
        // Prefer __tests__ directories for unit tests
        const testsDir = locations.find(loc => loc.includes('__tests__'));
        const colocated = locations.find(loc => !loc.includes('__tests__') && loc.includes('.test.'));
        if (testsDir && colocated) {
            preferredLocation = testsDir;
            reason = 'Prefer __tests__ directory structure for better organization';
        }
        const filesToRemove = locations.filter(loc => loc !== preferredLocation);
        // Only create group if there are files to remove
        if (filesToRemove.length === 0) {
            return null;
        }
        return {
            fileName,
            locations,
            preferredLocation,
            filesToRemove,
            reason
        };
    }
    /**
     * Find empty directories
     */
    async findEmptyDirectories() {
        const emptyDirs = [];
        const testDirectories = [
            'frontend/src/__tests__/integration',
            'backend/src/__tests__/e2e',
            'frontend/src/__tests__/performance',
            'backend/src/__tests__/accessibility'
        ];
        for (const dir of testDirectories) {
            const fullPath = path.join(this.rootPath, dir);
            try {
                const stats = await fs.promises.stat(fullPath);
                if (stats.isDirectory()) {
                    const files = await fs.promises.readdir(fullPath);
                    if (files.length === 0) {
                        emptyDirs.push(dir);
                    }
                }
            }
            catch (error) {
                // Directory doesn't exist, which is fine
            }
        }
        return emptyDirs;
    }
    /**
     * Find redundant configurations
     */
    async findRedundantConfigurations() {
        const redundantConfigs = [];
        // Check for multiple Jest configurations
        const jestConfigs = [
            'jest.config.js',
            'jest.config.cjs',
            'jest.config.ts',
            'jest.config.json'
        ];
        const foundJestConfigs = [];
        for (const config of jestConfigs) {
            const frontendPath = path.join(this.rootPath, 'frontend', config);
            const backendPath = path.join(this.rootPath, 'backend', config);
            try {
                await fs.promises.access(frontendPath);
                foundJestConfigs.push(`frontend/${config}`);
            }
            catch { }
            try {
                await fs.promises.access(backendPath);
                foundJestConfigs.push(`backend/${config}`);
            }
            catch { }
        }
        if (foundJestConfigs.length > 2) { // More than one per directory
            redundantConfigs.push({
                type: 'jest',
                files: foundJestConfigs,
                reason: 'Multiple Jest configuration files found',
                action: 'consolidate'
            });
        }
        // Check for multiple Docker test configurations
        const dockerConfigs = [
            'docker-compose.test.yml',
            'docker-compose.testing.yml',
            'Dockerfile.test'
        ];
        const foundDockerConfigs = [];
        for (const config of dockerConfigs) {
            const configPath = path.join(this.rootPath, config);
            try {
                await fs.promises.access(configPath);
                foundDockerConfigs.push(config);
            }
            catch { }
        }
        if (foundDockerConfigs.length > 1) {
            redundantConfigs.push({
                type: 'docker',
                files: foundDockerConfigs,
                reason: 'Multiple Docker test configurations found',
                action: 'consolidate'
            });
        }
        return redundantConfigs;
    }
    /**
     * Find legacy test scripts
     */
    async findLegacyScripts() {
        const legacyScripts = [];
        const potentialLegacyFiles = [
            'test-runner.sh',
            'run-tests.sh',
            'test.sh',
            'testing/run-tests.js',
            'scripts/test.js',
            'test-setup.js',
            'test-teardown.js'
        ];
        for (const script of potentialLegacyFiles) {
            const scriptPath = path.join(this.rootPath, script);
            try {
                await fs.promises.access(scriptPath);
                // Check if script is actually used
                const isUsed = await this.isScriptUsed(script);
                if (!isUsed) {
                    legacyScripts.push(script);
                }
            }
            catch {
                // File doesn't exist, which is fine
            }
        }
        return legacyScripts;
    }
    /**
     * Check if a script is referenced in package.json or other configuration files
     */
    async isScriptUsed(scriptPath) {
        const configFiles = [
            'package.json',
            'frontend/package.json',
            'backend/package.json',
            '.github/workflows/test.yml',
            'Makefile'
        ];
        for (const configFile of configFiles) {
            const configPath = path.join(this.rootPath, configFile);
            try {
                const content = await fs.promises.readFile(configPath, 'utf-8');
                if (content.includes(scriptPath)) {
                    return true;
                }
            }
            catch {
                // File doesn't exist or can't be read
            }
        }
        return false;
    }
    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(analysis) {
        const recommendations = [];
        if (analysis.duplicateFiles.length > 0) {
            recommendations.push(`Remove ${analysis.duplicateFiles.length} duplicate file groups to reduce confusion`);
            recommendations.push('Consolidate E2E tests from frontend/src/__tests__/e2e/ to frontend/e2e/tests/');
        }
        if (analysis.emptyDirectories.length > 0) {
            recommendations.push(`Remove ${analysis.emptyDirectories.length} empty test directories`);
        }
        if (analysis.redundantConfigurations.length > 0) {
            recommendations.push(`Consolidate ${analysis.redundantConfigurations.length} redundant configuration files`);
        }
        if (analysis.legacyScripts.length > 0) {
            recommendations.push(`Remove ${analysis.legacyScripts.length} unused legacy test scripts`);
        }
        if (analysis.orphanedFiles.length > 0) {
            recommendations.push(`Categorize or remove ${analysis.orphanedFiles.length} orphaned test files`);
        }
        if (recommendations.length === 0) {
            recommendations.push('Test infrastructure is well-organized, no cleanup needed');
        }
        return recommendations;
    }
    /**
     * Generate a detailed cleanup plan
     */
    async generateCleanupPlan(analysis) {
        const plan = {
            filesToRemove: [],
            directoriesToRemove: [],
            configurationsToConsolidate: [],
            migrationsRequired: [],
            backupRecommended: true,
            estimatedSpaceSaved: 0
        };
        // Add duplicate files to removal list
        for (const group of analysis.duplicateFiles) {
            plan.filesToRemove.push(...group.filesToRemove);
            // Add migration if needed
            if (group.reason.includes('E2E')) {
                for (const fileToRemove of group.filesToRemove) {
                    plan.migrationsRequired.push({
                        sourceFile: fileToRemove,
                        targetFile: group.preferredLocation,
                        reason: group.reason,
                        requiresUpdate: true
                    });
                }
            }
        }
        // Add empty directories
        plan.directoriesToRemove.push(...analysis.emptyDirectories);
        // Add legacy scripts
        plan.filesToRemove.push(...analysis.legacyScripts);
        // Add configuration consolidations
        for (const config of analysis.redundantConfigurations) {
            plan.configurationsToConsolidate.push({
                type: config.type,
                sourceFiles: config.files.slice(1), // Keep first, consolidate others
                targetFile: config.files[0],
                action: config.action
            });
        }
        // Calculate estimated space saved
        let totalSize = 0;
        for (const file of plan.filesToRemove) {
            try {
                const stats = await fs.promises.stat(path.join(this.rootPath, file));
                totalSize += stats.size;
            }
            catch {
                // File might not exist
            }
        }
        plan.estimatedSpaceSaved = totalSize;
        return plan;
    }
}
