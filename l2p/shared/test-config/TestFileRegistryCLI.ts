#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { TestFileRegistry, TestInventoryReport } from './TestFileRegistry';

export class TestFileRegistryCLI {
  private registry: TestFileRegistry;

  constructor(rootPath?: string) {
    this.registry = new TestFileRegistry(rootPath);
  }

  /**
   * Run the CLI with command line arguments
   */
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
    const command = args[0] || 'discover';
    
    try {
      switch (command) {
        case 'discover':
          await this.discoverCommand();
          break;
        case 'validate':
          await this.validateCommand();
          break;
        case 'report':
          await this.reportCommand(args[1]);
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
   * Discover and categorize test files
   */
  private async discoverCommand(): Promise<void> {
    console.log('🔍 Discovering test files...\n');
    
    const fileMap = await this.registry.discoverTestFiles();
    const categories = await this.registry.categorizeTests(Object.values(fileMap).flat());
    
    // Display summary
    console.log('📊 Test File Summary:');
    console.log('=====================');
    
    Object.entries(fileMap).forEach(([type, files]) => {
      if (files.length > 0) {
        console.log(`${type.toUpperCase()}: ${files.length} files`);
        files.forEach((file: string) => console.log(`  - ${file}`));
        console.log();
      }
    });
    
    // Display validation results
    const allFiles = Object.values(categories).flat();
    const validFiles = allFiles.filter(f => f.valid).length;
    const invalidFiles = allFiles.filter(f => !f.valid).length;
    
    console.log(`✅ Valid files: ${validFiles}`);
    console.log(`❌ Invalid files: ${invalidFiles}`);
    
    if (invalidFiles > 0) {
      console.log('\n🚨 Invalid Files:');
      allFiles.filter(f => !f.valid).forEach((file: any) => {
        console.log(`  - ${file.relativePath}`);
        file.errors.forEach((error: string) => console.log(`    ❌ ${error}`));
      });
    }
  }

  /**
   * Validate test files
   */
  private async validateCommand(): Promise<void> {
    console.log('🔍 Validating test files...\n');
    
    const fileMap = await this.registry.discoverTestFiles();
    const allFiles = Object.values(fileMap).flat();
    const validationResults = await this.registry.validateTestFiles(allFiles);
    
    let validCount = 0;
    let invalidCount = 0;
    let warningCount = 0;
    
    validationResults.forEach(result => {
      if (result.valid) {
        validCount++;
      } else {
        invalidCount++;
        console.log(`❌ ${result.path}`);
        result.errors.forEach(error => console.log(`   Error: ${error}`));
      }
      
      if (result.warnings.length > 0) {
        warningCount++;
        console.log(`⚠️  ${result.path}`);
        result.warnings.forEach(warning => console.log(`   Warning: ${warning}`));
      }
    });
    
    console.log('\n📊 Validation Summary:');
    console.log('======================');
    console.log(`✅ Valid files: ${validCount}`);
    console.log(`❌ Invalid files: ${invalidCount}`);
    console.log(`⚠️  Files with warnings: ${warningCount}`);
  }

  /**
   * Generate comprehensive report
   */
  private async reportCommand(outputPath?: string): Promise<void> {
    console.log('📋 Generating comprehensive test inventory report...\n');
    
    const report = await this.registry.generateInventoryReport();
    
    // Display console summary
    this.displayReportSummary(report);
    
    // Save detailed report to file
    const reportPath = outputPath || 'test-inventory-report.json';
    await this.saveReport(report, reportPath);
    
    // Generate HTML report
    const htmlPath = reportPath.replace('.json', '.html');
    await this.generateHtmlReport(report, htmlPath);
    
    console.log(`\n📄 Reports generated:`);
    console.log(`  - JSON: ${reportPath}`);
    console.log(`  - HTML: ${htmlPath}`);
  }

  /**
   * Display report summary in console
   */
  private displayReportSummary(report: TestInventoryReport): void {
    console.log('📊 Test Inventory Summary:');
    console.log('==========================');
    console.log(`Total test files: ${report.summary.totalFiles}`);
    console.log(`Valid files: ${report.summary.validFiles}`);
    console.log(`Invalid files: ${report.summary.invalidFiles}`);
    console.log();
    
    console.log('📁 By Category:');
    Object.entries(report.summary.byType).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`  ${type}: ${count} files`);
      }
    });
    console.log();
    
    console.log('🏃 By Test Runner:');
    Object.entries(report.summary.byRunner).forEach(([runner, count]) => {
      if (count > 0) {
        console.log(`  ${runner}: ${count} files`);
      }
    });
    console.log();
    
    if (report.duplicates.length > 0) {
      console.log('🔄 Duplicate Files:');
      report.duplicates.forEach((group, index) => {
        console.log(`  Group ${index + 1}:`);
        group.forEach(file => console.log(`    - ${file}`));
      });
      console.log();
    }
    
    if (report.orphaned.length > 0) {
      console.log('🏷️  Orphaned Files:');
      report.orphaned.forEach(file => {
        console.log(`  - ${file.relativePath}`);
      });
      console.log();
    }
    
    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  - ${rec}`);
      });
    }
  }

  /**
   * Save report to JSON file
   */
  private async saveReport(report: TestInventoryReport, filePath: string): Promise<void> {
    const reportData = {
      ...report,
      generatedAt: new Date().toISOString(),
      generatedBy: 'TestFileRegistry CLI'
    };
    
    await fs.promises.writeFile(filePath, JSON.stringify(reportData, null, 2));
  }

  /**
   * Generate HTML report
   */
  private async generateHtmlReport(report: TestInventoryReport, filePath: string): Promise<void> {
    const html = this.generateHtmlContent(report);
    await fs.promises.writeFile(filePath, html);
  }

  /**
   * Generate HTML content for the report
   */
  private generateHtmlContent(report: TestInventoryReport): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Inventory Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
        .stat-label { color: #666; margin-top: 5px; }
        .category-section { margin: 20px 0; }
        .file-list { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .file-item { margin: 5px 0; padding: 5px; background: white; border-radius: 3px; }
        .valid { border-left: 4px solid #28a745; }
        .invalid { border-left: 4px solid #dc3545; }
        .error { color: #dc3545; font-size: 0.9em; margin-left: 20px; }
        .warning { color: #ffc107; font-size: 0.9em; margin-left: 20px; }
        .recommendations { background: #e7f3ff; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .duplicate-group { background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 4px solid #ffc107; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 Test Inventory Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        
        <div class="summary">
            <div class="stat-card">
                <div class="stat-number">${report.summary.totalFiles}</div>
                <div class="stat-label">Total Test Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.validFiles}</div>
                <div class="stat-label">Valid Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.summary.invalidFiles}</div>
                <div class="stat-label">Invalid Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${report.duplicates.length}</div>
                <div class="stat-label">Duplicate Groups</div>
            </div>
        </div>

        <h2>📊 Distribution by Category</h2>
        <table>
            <thead>
                <tr><th>Category</th><th>Files</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(report.summary.byType).map(([type, count]) => `
                    <tr>
                        <td>${type.charAt(0).toUpperCase() + type.slice(1)}</td>
                        <td>${count}</td>
                        <td>${((count / report.summary.totalFiles) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>🏃 Distribution by Test Runner</h2>
        <table>
            <thead>
                <tr><th>Runner</th><th>Files</th><th>Percentage</th></tr>
            </thead>
            <tbody>
                ${Object.entries(report.summary.byRunner).map(([runner, count]) => `
                    <tr>
                        <td>${runner.charAt(0).toUpperCase() + runner.slice(1)}</td>
                        <td>${count}</td>
                        <td>${((count / report.summary.totalFiles) * 100).toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        ${Object.entries(report.categories).map(([category, files]) => {
          if (files.length === 0) return '';
          return `
            <div class="category-section">
                <h2>📁 ${category.charAt(0).toUpperCase() + category.slice(1)} Tests (${files.length})</h2>
                <div class="file-list">
                    ${files.map((file: any) => `
                        <div class="file-item ${file.valid ? 'valid' : 'invalid'}">
                            <strong>${file.relativePath}</strong>
                            <span style="float: right; color: #666;">${file.runner} | ${(file.size / 1024).toFixed(1)}KB</span>
                            ${file.errors.map((error: string) => `<div class="error">❌ ${error}</div>`).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
          `;
        }).join('')}

        ${report.duplicates.length > 0 ? `
            <h2>🔄 Duplicate Files</h2>
            ${report.duplicates.map((group, index) => `
                <div class="duplicate-group">
                    <strong>Duplicate Group ${index + 1}:</strong>
                    ${group.map(file => `<div>• ${file}</div>`).join('')}
                </div>
            `).join('')}
        ` : ''}

        ${report.recommendations.length > 0 ? `
            <div class="recommendations">
                <h2>💡 Recommendations</h2>
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
    </div>
</body>
</html>`;
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log(`
🧪 Test File Registry CLI

Usage: node TestFileRegistryCLI.js [command] [options]

Commands:
  discover    Discover and categorize all test files (default)
  validate    Validate test files for syntax and patterns
  report      Generate comprehensive inventory report
  help        Show this help message

Examples:
  node TestFileRegistryCLI.js discover
  node TestFileRegistryCLI.js validate
  node TestFileRegistryCLI.js report ./reports/test-inventory.json
  node TestFileRegistryCLI.js help
`);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new TestFileRegistryCLI();
  cli.run().catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}