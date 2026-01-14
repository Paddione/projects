/**
 * Test Result Aggregation and Reporting System
 * Provides comprehensive reporting capabilities for all test types
 */
import * as fs from 'fs';
import * as path from 'path';
export class TestReporter {
    constructor(outputDir = 'test-reports') {
        this.artifacts = {
            screenshots: [],
            videos: [],
            logs: [],
            coverageReports: [],
            other: []
        };
        this.outputDir = outputDir;
        this.ensureDirectoryExists(this.outputDir);
    }
    /**
     * Aggregate multiple test results into a comprehensive summary
     */
    aggregateResults(results, startTime = new Date()) {
        const endTime = new Date();
        const testsByType = new Map();
        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalSkipped = 0;
        let totalDuration = 0;
        // Aggregate coverage data
        const coverageReports = [];
        for (const result of results) {
            testsByType.set(result.type, result);
            totalTests += result.passed + result.failed + result.skipped;
            totalPassed += result.passed;
            totalFailed += result.failed;
            totalSkipped += result.skipped;
            totalDuration += result.duration;
            if (result.coverage) {
                coverageReports.push(result.coverage);
            }
        }
        // Calculate overall coverage
        const overallCoverage = this.aggregateCoverage(coverageReports);
        return {
            totalTests,
            totalPassed,
            totalFailed,
            totalSkipped,
            totalDuration,
            overallCoverage,
            testsByType,
            startTime,
            endTime,
            success: totalFailed === 0
        };
    }
    /**
     * Aggregate coverage from multiple reports
     */
    aggregateCoverage(coverageReports) {
        if (coverageReports.length === 0) {
            return undefined;
        }
        let totalStatements = { covered: 0, total: 0 };
        let totalBranches = { covered: 0, total: 0 };
        let totalFunctions = { covered: 0, total: 0 };
        let totalLines = { covered: 0, total: 0 };
        for (const report of coverageReports) {
            totalStatements.covered += report.overall.statements.covered;
            totalStatements.total += report.overall.statements.total;
            totalBranches.covered += report.overall.branches.covered;
            totalBranches.total += report.overall.branches.total;
            totalFunctions.covered += report.overall.functions.covered;
            totalFunctions.total += report.overall.functions.total;
            totalLines.covered += report.overall.lines.covered;
            totalLines.total += report.overall.lines.total;
        }
        return {
            statements: {
                covered: totalStatements.covered,
                total: totalStatements.total,
                percentage: totalStatements.total > 0 ? (totalStatements.covered / totalStatements.total) * 100 : 100
            },
            branches: {
                covered: totalBranches.covered,
                total: totalBranches.total,
                percentage: totalBranches.total > 0 ? (totalBranches.covered / totalBranches.total) * 100 : 100
            },
            functions: {
                covered: totalFunctions.covered,
                total: totalFunctions.total,
                percentage: totalFunctions.total > 0 ? (totalFunctions.covered / totalFunctions.total) * 100 : 100
            },
            lines: {
                covered: totalLines.covered,
                total: totalLines.total,
                percentage: totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 100
            }
        };
    }
    /**
     * Collect artifacts from test results
     */
    collectArtifacts(results) {
        const artifacts = {
            screenshots: [],
            videos: [],
            logs: [],
            coverageReports: [],
            other: []
        };
        for (const result of results) {
            for (const artifactPath of result.artifacts) {
                const ext = path.extname(artifactPath).toLowerCase();
                const filename = path.basename(artifactPath);
                if (['.png', '.jpg', '.jpeg'].includes(ext)) {
                    artifacts.screenshots.push(artifactPath);
                }
                else if (['.mp4', '.webm', '.avi'].includes(ext)) {
                    artifacts.videos.push(artifactPath);
                }
                else if (['.log', '.txt'].includes(ext) || filename.includes('log')) {
                    artifacts.logs.push(artifactPath);
                }
                else if (filename.includes('coverage') || artifactPath.includes('coverage')) {
                    artifacts.coverageReports.push(artifactPath);
                }
                else {
                    artifacts.other.push(artifactPath);
                }
            }
        }
        this.artifacts = artifacts;
        return artifacts;
    }
    /**
     * Generate comprehensive test report in multiple formats
     */
    async generateReport(results, options, environment = 'local') {
        const summary = this.aggregateResults(results);
        const artifacts = options.includeArtifacts ? this.collectArtifacts(results) : this.artifacts;
        const reportData = {
            summary,
            results,
            coverage: results.map(r => r.coverage).filter(Boolean),
            artifacts,
            environment,
            timestamp: new Date(),
            version: this.getVersion()
        };
        const generatedReports = [];
        for (const format of options.formats) {
            try {
                const reportPath = await this.generateFormatReport(reportData, format, options);
                generatedReports.push(reportPath);
                console.log(`📄 Generated ${format.toUpperCase()} report: ${reportPath}`);
            }
            catch (error) {
                console.error(`❌ Failed to generate ${format} report:`, error);
            }
        }
        // Open browser if requested and HTML report was generated
        if (options.openBrowser && options.formats.includes('html')) {
            const htmlReport = generatedReports.find(path => path.endsWith('.html'));
            if (htmlReport) {
                this.openInBrowser(htmlReport);
            }
        }
        return generatedReports;
    }
    /**
     * Generate report in specific format
     */
    async generateFormatReport(data, format, options) {
        const timestamp = data.timestamp.toISOString().replace(/[:.]/g, '-');
        const filename = `test-report-${timestamp}`;
        switch (format) {
            case 'html':
                return this.generateHtmlReport(data, path.join(options.outputDir, `${filename}.html`));
            case 'json':
                return this.generateJsonReport(data, path.join(options.outputDir, `${filename}.json`));
            case 'xml':
                return this.generateXmlReport(data, path.join(options.outputDir, `${filename}.xml`));
            case 'markdown':
                return this.generateMarkdownReport(data, path.join(options.outputDir, `${filename}.md`));
            case 'console':
                return this.generateConsoleReport(data);
            default:
                throw new Error(`Unsupported report format: ${format}`);
        }
    }
    /**
     * Generate HTML report with interactive features
     */
    generateHtmlReport(data, outputPath) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - ${data.environment}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .meta { opacity: 0.9; margin-top: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.danger { border-left-color: #dc3545; }
        .metric.warning { border-left-color: #ffc107; }
        .metric .value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric .label { color: #6c757d; font-size: 0.9em; }
        .section { padding: 0 30px 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .test-type { margin-bottom: 30px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
        .test-type-header { background: #f8f9fa; padding: 15px 20px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
        .test-type-content { padding: 20px; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
        .status-success { background: #d4edda; color: #155724; }
        .status-danger { background: #f8d7da; color: #721c24; }
        .coverage-bar { background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .artifacts { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 20px; }
        .artifact-group { background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .artifact-group h4 { margin: 0 0 10px 0; color: #495057; }
        .artifact-list { list-style: none; padding: 0; margin: 0; }
        .artifact-list li { padding: 5px 0; border-bottom: 1px solid #dee2e6; }
        .artifact-list li:last-child { border-bottom: none; }
        .artifact-link { color: #007bff; text-decoration: none; }
        .artifact-link:hover { text-decoration: underline; }
        .duration { color: #6c757d; font-size: 0.9em; }
        .toggle { cursor: pointer; user-select: none; }
        .collapsible { display: none; }
        .collapsible.show { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Test Report</h1>
            <div class="meta">
                <div>Environment: <strong>${data.environment}</strong></div>
                <div>Generated: <strong>${data.timestamp.toLocaleString()}</strong></div>
                <div>Duration: <strong>${this.formatDuration(data.summary.totalDuration)}</strong></div>
            </div>
        </div>

        <div class="summary">
            <div class="metric ${data.summary.success ? 'success' : 'danger'}">
                <div class="value">${data.summary.success ? '✅' : '❌'}</div>
                <div class="label">Overall Status</div>
            </div>
            <div class="metric">
                <div class="value">${data.summary.totalTests}</div>
                <div class="label">Total Tests</div>
            </div>
            <div class="metric success">
                <div class="value">${data.summary.totalPassed}</div>
                <div class="label">Passed</div>
            </div>
            <div class="metric danger">
                <div class="value">${data.summary.totalFailed}</div>
                <div class="label">Failed</div>
            </div>
            <div class="metric warning">
                <div class="value">${data.summary.totalSkipped}</div>
                <div class="label">Skipped</div>
            </div>
            ${data.summary.overallCoverage ? `
            <div class="metric">
                <div class="value">${data.summary.overallCoverage.lines.percentage.toFixed(1)}%</div>
                <div class="label">Coverage</div>
            </div>
            ` : ''}
        </div>

        ${data.summary.overallCoverage ? `
        <div class="section">
            <h2>Coverage Summary</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
                ${this.generateCoverageMetric('Statements', data.summary.overallCoverage.statements)}
                ${this.generateCoverageMetric('Branches', data.summary.overallCoverage.branches)}
                ${this.generateCoverageMetric('Functions', data.summary.overallCoverage.functions)}
                ${this.generateCoverageMetric('Lines', data.summary.overallCoverage.lines)}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2>Test Results by Type</h2>
            ${Array.from(data.summary.testsByType.entries()).map(([type, result]) => `
                <div class="test-type">
                    <div class="test-type-header">
                        <span>${type.toUpperCase()} Tests</span>
                        <span class="status-badge ${result.failed > 0 ? 'status-danger' : 'status-success'}">
                            ${result.failed > 0 ? 'FAILED' : 'PASSED'}
                        </span>
                    </div>
                    <div class="test-type-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
                            <div><strong>Passed:</strong> ${result.passed}</div>
                            <div><strong>Failed:</strong> ${result.failed}</div>
                            <div><strong>Skipped:</strong> ${result.skipped}</div>
                            <div><strong>Duration:</strong> ${this.formatDuration(result.duration)}</div>
                        </div>
                        ${result.coverage ? `
                        <div class="toggle" onclick="toggleSection('coverage-${type}')">
                            <h4>📊 Coverage Details ▼</h4>
                        </div>
                        <div id="coverage-${type}" class="collapsible">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                                ${this.generateCoverageMetric('Statements', result.coverage.overall.statements)}
                                ${this.generateCoverageMetric('Branches', result.coverage.overall.branches)}
                                ${this.generateCoverageMetric('Functions', result.coverage.overall.functions)}
                                ${this.generateCoverageMetric('Lines', result.coverage.overall.lines)}
                            </div>
                        </div>
                        ` : ''}
                        ${result.artifacts.length > 0 ? `
                        <div class="toggle" onclick="toggleSection('artifacts-${type}')">
                            <h4>📎 Artifacts (${result.artifacts.length}) ▼</h4>
                        </div>
                        <div id="artifacts-${type}" class="collapsible">
                            <ul class="artifact-list">
                                ${result.artifacts.map(artifact => `
                                    <li><a href="${artifact}" class="artifact-link" target="_blank">${path.basename(artifact)}</a></li>
                                `).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        ${Object.values(data.artifacts).some(arr => arr.length > 0) ? `
        <div class="section">
            <h2>Artifacts</h2>
            <div class="artifacts">
                ${data.artifacts.screenshots.length > 0 ? `
                <div class="artifact-group">
                    <h4>📸 Screenshots (${data.artifacts.screenshots.length})</h4>
                    <ul class="artifact-list">
                        ${data.artifacts.screenshots.map(screenshot => `
                            <li><a href="${screenshot}" class="artifact-link" target="_blank">${path.basename(screenshot)}</a></li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                ${data.artifacts.videos.length > 0 ? `
                <div class="artifact-group">
                    <h4>🎥 Videos (${data.artifacts.videos.length})</h4>
                    <ul class="artifact-list">
                        ${data.artifacts.videos.map(video => `
                            <li><a href="${video}" class="artifact-link" target="_blank">${path.basename(video)}</a></li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                ${data.artifacts.logs.length > 0 ? `
                <div class="artifact-group">
                    <h4>📋 Logs (${data.artifacts.logs.length})</h4>
                    <ul class="artifact-list">
                        ${data.artifacts.logs.map(log => `
                            <li><a href="${log}" class="artifact-link" target="_blank">${path.basename(log)}</a></li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                ${data.artifacts.coverageReports.length > 0 ? `
                <div class="artifact-group">
                    <h4>📊 Coverage Reports (${data.artifacts.coverageReports.length})</h4>
                    <ul class="artifact-list">
                        ${data.artifacts.coverageReports.map(report => `
                            <li><a href="${report}" class="artifact-link" target="_blank">${path.basename(report)}</a></li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
    </div>

    <script>
        function toggleSection(id) {
            const element = document.getElementById(id);
            element.classList.toggle('show');
            const toggle = element.previousElementSibling;
            const arrow = toggle.textContent.includes('▼') ? '▲' : '▼';
            toggle.innerHTML = toggle.innerHTML.replace(/[▼▲]/, arrow);
        }
    </script>
</body>
</html>`;
        fs.writeFileSync(outputPath, html);
        return outputPath;
    }
    /**
     * Generate coverage metric HTML
     */
    generateCoverageMetric(label, metric) {
        const color = metric.percentage >= 80 ? '#28a745' : metric.percentage >= 60 ? '#ffc107' : '#dc3545';
        return `
      <div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span><strong>${label}:</strong></span>
          <span>${metric.percentage.toFixed(1)}%</span>
        </div>
        <div class="coverage-bar">
          <div class="coverage-fill" style="width: ${metric.percentage}%; background-color: ${color};"></div>
        </div>
        <div style="font-size: 0.8em; color: #6c757d;">${metric.covered}/${metric.total}</div>
      </div>
    `;
    }
    /**
     * Generate JSON report
     */
    generateJsonReport(data, outputPath) {
        const jsonData = {
            ...data,
            summary: {
                ...data.summary,
                testsByType: Object.fromEntries(data.summary.testsByType)
            }
        };
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
        return outputPath;
    }
    /**
     * Generate XML report (JUnit format)
     */
    generateXmlReport(data, outputPath) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Results" tests="${data.summary.totalTests}" failures="${data.summary.totalFailed}" skipped="${data.summary.totalSkipped}" time="${data.summary.totalDuration / 1000}">
${Array.from(data.summary.testsByType.entries()).map(([type, result]) => `
  <testsuite name="${type}" tests="${result.passed + result.failed + result.skipped}" failures="${result.failed}" skipped="${result.skipped}" time="${result.duration / 1000}">
    ${result.passed > 0 ? `<testcase name="${type}-passed" classname="${type}" time="${result.duration / 1000}"/>` : ''}
    ${result.failed > 0 ? `<testcase name="${type}-failed" classname="${type}" time="0"><failure message="Test failed">${result.error || 'Unknown error'}</failure></testcase>` : ''}
    ${result.skipped > 0 ? `<testcase name="${type}-skipped" classname="${type}" time="0"><skipped/></testcase>` : ''}
  </testsuite>
`).join('')}
</testsuites>`;
        fs.writeFileSync(outputPath, xml);
        return outputPath;
    }
    /**
     * Generate Markdown report
     */
    generateMarkdownReport(data, outputPath) {
        const markdown = `# Test Report

**Environment:** ${data.environment}  
**Generated:** ${data.timestamp.toLocaleString()}  
**Duration:** ${this.formatDuration(data.summary.totalDuration)}  
**Status:** ${data.summary.success ? '✅ PASSED' : '❌ FAILED'}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${data.summary.totalTests} |
| Passed | ${data.summary.totalPassed} |
| Failed | ${data.summary.totalFailed} |
| Skipped | ${data.summary.totalSkipped} |
${data.summary.overallCoverage ? `| Coverage | ${data.summary.overallCoverage.lines.percentage.toFixed(1)}% |` : ''}

${data.summary.overallCoverage ? `
## Coverage Summary

| Type | Covered | Total | Percentage |
|------|---------|-------|------------|
| Statements | ${data.summary.overallCoverage.statements.covered} | ${data.summary.overallCoverage.statements.total} | ${data.summary.overallCoverage.statements.percentage.toFixed(1)}% |
| Branches | ${data.summary.overallCoverage.branches.covered} | ${data.summary.overallCoverage.branches.total} | ${data.summary.overallCoverage.branches.percentage.toFixed(1)}% |
| Functions | ${data.summary.overallCoverage.functions.covered} | ${data.summary.overallCoverage.functions.total} | ${data.summary.overallCoverage.functions.percentage.toFixed(1)}% |
| Lines | ${data.summary.overallCoverage.lines.covered} | ${data.summary.overallCoverage.lines.total} | ${data.summary.overallCoverage.lines.percentage.toFixed(1)}% |
` : ''}

## Test Results by Type

${Array.from(data.summary.testsByType.entries()).map(([type, result]) => `
### ${type.toUpperCase()} Tests

**Status:** ${result.failed > 0 ? '❌ FAILED' : '✅ PASSED'}  
**Duration:** ${this.formatDuration(result.duration)}

| Metric | Value |
|--------|-------|
| Passed | ${result.passed} |
| Failed | ${result.failed} |
| Skipped | ${result.skipped} |

${result.artifacts.length > 0 ? `
**Artifacts:**
${result.artifacts.map(artifact => `- [${path.basename(artifact)}](${artifact})`).join('\n')}
` : ''}
`).join('')}

${Object.values(data.artifacts).some(arr => arr.length > 0) ? `
## Artifacts

${data.artifacts.screenshots.length > 0 ? `
### Screenshots
${data.artifacts.screenshots.map(screenshot => `- [${path.basename(screenshot)}](${screenshot})`).join('\n')}
` : ''}

${data.artifacts.videos.length > 0 ? `
### Videos
${data.artifacts.videos.map(video => `- [${path.basename(video)}](${video})`).join('\n')}
` : ''}

${data.artifacts.logs.length > 0 ? `
### Logs
${data.artifacts.logs.map(log => `- [${path.basename(log)}](${log})`).join('\n')}
` : ''}

${data.artifacts.coverageReports.length > 0 ? `
### Coverage Reports
${data.artifacts.coverageReports.map(report => `- [${path.basename(report)}](${report})`).join('\n')}
` : ''}
` : ''}
`;
        fs.writeFileSync(outputPath, markdown);
        return outputPath;
    }
    /**
     * Generate console report
     */
    generateConsoleReport(data) {
        const output = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                                TEST REPORT                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

Environment: ${data.environment}
Generated: ${data.timestamp.toLocaleString()}
Duration: ${this.formatDuration(data.summary.totalDuration)}
Status: ${data.summary.success ? '✅ PASSED' : '❌ FAILED'}

┌─────────────────────────────────────────────────────────────────────────────┐
│                                 SUMMARY                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Total Tests: ${data.summary.totalTests.toString().padStart(8)}                                           │
│ Passed:      ${data.summary.totalPassed.toString().padStart(8)}                                           │
│ Failed:      ${data.summary.totalFailed.toString().padStart(8)}                                           │
│ Skipped:     ${data.summary.totalSkipped.toString().padStart(8)}                                           │
${data.summary.overallCoverage ? `│ Coverage:    ${data.summary.overallCoverage.lines.percentage.toFixed(1).padStart(7)}%                                          │` : ''}
└─────────────────────────────────────────────────────────────────────────────┘

${Array.from(data.summary.testsByType.entries()).map(([type, result]) => `
┌─────────────────────────────────────────────────────────────────────────────┐
│ ${type.toUpperCase().padEnd(75)} │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status: ${(result.failed > 0 ? '❌ FAILED' : '✅ PASSED').padEnd(67)} │
│ Passed: ${result.passed.toString().padStart(8).padEnd(67)} │
│ Failed: ${result.failed.toString().padStart(8).padEnd(67)} │
│ Skipped: ${result.skipped.toString().padStart(7).padEnd(67)} │
│ Duration: ${this.formatDuration(result.duration).padEnd(65)} │
└─────────────────────────────────────────────────────────────────────────────┘
`).join('')}
`;
        console.log(output);
        return 'console';
    }
    /**
     * Format duration in human-readable format
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        }
        else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(1);
            return `${minutes}m ${seconds}s`;
        }
    }
    /**
     * Get version from package.json
     */
    getVersion() {
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(packagePath)) {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                return packageJson.version || '1.0.0';
            }
        }
        catch (error) {
            console.warn('Could not read version from package.json:', error);
        }
        return '1.0.0';
    }
    /**
     * Open report in browser
     */
    openInBrowser(filePath) {
        const open = require('open');
        open(filePath).catch((error) => {
            console.warn('Could not open browser:', error.message);
        });
    }
    /**
     * Ensure directory exists
     */
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
export default TestReporter;
