/**
 * Comprehensive Coverage Reporting System
 * Provides coverage report generation in multiple formats with threshold checking
 * and historical comparison capabilities
 */
import * as fs from 'fs';
import * as path from 'path';
export class CoverageReporter {
    constructor(outputDir = 'coverage-reports') {
        this.outputDir = outputDir;
        this.historicalDataFile = path.join(outputDir, 'historical-coverage.json');
        this.excludePatterns = [];
        this.ensureDirectoryExists(this.outputDir);
    }
    /**
     * Generate comprehensive coverage reports in multiple formats
     */
    async generateReport(coverageData, options) {
        console.log('📊 Generating coverage reports...');
        // Aggregate coverage data from multiple sources
        const aggregatedCoverage = this.aggregateCoverageData(coverageData);
        // Apply exclusion patterns
        if (options.excludePatterns) {
            this.setExcludePatterns(options.excludePatterns);
            this.applyCoverageExclusions(aggregatedCoverage);
        }
        // Check thresholds
        const thresholdResult = options.thresholds
            ? this.checkThresholds(aggregatedCoverage, options.thresholds)
            : { met: true, failures: [], summary: 'No thresholds configured' };
        // Load historical data if requested
        let historicalData = [];
        let trends = [];
        if (options.includeHistorical) {
            historicalData = this.loadHistoricalData();
            trends = this.calculateTrends(aggregatedCoverage.overall, historicalData);
            this.saveHistoricalData(aggregatedCoverage.overall);
        }
        const generatedReports = [];
        // Generate reports in requested formats
        for (const format of options.formats) {
            try {
                const reportPath = await this.generateFormatReport(aggregatedCoverage, format, options, thresholdResult, trends, historicalData);
                generatedReports.push(reportPath);
                console.log(`✅ Generated ${format.toUpperCase()} coverage report: ${reportPath}`);
            }
            catch (error) {
                console.error(`❌ Failed to generate ${format} coverage report:`, error);
            }
        }
        // Log threshold results
        if (!thresholdResult.met) {
            console.error('❌ Coverage thresholds not met:');
            for (const failure of thresholdResult.failures) {
                console.error(`  ${failure.metric}: ${failure.actual.toFixed(1)}% (expected: ${failure.expected}%, difference: ${failure.difference.toFixed(1)}%)`);
            }
        }
        else {
            console.log('✅ All coverage thresholds met');
        }
        return generatedReports;
    }
    /**
     * Check coverage thresholds with detailed failure reporting
     */
    checkThresholds(coverage, thresholds) {
        const failures = [];
        // Check each metric against thresholds
        const metrics = ['statements', 'branches', 'functions', 'lines'];
        for (const metric of metrics) {
            const actual = coverage.overall[metric].percentage;
            const expected = thresholds[metric];
            if (actual < expected) {
                failures.push({
                    metric,
                    actual,
                    expected,
                    difference: expected - actual
                });
            }
        }
        const met = failures.length === 0;
        const summary = met
            ? `All coverage thresholds met (${metrics.map(m => `${m}: ${coverage.overall[m].percentage.toFixed(1)}%`).join(', ')})`
            : `${failures.length} threshold(s) failed: ${failures.map(f => `${f.metric}: ${f.actual.toFixed(1)}% < ${f.expected}%`).join(', ')}`;
        return { met, failures, summary };
    }
    /**
     * Export coverage reports in multiple formats
     */
    async exportFormats(coverage, formats, outputDir) {
        const exportDir = outputDir || this.outputDir;
        const exports = {};
        for (const format of formats) {
            const exportPath = await this.generateFormatReport(coverage, format, { outputDir: exportDir, formats: [format], includeHistorical: false, includeUncovered: true, includeFileDetails: true });
            exports[format] = exportPath;
        }
        return exports;
    }
    /**
     * Aggregate coverage data from multiple reports
     */
    aggregateCoverageData(coverageData) {
        if (coverageData.length === 0) {
            throw new Error('No coverage data provided');
        }
        if (coverageData.length === 1) {
            return coverageData[0];
        }
        // Aggregate metrics from multiple reports
        let totalStatements = { covered: 0, total: 0 };
        let totalBranches = { covered: 0, total: 0 };
        let totalFunctions = { covered: 0, total: 0 };
        let totalLines = { covered: 0, total: 0 };
        const allFiles = new Map();
        const allDirectories = new Map();
        const allUncoveredLines = [];
        let allThresholdsMet = true;
        for (const report of coverageData) {
            // Aggregate overall metrics
            totalStatements.covered += report.overall.statements.covered;
            totalStatements.total += report.overall.statements.total;
            totalBranches.covered += report.overall.branches.covered;
            totalBranches.total += report.overall.branches.total;
            totalFunctions.covered += report.overall.functions.covered;
            totalFunctions.total += report.overall.functions.total;
            totalLines.covered += report.overall.lines.covered;
            totalLines.total += report.overall.lines.total;
            // Merge file-level data
            for (const [file, metrics] of report.byFile) {
                allFiles.set(file, metrics);
            }
            // Merge directory-level data
            for (const [dir, metrics] of report.byDirectory) {
                allDirectories.set(dir, metrics);
            }
            // Merge uncovered lines
            allUncoveredLines.push(...report.uncoveredLines);
            // Check if all thresholds are met
            if (!report.thresholdsMet) {
                allThresholdsMet = false;
            }
        }
        // Calculate aggregated percentages
        const overall = {
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
        return {
            overall,
            byFile: allFiles,
            byDirectory: allDirectories,
            uncoveredLines: allUncoveredLines,
            thresholdsMet: allThresholdsMet
        };
    }
    /**
     * Generate report in specific format
     */
    async generateFormatReport(coverage, format, options, thresholdResult, trends, historicalData) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        switch (format) {
            case 'html':
                return this.generateHtmlReport(coverage, options, thresholdResult, trends, historicalData);
            case 'lcov':
                return this.generateLcovReport(coverage, options);
            case 'json':
                return this.generateJsonReport(coverage, options, thresholdResult, trends);
            case 'xml':
                return this.generateXmlReport(coverage, options);
            case 'text':
                return this.generateTextReport(coverage, options, thresholdResult);
            case 'badge':
                return this.generateBadgeReport(coverage, options);
            default:
                throw new Error(`Unsupported coverage report format: ${format}`);
        }
    }
    /**
     * Generate HTML coverage report with interactive features
     */
    generateHtmlReport(coverage, options, thresholdResult, trends, historicalData) {
        const outputPath = path.join(options.outputDir, 'coverage-report.html');
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2.5em; }
        .header .meta { opacity: 0.9; margin-top: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; position: relative; }
        .metric.excellent { border-left: 4px solid #28a745; }
        .metric.good { border-left: 4px solid #20c997; }
        .metric.warning { border-left: 4px solid #ffc107; }
        .metric.danger { border-left: 4px solid #dc3545; }
        .metric .value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric .label { color: #6c757d; font-size: 0.9em; }
        .metric .trend { position: absolute; top: 10px; right: 10px; font-size: 0.8em; }
        .trend.improving { color: #28a745; }
        .trend.declining { color: #dc3545; }
        .trend.stable { color: #6c757d; }
        .section { padding: 0 30px 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .coverage-bar { background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; position: relative; }
        .coverage-fill { height: 100%; transition: width 0.3s ease; }
        .coverage-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.8em; font-weight: bold; color: #333; }
        .file-list { max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid #dee2e6; }
        .file-item:last-child { border-bottom: none; }
        .file-item:hover { background: #f8f9fa; }
        .file-name { font-family: monospace; font-size: 0.9em; }
        .file-coverage { display: flex; align-items: center; gap: 10px; }
        .threshold-status { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .threshold-status.success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .threshold-status.danger { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
        .threshold-failure { margin: 5px 0; font-family: monospace; font-size: 0.9em; }
        .uncovered-lines { max-height: 300px; overflow-y: auto; background: #f8f9fa; border-radius: 4px; padding: 15px; }
        .uncovered-line { font-family: monospace; font-size: 0.8em; margin: 2px 0; }
        .historical-chart { height: 300px; background: #f8f9fa; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #6c757d; }
        .toggle { cursor: pointer; user-select: none; color: #007bff; }
        .collapsible { display: none; }
        .collapsible.show { display: block; }
        .tabs { display: flex; border-bottom: 1px solid #dee2e6; margin-bottom: 20px; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { border-bottom-color: #007bff; color: #007bff; font-weight: bold; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Coverage Report</h1>
            <div class="meta">
                <div>Generated: <strong>${new Date().toLocaleString()}</strong></div>
                <div>Files: <strong>${coverage.byFile.size}</strong></div>
                <div>Uncovered Lines: <strong>${coverage.uncoveredLines.length}</strong></div>
            </div>
        </div>

        <div class="summary">
            ${this.generateCoverageMetricHtml('Statements', coverage.overall.statements, trends?.find(t => t.metric === 'statements'))}
            ${this.generateCoverageMetricHtml('Branches', coverage.overall.branches, trends?.find(t => t.metric === 'branches'))}
            ${this.generateCoverageMetricHtml('Functions', coverage.overall.functions, trends?.find(t => t.metric === 'functions'))}
            ${this.generateCoverageMetricHtml('Lines', coverage.overall.lines, trends?.find(t => t.metric === 'lines'))}
        </div>

        ${thresholdResult ? `
        <div class="section">
            <div class="threshold-status ${thresholdResult.met ? 'success' : 'danger'}">
                <h3>${thresholdResult.met ? '✅' : '❌'} Coverage Thresholds</h3>
                <p>${thresholdResult.summary}</p>
                ${!thresholdResult.met ? `
                <div>
                    <strong>Failures:</strong>
                    ${thresholdResult.failures.map(f => `
                        <div class="threshold-failure">
                            ${f.metric}: ${f.actual.toFixed(1)}% (expected: ${f.expected}%, need: +${f.difference.toFixed(1)}%)
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <div class="section">
            <div class="tabs">
                <div class="tab active" onclick="showTab('files')">📁 Files</div>
                <div class="tab" onclick="showTab('uncovered')">🔍 Uncovered Lines</div>
                ${trends && trends.length > 0 ? '<div class="tab" onclick="showTab(\'trends\')">📈 Trends</div>' : ''}
            </div>

            <div id="files" class="tab-content active">
                <h2>File Coverage</h2>
                <div class="file-list">
                    ${Array.from(coverage.byFile.entries()).map(([file, metrics]) => `
                        <div class="file-item">
                            <div class="file-name">${file}</div>
                            <div class="file-coverage">
                                <div style="width: 100px;">
                                    <div class="coverage-bar">
                                        <div class="coverage-fill" style="width: ${metrics.lines.percentage}%; background-color: ${this.getCoverageColor(metrics.lines.percentage)};"></div>
                                        <div class="coverage-text">${metrics.lines.percentage.toFixed(1)}%</div>
                                    </div>
                                </div>
                                <span style="font-size: 0.8em; color: #6c757d;">${metrics.lines.covered}/${metrics.lines.total}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div id="uncovered" class="tab-content">
                <h2>Uncovered Lines (${coverage.uncoveredLines.length})</h2>
                ${coverage.uncoveredLines.length > 0 ? `
                <div class="uncovered-lines">
                    ${coverage.uncoveredLines.map(line => `
                        <div class="uncovered-line">
                            <span style="color: #dc3545;">●</span> ${line.file}:${line.line} (${line.type})
                        </div>
                    `).join('')}
                </div>
                ` : '<p>🎉 All lines are covered!</p>'}
            </div>

            ${trends && trends.length > 0 ? `
            <div id="trends" class="tab-content">
                <h2>Coverage Trends</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    ${trends.map(trend => `
                        <div class="metric">
                            <div class="value ${trend.trend}">${trend.current.toFixed(1)}%</div>
                            <div class="label">${trend.metric}</div>
                            <div class="trend ${trend.trend}">
                                ${trend.trend === 'improving' ? '↗' : trend.trend === 'declining' ? '↘' : '→'} 
                                ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${historicalData && historicalData.length > 1 ? `
                <div class="historical-chart">
                    📈 Historical coverage chart would be rendered here
                    <br><small>Showing ${historicalData.length} data points</small>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
    </div>

    <script>
        function showTab(tabName) {
            // Hide all tab contents
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(content => content.classList.remove('active'));
            
            // Remove active class from all tabs
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Show selected tab content
            document.getElementById(tabName).classList.add('active');
            
            // Add active class to clicked tab
            event.target.classList.add('active');
        }
    </script>
</body>
</html>`;
        fs.writeFileSync(outputPath, html);
        return outputPath;
    }
    /**
     * Generate coverage metric HTML with trend information
     */
    generateCoverageMetricHtml(label, metric, trend) {
        const cssClass = this.getCoverageClass(metric.percentage);
        const trendHtml = trend ? `
      <div class="trend ${trend.trend}">
        ${trend.trend === 'improving' ? '↗' : trend.trend === 'declining' ? '↘' : '→'} 
        ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%
      </div>
    ` : '';
        return `
      <div class="metric ${cssClass}">
        <div class="value">${metric.percentage.toFixed(1)}%</div>
        <div class="label">${label}</div>
        <div style="font-size: 0.8em; color: #6c757d; margin-top: 5px;">
          ${metric.covered}/${metric.total}
        </div>
        ${trendHtml}
      </div>
    `;
    }
    /**
     * Generate LCOV format report
     */
    generateLcovReport(coverage, options) {
        const outputPath = path.join(options.outputDir, 'lcov.info');
        let lcovContent = '';
        for (const [file, metrics] of coverage.byFile) {
            lcovContent += `SF:${file}\n`;
            lcovContent += `FNF:${metrics.functions.total}\n`;
            lcovContent += `FNH:${metrics.functions.covered}\n`;
            lcovContent += `LF:${metrics.lines.total}\n`;
            lcovContent += `LH:${metrics.lines.covered}\n`;
            lcovContent += `BRF:${metrics.branches.total}\n`;
            lcovContent += `BRH:${metrics.branches.covered}\n`;
            lcovContent += `end_of_record\n`;
        }
        fs.writeFileSync(outputPath, lcovContent);
        return outputPath;
    }
    /**
     * Generate JSON format report
     */
    generateJsonReport(coverage, options, thresholdResult, trends) {
        const outputPath = path.join(options.outputDir, 'coverage-report.json');
        const jsonData = {
            timestamp: new Date().toISOString(),
            overall: coverage.overall,
            byFile: Object.fromEntries(coverage.byFile),
            byDirectory: Object.fromEntries(coverage.byDirectory),
            uncoveredLines: coverage.uncoveredLines,
            thresholdsMet: coverage.thresholdsMet,
            thresholdResult,
            trends,
            summary: {
                totalFiles: coverage.byFile.size,
                totalUncoveredLines: coverage.uncoveredLines.length,
                averageCoverage: (coverage.overall.statements.percentage +
                    coverage.overall.branches.percentage +
                    coverage.overall.functions.percentage +
                    coverage.overall.lines.percentage) / 4
            }
        };
        fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2));
        return outputPath;
    }
    /**
     * Generate XML format report (Cobertura format)
     */
    generateXmlReport(coverage, options) {
        const outputPath = path.join(options.outputDir, 'coverage-report.xml');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<coverage line-rate="${(coverage.overall.lines.percentage / 100).toFixed(4)}" 
          branch-rate="${(coverage.overall.branches.percentage / 100).toFixed(4)}" 
          lines-covered="${coverage.overall.lines.covered}" 
          lines-valid="${coverage.overall.lines.total}" 
          branches-covered="${coverage.overall.branches.covered}" 
          branches-valid="${coverage.overall.branches.total}" 
          complexity="0" 
          version="1.0" 
          timestamp="${Date.now()}">
  <sources>
    <source>.</source>
  </sources>
  <packages>
    ${Array.from(coverage.byDirectory.entries()).map(([dir, metrics]) => `
    <package name="${dir}" line-rate="${(metrics.lines.percentage / 100).toFixed(4)}" branch-rate="${(metrics.branches.percentage / 100).toFixed(4)}">
      <classes>
        ${Array.from(coverage.byFile.entries())
            .filter(([file]) => file.startsWith(dir))
            .map(([file, fileMetrics]) => `
        <class name="${path.basename(file, path.extname(file))}" filename="${file}" line-rate="${(fileMetrics.lines.percentage / 100).toFixed(4)}" branch-rate="${(fileMetrics.branches.percentage / 100).toFixed(4)}" complexity="0">
          <methods/>
          <lines/>
        </class>
        `).join('')}
      </classes>
    </package>
    `).join('')}
  </packages>
</coverage>`;
        fs.writeFileSync(outputPath, xml);
        return outputPath;
    }
    /**
     * Generate text format report
     */
    generateTextReport(coverage, options, thresholdResult) {
        const outputPath = path.join(options.outputDir, 'coverage-report.txt');
        const report = `
COVERAGE REPORT
===============

Generated: ${new Date().toLocaleString()}
Files: ${coverage.byFile.size}
Uncovered Lines: ${coverage.uncoveredLines.length}

OVERALL COVERAGE
================
Statements: ${coverage.overall.statements.percentage.toFixed(2)}% (${coverage.overall.statements.covered}/${coverage.overall.statements.total})
Branches:   ${coverage.overall.branches.percentage.toFixed(2)}% (${coverage.overall.branches.covered}/${coverage.overall.branches.total})
Functions:  ${coverage.overall.functions.percentage.toFixed(2)}% (${coverage.overall.functions.covered}/${coverage.overall.functions.total})
Lines:      ${coverage.overall.lines.percentage.toFixed(2)}% (${coverage.overall.lines.covered}/${coverage.overall.lines.total})

${thresholdResult ? `
THRESHOLD CHECK
===============
Status: ${thresholdResult.met ? 'PASSED' : 'FAILED'}
${thresholdResult.summary}

${!thresholdResult.met ? `
Failures:
${thresholdResult.failures.map(f => `  ${f.metric}: ${f.actual.toFixed(1)}% < ${f.expected}% (need +${f.difference.toFixed(1)}%)`).join('\n')}
` : ''}
` : ''}

FILE COVERAGE
=============
${Array.from(coverage.byFile.entries())
            .sort(([, a], [, b]) => a.lines.percentage - b.lines.percentage)
            .map(([file, metrics]) => `${file.padEnd(60)} ${metrics.lines.percentage.toFixed(1).padStart(6)}% (${metrics.lines.covered}/${metrics.lines.total})`).join('\n')}

${coverage.uncoveredLines.length > 0 ? `
UNCOVERED LINES
===============
${coverage.uncoveredLines.map(line => `${line.file}:${line.line} (${line.type})`).join('\n')}
` : ''}
`;
        fs.writeFileSync(outputPath, report);
        return outputPath;
    }
    /**
     * Generate coverage badge
     */
    generateBadgeReport(coverage, options) {
        const outputPath = path.join(options.outputDir, 'coverage-badge.svg');
        const percentage = coverage.overall.lines.percentage;
        const badge = this.createCoverageBadge(percentage);
        fs.writeFileSync(outputPath, badge.svg);
        return outputPath;
    }
    /**
     * Create coverage badge SVG
     */
    createCoverageBadge(percentage) {
        const color = this.getCoverageColor(percentage);
        const status = `${percentage.toFixed(1)}%`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="104" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h63v20H0z"/>
    <path fill="${color}" d="M63 0h41v20H63z"/>
    <path fill="url(#b)" d="M0 0h104v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="31.5" y="15" fill="#010101" fill-opacity=".3">coverage</text>
    <text x="31.5" y="14">coverage</text>
    <text x="82.5" y="15" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="82.5" y="14">${status}</text>
  </g>
</svg>`;
        return {
            subject: 'coverage',
            status,
            color,
            svg
        };
    }
    /**
     * Load historical coverage data
     */
    loadHistoricalData() {
        try {
            if (fs.existsSync(this.historicalDataFile)) {
                const data = fs.readFileSync(this.historicalDataFile, 'utf8');
                return JSON.parse(data).map((item) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
            }
        }
        catch (error) {
            console.warn('Failed to load historical coverage data:', error);
        }
        return [];
    }
    /**
     * Save historical coverage data
     */
    saveHistoricalData(coverage) {
        try {
            const historicalData = this.loadHistoricalData();
            // Add current data
            historicalData.push({
                timestamp: new Date(),
                commit: process.env.GIT_COMMIT,
                branch: process.env.GIT_BRANCH,
                coverage,
                testCount: coverage.lines.total
            });
            // Keep only last 100 entries
            const trimmedData = historicalData.slice(-100);
            fs.writeFileSync(this.historicalDataFile, JSON.stringify(trimmedData, null, 2));
        }
        catch (error) {
            console.warn('Failed to save historical coverage data:', error);
        }
    }
    /**
     * Calculate coverage trends
     */
    calculateTrends(current, historicalData) {
        if (historicalData.length < 2) {
            return [];
        }
        const previous = historicalData[historicalData.length - 2].coverage;
        const trends = [];
        const metrics = ['statements', 'branches', 'functions', 'lines'];
        for (const metric of metrics) {
            const currentValue = current[metric].percentage;
            const previousValue = previous[metric].percentage;
            const change = currentValue - previousValue;
            let trend;
            if (Math.abs(change) < 0.1) {
                trend = 'stable';
            }
            else if (change > 0) {
                trend = 'improving';
            }
            else {
                trend = 'declining';
            }
            trends.push({
                metric,
                current: currentValue,
                previous: previousValue,
                change,
                trend
            });
        }
        return trends;
    }
    /**
     * Set exclusion patterns for coverage filtering
     */
    setExcludePatterns(patterns) {
        this.excludePatterns = patterns.map(pattern => {
            // Convert glob patterns to regex
            const regexPattern = pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.');
            return new RegExp(regexPattern);
        });
    }
    /**
     * Apply coverage exclusions
     */
    applyCoverageExclusions(coverage) {
        if (this.excludePatterns.length === 0) {
            return;
        }
        // Filter out excluded files
        for (const [file] of coverage.byFile) {
            if (this.shouldExcludeFile(file)) {
                coverage.byFile.delete(file);
            }
        }
        // Filter out excluded uncovered lines
        coverage.uncoveredLines = coverage.uncoveredLines.filter(line => !this.shouldExcludeFile(line.file));
    }
    /**
     * Check if file should be excluded
     */
    shouldExcludeFile(file) {
        return this.excludePatterns.some(pattern => pattern.test(file));
    }
    /**
     * Get coverage color based on percentage
     */
    getCoverageColor(percentage) {
        if (percentage >= 90)
            return '#28a745';
        if (percentage >= 80)
            return '#20c997';
        if (percentage >= 70)
            return '#ffc107';
        if (percentage >= 60)
            return '#fd7e14';
        return '#dc3545';
    }
    /**
     * Get coverage CSS class based on percentage
     */
    getCoverageClass(percentage) {
        if (percentage >= 90)
            return 'excellent';
        if (percentage >= 80)
            return 'good';
        if (percentage >= 70)
            return 'warning';
        return 'danger';
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
export default CoverageReporter;
