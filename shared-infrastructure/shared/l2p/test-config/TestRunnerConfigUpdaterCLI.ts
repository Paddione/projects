#!/usr/bin/env node

import { TestFileRegistry } from './TestFileRegistry';
import { TestRunnerConfigUpdater } from './TestRunnerConfigUpdater';

export class TestRunnerConfigUpdaterCLI {
  private registry: TestFileRegistry;
  private updater: TestRunnerConfigUpdater;

  constructor(rootPath?: string) {
    this.registry = new TestFileRegistry(rootPath);
    this.updater = new TestRunnerConfigUpdater(rootPath);
  }

  /**
   * Run the CLI with command line arguments
   */
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    const command = args[0] || 'update';
    
    try {
      switch (command) {
        case 'update':
          await this.updateCommand();
          break;
        case 'validate':
          await this.validateCommand();
          break;
        case 'generate':
          await this.generateCommand();
          break;
        case 'help':
          this.showHelp();
          break;
        default:
          console.error(`Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }

  /**
   * Update all test runner configurations
   */
  private async updateCommand(): Promise<void> {
    console.log('🔧 Updating test runner configurations...\n');
    
    // Discover test files
    const fileMap = await this.registry.discoverTestFiles();
    const categories = await this.registry.categorizeTests(Object.values(fileMap).flat());
    
    console.log(`📊 Discovered ${Object.values(fileMap).flat().length} test files`);
    console.log(`   - Unit: ${categories.unit.length}`);
    console.log(`   - Integration: ${categories.integration.length}`);
    console.log(`   - E2E: ${categories.e2e.length}`);
    console.log(`   - Performance: ${categories.performance.length}`);
    console.log(`   - Accessibility: ${categories.accessibility.length}`);
    console.log(`   - CLI: ${categories.cli.length}`);
    console.log(`   - Orphaned: ${categories.orphaned.length}\n`);
    
    // Generate configurations
    const configs = await this.updater.generateRunnerConfigs(categories);
    
    // Update Jest configurations
    console.log('📝 Updating Jest configurations...');
    await this.updater.updateJestConfigs(configs);
    
    // Update Playwright configuration
    console.log('📝 Updating Playwright configuration...');
    await this.updater.updatePlaywrightConfig(configs.playwright);
    
    // Create custom runner configurations
    console.log('📝 Creating custom runner configurations...');
    await this.updater.createPerformanceTestConfig(configs.custom);
    await this.updater.createCliTestConfig(configs.custom);
    
    console.log('\n✅ All test runner configurations updated successfully!');
    
    // Show summary
    console.log('\n📋 Configuration Summary:');
    console.log('========================');
    console.log(`Jest (Backend): ${configs.jest.backend.testMatch.length} patterns`);
    console.log(`Jest (Frontend): ${configs.jest.frontend.testMatch.length} patterns`);
    console.log(`Playwright: ${configs.playwright.testMatch.length} patterns`);
    console.log(`Performance: ${configs.custom.performance.testMatch.length} patterns`);
    console.log(`CLI: ${configs.custom.cli.testMatch.length} patterns`);
  }

  /**
   * Validate test execution
   */
  private async validateCommand(): Promise<void> {
    console.log('🔍 Validating test execution...\n');
    
    const results = await this.updater.validateTestExecution();
    
    let totalValid = 0;
    let totalInvalid = 0;
    
    results.forEach(result => {
      console.log(`\n🏃 ${result.runner.toUpperCase()} Runner:`);
      console.log(`   Files found: ${result.filesFound}`);
      console.log(`   Files executable: ${result.filesExecutable}`);
      console.log(`   Status: ${result.valid ? '✅ Valid' : '❌ Invalid'}`);
      
      if (result.errors.length > 0) {
        console.log('   Errors:');
        result.errors.forEach(error => console.log(`     ❌ ${error}`));
        totalInvalid += result.errors.length;
      }
      
      if (result.warnings.length > 0) {
        console.log('   Warnings:');
        result.warnings.forEach(warning => console.log(`     ⚠️  ${warning}`));
      }
      
      if (result.valid && result.errors.length === 0) {
        totalValid++;
      }
    });
    
    console.log('\n📊 Validation Summary:');
    console.log('======================');
    console.log(`✅ Valid runners: ${totalValid}`);
    console.log(`❌ Invalid runners: ${results.length - totalValid}`);
    console.log(`⚠️  Total issues: ${totalInvalid}`);
    
    if (totalInvalid > 0) {
      console.log('\n💡 Recommendations:');
      console.log('  - Fix validation errors before running tests');
      console.log('  - Ensure test files have proper test patterns');
      console.log('  - Check file accessibility and syntax');
    }
  }

  /**
   * Generate configuration files without updating existing ones
   */
  private async generateCommand(): Promise<void> {
    console.log('📋 Generating test runner configurations...\n');
    
    const fileMap = await this.registry.discoverTestFiles();
    const categories = await this.registry.categorizeTests(Object.values(fileMap).flat());
    const configs = await this.updater.generateRunnerConfigs(categories);
    
    // Display configurations
    console.log('🔧 Generated Configurations:');
    console.log('============================\n');
    
    console.log('📝 Backend Jest Configuration:');
    console.log('testMatch:', JSON.stringify(configs.jest.backend.testMatch, null, 2));
    console.log('testPathIgnorePatterns:', JSON.stringify(configs.jest.backend.testPathIgnorePatterns, null, 2));
    console.log();
    
    console.log('📝 Frontend Jest Configuration:');
    console.log('testMatch:', JSON.stringify(configs.jest.frontend.testMatch, null, 2));
    console.log('testPathIgnorePatterns:', JSON.stringify(configs.jest.frontend.testPathIgnorePatterns, null, 2));
    console.log();
    
    console.log('📝 Playwright Configuration:');
    console.log('testDir:', configs.playwright.testDir);
    console.log('testMatch:', JSON.stringify(configs.playwright.testMatch, null, 2));
    console.log('testIgnore:', JSON.stringify(configs.playwright.testIgnore, null, 2));
    console.log();
    
    console.log('📝 Performance Test Configuration:');
    console.log('testMatch:', JSON.stringify(configs.custom.performance.testMatch, null, 2));
    console.log();
    
    console.log('📝 CLI Test Configuration:');
    console.log('testMatch:', JSON.stringify(configs.custom.cli.testMatch, null, 2));
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
🔧 Test Runner Configuration Updater CLI

Usage: node TestRunnerConfigUpdaterCLI.js [command]

Commands:
  update      Update all test runner configurations (default)
  validate    Validate that all test files are executable
  generate    Generate configurations without updating files
  help        Show this help message

Examples:
  node TestRunnerConfigUpdaterCLI.js update
  node TestRunnerConfigUpdaterCLI.js validate
  node TestRunnerConfigUpdaterCLI.js generate
  node TestRunnerConfigUpdaterCLI.js help

Description:
  This tool automatically discovers all test files in the repository and updates
  the test runner configurations (Jest, Playwright, etc.) to include them.
  
  It ensures that:
  - All unit and integration tests are included in Jest configurations
  - All E2E and accessibility tests are included in Playwright configuration
  - Performance and CLI tests have their own custom runner configurations
  - No test files are orphaned or excluded from execution
`);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new TestRunnerConfigUpdaterCLI();
  cli.run().catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}