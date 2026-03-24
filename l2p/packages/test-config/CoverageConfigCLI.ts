#!/usr/bin/env node

/**
 * Coverage Configuration CLI
 * Command-line interface for managing coverage settings and generating reports
 */

import { Command } from 'commander';
import { CoverageConfigManager } from './CoverageConfigManager.js';
import { CoverageReporter } from './CoverageReporter.js';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('coverage-config')
  .description('CLI for managing test coverage configuration and reporting')
  .version('1.0.0');

// Show current configuration
program
  .command('show')
  .description('Show current coverage configuration')
  .option('-f, --format <format>', 'Output format (json|yaml|table)', 'table')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      const config = manager.getCoverageConfig();

      if (options.format === 'json') {
        console.log(JSON.stringify(config, null, 2));
      } else if (options.format === 'yaml') {
        // Simple YAML output
        console.log('frontend:');
        console.log(`  thresholds:`);
        console.log(`    statements: ${config.frontend.thresholds.statements}`);
        console.log(`    branches: ${config.frontend.thresholds.branches}`);
        console.log(`    functions: ${config.frontend.thresholds.functions}`);
        console.log(`    lines: ${config.frontend.thresholds.lines}`);
        console.log('backend:');
        console.log(`  thresholds:`);
        console.log(`    statements: ${config.backend.thresholds.statements}`);
        console.log(`    branches: ${config.backend.thresholds.branches}`);
        console.log(`    functions: ${config.backend.thresholds.functions}`);
        console.log(`    lines: ${config.backend.thresholds.lines}`);
      } else {
        // Table format
        console.log('\n📊 Coverage Configuration\n');
        
        console.log('Frontend Configuration:');
        console.log('├── Thresholds:');
        console.log(`│   ├── Statements: ${config.frontend.thresholds.statements}%`);
        console.log(`│   ├── Branches:   ${config.frontend.thresholds.branches}%`);
        console.log(`│   ├── Functions:  ${config.frontend.thresholds.functions}%`);
        console.log(`│   └── Lines:      ${config.frontend.thresholds.lines}%`);
        console.log('├── Reporters:', config.frontend.reporters.join(', '));
        console.log('├── Directory:', config.frontend.directory);
        console.log('└── Exclusions:', config.frontend.exclude.length, 'patterns');
        
        console.log('\nBackend Configuration:');
        console.log('├── Thresholds:');
        console.log(`│   ├── Statements: ${config.backend.thresholds.statements}%`);
        console.log(`│   ├── Branches:   ${config.backend.thresholds.branches}%`);
        console.log(`│   ├── Functions:  ${config.backend.thresholds.functions}%`);
        console.log(`│   └── Lines:      ${config.backend.thresholds.lines}%`);
        console.log('├── Reporters:', config.backend.reporters.join(', '));
        console.log('├── Directory:', config.backend.directory);
        console.log('└── Exclusions:', config.backend.exclude.length, 'patterns');
        
        console.log('\nGlobal Configuration:');
        console.log('├── Aggregated Directory:', config.global.aggregatedDirectory);
        console.log('├── Formats:', config.global.formats.join(', '));
        console.log('├── Historical Tracking:', config.global.includeHistorical ? 'Enabled' : 'Disabled');
        console.log('└── Badge Generation:', config.global.badgeGeneration ? 'Enabled' : 'Disabled');
      }
    } catch (error) {
      console.error('❌ Failed to show configuration:', error);
      process.exit(1);
    }
  });

// Set thresholds
program
  .command('set-threshold')
  .description('Set coverage thresholds')
  .requiredOption('-t, --target <target>', 'Target (frontend|backend|global)')
  .option('-s, --statements <percentage>', 'Statements threshold')
  .option('-b, --branches <percentage>', 'Branches threshold')
  .option('-f, --functions <percentage>', 'Functions threshold')
  .option('-l, --lines <percentage>', 'Lines threshold')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      const thresholds: any = {};

      if (options.statements) thresholds.statements = parseInt(options.statements, 10);
      if (options.branches) thresholds.branches = parseInt(options.branches, 10);
      if (options.functions) thresholds.functions = parseInt(options.functions, 10);
      if (options.lines) thresholds.lines = parseInt(options.lines, 10);

      if (Object.keys(thresholds).length === 0) {
        console.error('❌ No thresholds specified. Use --statements, --branches, --functions, or --lines');
        process.exit(1);
      }

      manager.updateThresholds(thresholds, options.target);
      console.log(`✅ Updated ${options.target} thresholds:`, thresholds);
    } catch (error) {
      console.error('❌ Failed to set thresholds:', error);
      process.exit(1);
    }
  });

