#!/usr/bin/env node

/**
 * Test Integration Validation Script
 * 
 * This script validates the complete test integration by:
 * 1. Checking all test files are discoverable and valid
 * 2. Running comprehensive test suite
 * 3. Generating coverage reports
 * 4. Ensuring no test files are orphaned
 * 5. Validating test structure consistency
 * 
 * Usage: node scripts/validate-test-integration.js [options]
 * Options:
 *   --coverage    Generate coverage report
 *   --ci          Run in CI mode (fail fast)
 *   --report      Generate detailed validation report
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestIntegrationValidator {
    constructor(options = {}) {
        this.options = {
            coverage: options.coverage || false,
            ci: options.ci || false,
            report: options.report || false,
            ...options
        };
        this.results = {
            testDiscovery: null,
            testExecution: null,
            coverage: null,
            orphanedFiles: [],
            errors: [],
            warnings: []
        };
        this.projectRoot = path.resolve(__dirname, '..');
    }

    async validate() {
        console.log('🔍 Starting Test Integration Validation...\n');
        
        try {
            // Step 1: Validate test file discovery
            await this.validateTestDiscovery();
            
            // Step 2: Run comprehensive test suite
            await this.runComprehensiveTests();
            
            // Step 3: Generate coverage report if requested
            if (this.options.coverage) {
                await this.generateCoverageReport();
            }
            
            // Step 4: Check for orphaned test files
            await this.checkOrphanedFiles();
            
            // Step 5: Validate test structure consistency
            await this.validateTestStructure();
            
            // Step 6: Generate validation report
            if (this.options.report) {
                await this.generateValidationReport();
            }
            
            this.printSummary();
            
            // Exit with appropriate code for CI
            const hasErrors = this.results.errors.length > 0;
            if (this.options.ci && hasErrors) {
                process.exit(1);
            }
            
            return !hasErrors;
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            if (this.options.ci) {
                process.exit(1);
            }
            return false;
        }
    }

    async validateTestDiscovery() {
        console.log('📋 Step 1: Validating test file discovery...');
        
        try {
            // Check if test inventory exists and is recent
            const inventoryPath = path.join(this.projectRoot, 'test-inventory-report.json');
            
            if (!fs.existsSync(inventoryPath)) {
                console.log('  Generating test inventory...');
                execSync('node generate-test-inventory.cjs', { 
                    cwd: this.projectRoot,
                    stdio: 'pipe'
                });
            }
            
            const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
            this.results.testDiscovery = inventory;
            
            console.log(`  ✅ Found ${inventory.summary.totalFiles} test files`);
            console.log(`     - Unit: ${inventory.summary.byType.unit}`);
            console.log(`     - Integration: ${inventory.summary.byType.integration}`);
            console.log(`     - E2E: ${inventory.summary.byType.e2e}`);
            console.log(`     - Performance: ${inventory.summary.byType.performance}`);
            console.log(`     - CLI: ${inventory.summary.byType.cli}`);
            
            if (inventory.summary.invalidFiles > 0) {
                this.results.errors.push(`Found ${inventory.summary.invalidFiles} invalid test files`);
            }
            
            if (inventory.summary.byType.orphaned > 0) {
                this.results.warnings.push(`Found ${inventory.summary.byType.orphaned} orphaned test files`);
            }
            
            // Check for duplicates
            if (inventory.duplicates && inventory.duplicates.length > 0) {
                this.results.warnings.push(`Found ${inventory.duplicates.length} sets of duplicate test files`);
                console.log(`  ⚠️  ${inventory.duplicates.length} duplicate test file sets found`);
            }
            
        } catch (error) {
            this.results.errors.push(`Test discovery failed: ${error.message}`);
            throw error;
        }
    }

    async runComprehensiveTests() {
        console.log('\n🧪 Step 2: Running comprehensive test suite...');
        
        return new Promise((resolve, reject) => {
            const testProcess = spawn('npm', ['run', 'test:all'], {
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            
            let output = '';
            let errorOutput = '';
            
            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            testProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            testProcess.on('close', (code) => {
                this.results.testExecution = {
                    exitCode: code,
                    output: output,
                    errors: errorOutput,
                    success: code === 0
                };
                
                if (code === 0) {
                    console.log('  ✅ All tests passed successfully');
                    resolve();
                } else {
                    console.log(`  ❌ Tests failed with exit code ${code}`);
                    this.results.errors.push(`Test execution failed with exit code ${code}`);
                    
                    // In CI mode, fail fast
                    if (this.options.ci) {
                        reject(new Error(`Tests failed with exit code ${code}`));
                    } else {
                        resolve(); // Continue with other validations
                    }
                }
            });
            
            testProcess.on('error', (error) => {
                this.results.errors.push(`Test execution error: ${error.message}`);
                reject(error);
            });
        });
    }

    async generateCoverageReport() {
        console.log('\n📊 Step 3: Generating coverage report...');
        
        try {
            execSync('npm run test:coverage', { 
                cwd: this.projectRoot,
                stdio: 'pipe'
            });
            
            // Check if coverage reports were generated
            const coverageReports = [
                'backend/coverage-reports',
                'frontend/coverage-reports'
            ];
            
            let coverageFound = false;
            for (const reportDir of coverageReports) {
                const fullPath = path.join(this.projectRoot, reportDir);
                if (fs.existsSync(fullPath)) {
                    coverageFound = true;
                    console.log(`  ✅ Coverage report generated: ${reportDir}`);
                }
            }
            
            if (!coverageFound) {
                this.results.warnings.push('No coverage reports found');
            }
            
            this.results.coverage = { generated: coverageFound };
            
        } catch (error) {
            this.results.warnings.push(`Coverage generation failed: ${error.message}`);
            console.log('  ⚠️  Coverage report generation failed');
        }
    }

    async checkOrphanedFiles() {
        console.log('\n🔍 Step 4: Checking for orphaned test files...');
        
        try {
            // Use the test inventory to check for orphaned files
            if (this.results.testDiscovery && this.results.testDiscovery.orphaned) {
                this.results.orphanedFiles = this.results.testDiscovery.orphaned;
                
                if (this.results.orphanedFiles.length === 0) {
                    console.log('  ✅ No orphaned test files found');
                } else {
                    console.log(`  ⚠️  Found ${this.results.orphanedFiles.length} orphaned test files`);
                    this.results.warnings.push(`${this.results.orphanedFiles.length} orphaned test files found`);
                }
            }
        } catch (error) {
            this.results.warnings.push(`Orphaned file check failed: ${error.message}`);
        }
    }

    async validateTestStructure() {
        console.log('\n🏗️  Step 5: Validating test structure consistency...');
        
        try {
            const expectedStructure = {
                'backend/src/__tests__': ['unit', 'integration', 'cli'],
                'frontend/src/__tests__': ['unit'],
                'frontend/e2e': ['tests']
            };
            
            let structureValid = true;
            
            for (const [basePath, expectedDirs] of Object.entries(expectedStructure)) {
                const fullPath = path.join(this.projectRoot, basePath);
                
                if (fs.existsSync(fullPath)) {
                    console.log(`  ✅ ${basePath} exists`);
                    
                    // Check for expected subdirectories
                    for (const expectedDir of expectedDirs) {
                        const dirPath = path.join(fullPath, expectedDir);
                        if (fs.existsSync(dirPath)) {
                            console.log(`    ✅ ${expectedDir} directory found`);
                        } else {
                            console.log(`    ⚠️  ${expectedDir} directory missing`);
                            this.results.warnings.push(`Missing directory: ${basePath}/${expectedDir}`);
                        }
                    }
                } else {
                    console.log(`  ❌ ${basePath} does not exist`);
                    this.results.errors.push(`Missing test directory: ${basePath}`);
                    structureValid = false;
                }
            }
            
            if (structureValid) {
                console.log('  ✅ Test structure is consistent');
            }
            
        } catch (error) {
            this.results.errors.push(`Structure validation failed: ${error.message}`);
        }
    }

    async generateValidationReport() {
        console.log('\n📄 Step 6: Generating validation report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            validation: {
                testDiscovery: this.results.testDiscovery?.summary || null,
                testExecution: {
                    success: this.results.testExecution?.success || false,
                    exitCode: this.results.testExecution?.exitCode || null
                },
                coverage: this.results.coverage,
                orphanedFiles: this.results.orphanedFiles.length,
                errors: this.results.errors,
                warnings: this.results.warnings
            },
            recommendations: this.generateRecommendations()
        };
        
        const reportPath = path.join(this.projectRoot, 'test-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`  ✅ Validation report saved: ${reportPath}`);
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.errors.length > 0) {
            recommendations.push('Fix all test execution errors before deployment');
        }
        
        if (this.results.orphanedFiles.length > 0) {
            recommendations.push('Remove or integrate orphaned test files');
        }
        
        if (this.results.testDiscovery?.duplicates?.length > 0) {
            recommendations.push('Consolidate duplicate test files to avoid confusion');
        }
        
        if (!this.results.coverage?.generated) {
            recommendations.push('Ensure coverage reports are generated for all test runs');
        }
        
        return recommendations;
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📋 TEST INTEGRATION VALIDATION SUMMARY');
        console.log('='.repeat(60));
        
        const totalFiles = this.results.testDiscovery?.summary?.totalFiles || 0;
        const validFiles = this.results.testDiscovery?.summary?.validFiles || 0;
        const testsPassed = this.results.testExecution?.success || false;
        
        console.log(`📊 Test Files: ${validFiles}/${totalFiles} valid`);
        console.log(`🧪 Test Execution: ${testsPassed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`📈 Coverage: ${this.results.coverage?.generated ? '✅ Generated' : '⚠️  Not Generated'}`);
        console.log(`🔍 Orphaned Files: ${this.results.orphanedFiles.length}`);
        
        if (this.results.errors.length > 0) {
            console.log(`\n❌ Errors (${this.results.errors.length}):`);
            this.results.errors.forEach(error => console.log(`   • ${error}`));
        }
        
        if (this.results.warnings.length > 0) {
            console.log(`\n⚠️  Warnings (${this.results.warnings.length}):`);
            this.results.warnings.forEach(warning => console.log(`   • ${warning}`));
        }
        
        const overallStatus = this.results.errors.length === 0 ? '✅ PASSED' : '❌ FAILED';
        console.log(`\n🎯 Overall Status: ${overallStatus}`);
        console.log('='.repeat(60));
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const options = {
        coverage: args.includes('--coverage'),
        ci: args.includes('--ci'),
        report: args.includes('--report')
    };
    
    const validator = new TestIntegrationValidator(options);
    validator.validate().catch(error => {
        console.error('Validation failed:', error);
        process.exit(1);
    });
}

export default TestIntegrationValidator;