// Add exclusion patterns
program
  .command('add-exclusion')
  .description('Add exclusion patterns')
  .requiredOption('-t, --target <target>', 'Target (frontend|backend|global)')
  .requiredOption('-p, --patterns <patterns...>', 'Exclusion patterns')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      manager.addExclusionPatterns(options.patterns, options.target);
      console.log(`✅ Added exclusion patterns to ${options.target}:`, options.patterns);
    } catch (error) {
      console.error('❌ Failed to add exclusion patterns:', error);
      process.exit(1);
    }
  });

// Remove exclusion patterns
program
  .command('remove-exclusion')
  .description('Remove exclusion patterns')
  .requiredOption('-t, --target <target>', 'Target (frontend|backend|global)')
  .requiredOption('-p, --patterns <patterns...>', 'Exclusion patterns to remove')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      manager.removeExclusionPatterns(options.patterns, options.target);
      console.log(`✅ Removed exclusion patterns from ${options.target}:`, options.patterns);
    } catch (error) {
      console.error('❌ Failed to remove exclusion patterns:', error);
      process.exit(1);
    }
  });

// Generate coverage report
program
  .command('report')
  .description('Generate coverage reports')
  .option('-f, --formats <formats...>', 'Report formats (html|json|lcov|xml|text|badge)', ['html', 'json'])
  .option('-o, --output <directory>', 'Output directory', 'coverage-reports')
  .option('--no-historical', 'Disable historical tracking')
  .option('--no-uncovered', 'Exclude uncovered lines from report')
  .option('--no-file-details', 'Exclude file-level details')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      const summary = await manager.collectAndAggregateCoverage();

      console.log('\n📊 Coverage Report Summary\n');
      
      if (summary.frontend) {
        console.log('Frontend Coverage:');
        console.log(`├── Statements: ${summary.frontend.overall.statements.percentage.toFixed(1)}%`);
        console.log(`├── Branches:   ${summary.frontend.overall.branches.percentage.toFixed(1)}%`);
        console.log(`├── Functions:  ${summary.frontend.overall.functions.percentage.toFixed(1)}%`);
        console.log(`└── Lines:      ${summary.frontend.overall.lines.percentage.toFixed(1)}%`);
      }

      if (summary.backend) {
        console.log('\nBackend Coverage:');
        console.log(`├── Statements: ${summary.backend.overall.statements.percentage.toFixed(1)}%`);
        console.log(`├── Branches:   ${summary.backend.overall.branches.percentage.toFixed(1)}%`);
        console.log(`├── Functions:  ${summary.backend.overall.functions.percentage.toFixed(1)}%`);
        console.log(`└── Lines:      ${summary.backend.overall.lines.percentage.toFixed(1)}%`);
      }

      console.log('\nGenerated Reports:');
      for (const reportPath of summary.reportPaths) {
        console.log(`├── ${path.basename(reportPath)}: ${reportPath}`);
      }

      if (summary.badgePath) {
        console.log(`└── Badge: ${summary.badgePath}`);
      }

      console.log(`\n${summary.thresholdsMet ? '✅' : '❌'} Thresholds: ${summary.thresholdsMet ? 'Met' : 'Not Met'}`);

      if (!summary.thresholdsMet) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to generate coverage report:', error);
      process.exit(1);
    }
  });

// Collect coverage
program
  .command('collect')
  .description('Collect and aggregate coverage from frontend and backend')
  .option('--summary-only', 'Generate only summary file')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      
      if (options.summaryOnly) {
        const summaryPath = await manager.createCoverageSummary();
        console.log(`✅ Coverage summary generated: ${summaryPath}`);
      } else {
        const summary = await manager.collectAndAggregateCoverage();
        console.log('✅ Coverage collection completed');
        console.log(`Reports generated: ${summary.reportPaths.length}`);
        console.log(`Thresholds met: ${summary.thresholdsMet ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.error('❌ Failed to collect coverage:', error);
      process.exit(1);
    }
  });

// Generate badge
program
  .command('badge')
  .description('Generate coverage badge')
  .option('-o, --output <file>', 'Output file path', 'coverage-badge.svg')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      const summary = await manager.collectAndAggregateCoverage();

      if (summary.badgePath) {
        // Copy badge to specified location
        if (options.output !== summary.badgePath) {
          fs.copyFileSync(summary.badgePath, options.output);
        }
        console.log(`✅ Coverage badge generated: ${options.output}`);
      } else {
        console.error('❌ No coverage data available for badge generation');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to generate badge:', error);
      process.exit(1);
    }
  });

// Validate configuration
program
  .command('validate')
  .description('Validate coverage configuration')
  .action(async () => {
    try {
      const manager = CoverageConfigManager.getInstance();
      const config = manager.getCoverageConfig();

      console.log('🔍 Validating coverage configuration...\n');

      let isValid = true;
      const warnings: string[] = [];

      // Validate thresholds
      const validateThresholds = (thresholds: any, name: string) => {
        for (const [metric, value] of Object.entries(thresholds)) {
          if (typeof value !== 'number' || value < 0 || value > 100) {
            console.error(`❌ Invalid ${name} threshold for ${metric}: ${value} (must be 0-100)`);
            isValid = false;
          } else if (value < 50) {
            warnings.push(`⚠️  Low ${name} threshold for ${metric}: ${value}%`);
          }
        }
      };

      validateThresholds(config.frontend.thresholds, 'frontend');
      validateThresholds(config.backend.thresholds, 'backend');
      validateThresholds(config.global.thresholds, 'global');

      // Validate directories
      const projectRoot = process.cwd();
      const frontendDir = path.join(projectRoot, 'frontend');
      const backendDir = path.join(projectRoot, 'backend');

      if (!fs.existsSync(frontendDir)) {
        console.error('❌ Frontend directory not found:', frontendDir);
        isValid = false;
      }

      if (!fs.existsSync(backendDir)) {
        console.error('❌ Backend directory not found:', backendDir);
        isValid = false;
      }

      // Validate exclusion patterns
      if (config.frontend.exclude.length === 0) {
        warnings.push('⚠️  No frontend exclusion patterns defined');
      }

      if (config.backend.exclude.length === 0) {
        warnings.push('⚠️  No backend exclusion patterns defined');
      }

      // Show warnings
      if (warnings.length > 0) {
        console.log('Warnings:');
        warnings.forEach(warning => console.log(warning));
        console.log();
      }

      if (isValid) {
        console.log('✅ Coverage configuration is valid');
      } else {
        console.log('❌ Coverage configuration has errors');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Failed to validate configuration:', error);
      process.exit(1);
    }
  });

// Reset configuration
program
  .command('reset')
  .description('Reset coverage configuration to defaults')
  .option('--confirm', 'Confirm reset without prompt')
  .action(async (options) => {
    try {
      if (!options.confirm) {
        console.log('⚠️  This will reset all coverage configuration to defaults.');
        console.log('Use --confirm to proceed without this prompt.');
        process.exit(0);
      }

      const manager = CoverageConfigManager.getInstance();
      const configPath = path.join(process.cwd(), '.kiro', 'coverage-config.json');
      
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }

      // Reinitialize with defaults
      const newManager = CoverageConfigManager.getInstance();
      console.log('✅ Coverage configuration reset to defaults');
    } catch (error) {
      console.error('❌ Failed to reset configuration:', error);
      process.exit(1);
    }
  });

// Export Jest configuration
program
  .command('jest-config')
  .description('Export Jest coverage configuration')
  .requiredOption('-t, --target <target>', 'Target (frontend|backend)')
  .option('-f, --format <format>', 'Output format (json|js)', 'json')
  .action(async (options) => {
    try {
      const manager = CoverageConfigManager.getInstance();
      
      let config;
      if (options.target === 'frontend') {
        config = manager.getFrontendJestConfig();
      } else if (options.target === 'backend') {
        config = manager.getBackendJestConfig();
      } else {
        console.error('❌ Invalid target. Use "frontend" or "backend"');
        process.exit(1);
      }

      if (options.format === 'js') {
        console.log('module.exports = {');
        for (const [key, value] of Object.entries(config)) {
          console.log(`  ${key}: ${JSON.stringify(value, null, 2)},`);
        }
        console.log('};');
      } else {
        console.log(JSON.stringify(config, null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to export Jest configuration:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

export { program };