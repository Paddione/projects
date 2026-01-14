/**
 * Performance Testing Framework
 * Implements comprehensive performance metrics collection, load testing scenarios,
 * and performance threshold checking with regression detection
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TestConfigManager } from './TestConfigManager.js';
export class PerformanceTestFramework {
    constructor(configPath) {
        this.runningProcesses = new Map();
        this.configManager = TestConfigManager.getInstance(configPath);
        this.projectRoot = this.findProjectRoot();
        this.baselineDir = path.join(this.projectRoot, 'performance-baselines');
        this.artifactDir = path.join(this.projectRoot, 'test-artifacts', 'performance');
        this.ensureDirectoryExists(this.baselineDir);
        this.ensureDirectoryExists(this.artifactDir);
    }
    /**
     * Run comprehensive performance test suite
     */
    async runPerformanceTests(context) {
        console.log('🚀 Starting performance test suite...');
        const scenarios = this.getLoadTestScenarios();
        const results = [];
        // Ensure services are ready
        await this.ensureServicesReady(context);
        // Warm up services
        await this.warmUpServices(context);
        for (const scenario of scenarios) {
            console.log(`⚡ Running performance scenario: ${scenario.name}`);
            try {
                const result = await this.runLoadTestScenario(scenario, context);
                results.push(result);
                // Brief pause between scenarios to allow system recovery
                await this.sleep(5000);
            }
            catch (error) {
                console.error(`❌ Performance scenario failed: ${scenario.name}`, error);
                results.push({
                    scenario: scenario.name,
                    startTime: new Date(),
                    endTime: new Date(),
                    duration: 0,
                    metrics: this.getEmptyMetrics(),
                    thresholdsPassed: false,
                    thresholdFailures: [`Scenario execution failed: ${error}`],
                    artifacts: []
                });
            }
        }
        // Generate performance report
        await this.generatePerformanceReport(results);
        console.log('✅ Performance test suite completed');
        return results;
    }
    /**
     * Run a single load test scenario
     */
    async runLoadTestScenario(scenario, context) {
        const startTime = new Date();
        const scenarioArtifactDir = path.join(this.artifactDir, scenario.name);
        this.ensureDirectoryExists(scenarioArtifactDir);
        console.log(`📊 Scenario: ${scenario.description}`);
        console.log(`👥 Virtual Users: ${scenario.virtualUsers}`);
        console.log(`⏱️  Duration: ${scenario.duration}s`);
        console.log(`📈 Ramp-up: ${scenario.rampUpTime}s`);
        // Start system monitoring
        const monitoringProcess = this.startSystemMonitoring(scenarioArtifactDir);
        try {
            // Execute load test
            const loadTestResult = await this.executeLoadTest(scenario, context, scenarioArtifactDir);
            // Stop monitoring
            this.stopProcess(monitoringProcess);
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            // Collect and analyze metrics
            const metrics = await this.collectMetrics(scenarioArtifactDir, loadTestResult);
            // Check thresholds
            const thresholdResult = this.checkThresholds(metrics, scenario.thresholds);
            // Load baseline for comparison
            const baseline = await this.loadBaseline(scenario.name, context.environment);
            // Detect regression
            const regression = baseline ? this.detectRegression(metrics, baseline.metrics) : undefined;
            // Save new baseline if this is a good run
            if (thresholdResult.passed && !regression?.detected) {
                await this.saveBaseline(scenario.name, metrics, context.environment);
            }
            // Collect artifacts
            const artifacts = await this.collectArtifacts(scenarioArtifactDir);
            const result = {
                scenario: scenario.name,
                startTime,
                endTime,
                duration,
                metrics,
                thresholdsPassed: thresholdResult.passed,
                thresholdFailures: thresholdResult.failures,
                baseline: baseline?.metrics,
                regression,
                artifacts
            };
            this.logScenarioResult(result);
            return result;
        }
        catch (error) {
            this.stopProcess(monitoringProcess);
            throw error;
        }
    }
    /**
     * Execute load test using Artillery or custom implementation
     */
    async executeLoadTest(scenario, context, artifactDir) {
        // Create Artillery configuration
        const artilleryConfig = this.createArtilleryConfig(scenario, context);
        const configPath = path.join(artifactDir, 'artillery-config.yml');
        fs.writeFileSync(configPath, artilleryConfig);
        // Run Artillery load test
        return new Promise((resolve, reject) => {
            const outputFile = path.join(artifactDir, 'artillery-output.json');
            const process = spawn('npx', ['artillery', 'run', '--output', outputFile, configPath], {
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            process.stdout?.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                console.log(chunk);
            });
            process.stderr?.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                console.error(chunk);
            });
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = fs.existsSync(outputFile)
                            ? JSON.parse(fs.readFileSync(outputFile, 'utf8'))
                            : { output, errorOutput };
                        resolve(result);
                    }
                    catch (error) {
                        resolve({ output, errorOutput });
                    }
                }
                else {
                    reject(new Error(`Artillery process exited with code ${code}: ${errorOutput}`));
                }
            });
            process.on('error', (error) => {
                reject(error);
            });
            // Store process for cleanup
            const processId = `artillery-${Date.now()}`;
            this.runningProcesses.set(processId, process);
            process.on('close', () => {
                this.runningProcesses.delete(processId);
            });
        });
    }
    /**
     * Create Artillery configuration for load test scenario
     */
    createArtilleryConfig(scenario, context) {
        const baseUrl = `http://localhost:${context.environment_config.services.backend.port}`;
        const config = {
            config: {
                target: baseUrl,
                phases: [
                    {
                        duration: scenario.rampUpTime,
                        arrivalRate: 1,
                        rampTo: scenario.virtualUsers,
                        name: 'Ramp up'
                    },
                    {
                        duration: scenario.duration - scenario.rampUpTime,
                        arrivalRate: scenario.virtualUsers,
                        name: 'Sustained load'
                    }
                ],
                defaults: {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            },
            scenarios: [
                {
                    name: scenario.name,
                    weight: 100,
                    flow: scenario.endpoints.map(endpoint => ({
                        [endpoint.method.toLowerCase()]: {
                            url: endpoint.url,
                            headers: endpoint.headers || {},
                            json: endpoint.body || undefined,
                            expect: endpoint.expectedStatusCode ? [{ statusCode: endpoint.expectedStatusCode }] : undefined
                        }
                    }))
                }
            ]
        };
        return JSON.stringify(config, null, 2);
    }
    /**
     * Start system monitoring during load test
     */
    startSystemMonitoring(artifactDir) {
        const monitoringScript = this.createMonitoringScript(artifactDir);
        const scriptPath = path.join(artifactDir, 'monitor.js');
        fs.writeFileSync(scriptPath, monitoringScript);
        const process = spawn('node', [scriptPath], {
            cwd: this.projectRoot,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        const processId = `monitor-${Date.now()}`;
        this.runningProcesses.set(processId, process);
        process.on('close', () => {
            this.runningProcesses.delete(processId);
        });
        return process;
    }
    /**
     * Create system monitoring script
     */
    createMonitoringScript(artifactDir) {
        return `
const fs = require('fs');
const path = require('path');
const os = require('os');

const metricsFile = path.join('${artifactDir}', 'system-metrics.json');
const metrics = [];

function collectMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const loadAvg = os.loadavg();
  
  const metric = {
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
      heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
      external: memUsage.external / 1024 / 1024, // MB
      rss: memUsage.rss / 1024 / 1024 // MB
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    system: {
      loadAverage: loadAvg,
      freeMemory: os.freemem() / 1024 / 1024, // MB
      totalMemory: os.totalmem() / 1024 / 1024 // MB
    }
  };
  
  metrics.push(metric);
  
  // Write metrics to file periodically
  if (metrics.length % 10 === 0) {
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  }
}

// Collect metrics every second
const interval = setInterval(collectMetrics, 1000);

// Handle cleanup
process.on('SIGTERM', () => {
  clearInterval(interval);
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  process.exit(0);
});

process.on('SIGINT', () => {
  clearInterval(interval);
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  process.exit(0);
});

console.log('System monitoring started...');
`;
    }
    /**
     * Collect and analyze performance metrics
     */
    async collectMetrics(artifactDir, loadTestResult) {
        // Parse Artillery results
        const artilleryMetrics = this.parseArtilleryResults(loadTestResult);
        // Parse system monitoring results
        const systemMetrics = await this.parseSystemMetrics(artifactDir);
        // Combine metrics
        return {
            responseTime: artilleryMetrics.responseTime || { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
            throughput: artilleryMetrics.throughput || { requestsPerSecond: 0, totalRequests: 0, successfulRequests: 0, failedRequests: 0 },
            memory: systemMetrics.memory || this.getEmptyMemoryMetrics(),
            cpu: systemMetrics.cpu || { usage: 0, loadAverage: [0, 0, 0] },
            network: artilleryMetrics.network || { bytesReceived: 0, bytesSent: 0, connections: 0 },
            errors: artilleryMetrics.errors || { total: 0, byType: new Map(), errorRate: 0 }
        };
    }
    /**
     * Parse Artillery load test results
     */
    parseArtilleryResults(result) {
        const aggregate = result.aggregate || {};
        return {
            responseTime: {
                min: aggregate.latency?.min || 0,
                max: aggregate.latency?.max || 0,
                avg: aggregate.latency?.mean || 0,
                p50: aggregate.latency?.p50 || 0,
                p95: aggregate.latency?.p95 || 0,
                p99: aggregate.latency?.p99 || 0
            },
            throughput: {
                requestsPerSecond: aggregate.rps?.mean || 0,
                totalRequests: aggregate.requestsCompleted || 0,
                successfulRequests: aggregate.codes?.[200] || 0,
                failedRequests: (aggregate.requestsCompleted || 0) - (aggregate.codes?.[200] || 0)
            },
            network: {
                bytesReceived: 0, // Artillery doesn't provide this by default
                bytesSent: 0,
                connections: aggregate.scenariosCompleted || 0
            },
            errors: {
                total: aggregate.errors || 0,
                byType: new Map(),
                errorRate: aggregate.errors ? (aggregate.errors / (aggregate.requestsCompleted || 1)) * 100 : 0
            }
        };
    }
    /**
     * Parse system monitoring metrics
     */
    async parseSystemMetrics(artifactDir) {
        const metricsFile = path.join(artifactDir, 'system-metrics.json');
        if (!fs.existsSync(metricsFile)) {
            return {
                memory: this.getEmptyMemoryMetrics(),
                cpu: { usage: 0, loadAverage: [0, 0, 0] }
            };
        }
        try {
            const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
            if (!Array.isArray(metrics) || metrics.length === 0) {
                return {
                    memory: this.getEmptyMemoryMetrics(),
                    cpu: { usage: 0, loadAverage: [0, 0, 0] }
                };
            }
            // Calculate aggregated metrics
            const memoryMetrics = metrics.map(m => m.memory);
            const cpuMetrics = metrics.map(m => m.cpu);
            const systemMetrics = metrics.map(m => m.system);
            return {
                memory: {
                    heapUsed: this.calculateAverage(memoryMetrics.map(m => m.heapUsed)),
                    heapTotal: this.calculateAverage(memoryMetrics.map(m => m.heapTotal)),
                    external: this.calculateAverage(memoryMetrics.map(m => m.external)),
                    rss: this.calculateAverage(memoryMetrics.map(m => m.rss)),
                    peak: Math.max(...memoryMetrics.map(m => m.rss))
                },
                cpu: {
                    usage: this.calculateCpuUsage(cpuMetrics),
                    loadAverage: systemMetrics[systemMetrics.length - 1]?.loadAverage || [0, 0, 0]
                }
            };
        }
        catch (error) {
            console.warn('Failed to parse system metrics:', error);
            return {
                memory: this.getEmptyMemoryMetrics(),
                cpu: { usage: 0, loadAverage: [0, 0, 0] }
            };
        }
    }
    /**
     * Check performance thresholds
     */
    checkThresholds(metrics, thresholds) {
        const failures = [];
        // Response time thresholds
        if (metrics.responseTime.avg > thresholds.responseTime.avg) {
            failures.push(`Average response time ${metrics.responseTime.avg}ms exceeds threshold ${thresholds.responseTime.avg}ms`);
        }
        if (metrics.responseTime.p95 > thresholds.responseTime.p95) {
            failures.push(`95th percentile response time ${metrics.responseTime.p95}ms exceeds threshold ${thresholds.responseTime.p95}ms`);
        }
        if (metrics.responseTime.p99 > thresholds.responseTime.p99) {
            failures.push(`99th percentile response time ${metrics.responseTime.p99}ms exceeds threshold ${thresholds.responseTime.p99}ms`);
        }
        // Throughput thresholds
        if (metrics.throughput.requestsPerSecond < thresholds.throughput.minRequestsPerSecond) {
            failures.push(`Requests per second ${metrics.throughput.requestsPerSecond} below threshold ${thresholds.throughput.minRequestsPerSecond}`);
        }
        // Memory thresholds
        if (metrics.memory.heapUsed > thresholds.memory.maxHeapUsed) {
            failures.push(`Heap usage ${metrics.memory.heapUsed}MB exceeds threshold ${thresholds.memory.maxHeapUsed}MB`);
        }
        if (metrics.memory.rss > thresholds.memory.maxRss) {
            failures.push(`RSS memory ${metrics.memory.rss}MB exceeds threshold ${thresholds.memory.maxRss}MB`);
        }
        // CPU thresholds
        if (metrics.cpu.usage > thresholds.cpu.maxUsage) {
            failures.push(`CPU usage ${metrics.cpu.usage}% exceeds threshold ${thresholds.cpu.maxUsage}%`);
        }
        // Error rate thresholds
        if (metrics.errors.errorRate > thresholds.errorRate.maxPercentage) {
            failures.push(`Error rate ${metrics.errors.errorRate}% exceeds threshold ${thresholds.errorRate.maxPercentage}%`);
        }
        return {
            passed: failures.length === 0,
            failures
        };
    }
    /**
     * Detect performance regression compared to baseline
     */
    detectRegression(current, baseline) {
        const details = [];
        const regressionThreshold = 0.2; // 20% degradation threshold
        // Response time regression
        const responseTimeIncrease = (current.responseTime.avg - baseline.responseTime.avg) / baseline.responseTime.avg;
        if (responseTimeIncrease > regressionThreshold) {
            details.push(`Response time regression: ${(responseTimeIncrease * 100).toFixed(1)}% increase`);
        }
        // Throughput regression
        const throughputDecrease = (baseline.throughput.requestsPerSecond - current.throughput.requestsPerSecond) / baseline.throughput.requestsPerSecond;
        if (throughputDecrease > regressionThreshold) {
            details.push(`Throughput regression: ${(throughputDecrease * 100).toFixed(1)}% decrease`);
        }
        // Memory regression
        const memoryIncrease = (current.memory.heapUsed - baseline.memory.heapUsed) / baseline.memory.heapUsed;
        if (memoryIncrease > regressionThreshold) {
            details.push(`Memory usage regression: ${(memoryIncrease * 100).toFixed(1)}% increase`);
        }
        // Error rate regression
        const errorRateIncrease = current.errors.errorRate - baseline.errors.errorRate;
        if (errorRateIncrease > 5) { // 5% absolute increase
            details.push(`Error rate regression: ${errorRateIncrease.toFixed(1)}% increase`);
        }
        return {
            detected: details.length > 0,
            details
        };
    }
    /**
     * Load performance baseline
     */
    async loadBaseline(scenarioName, environment) {
        const baselineFile = path.join(this.baselineDir, `${scenarioName}-${environment}.json`);
        if (!fs.existsSync(baselineFile)) {
            return null;
        }
        try {
            const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
            return baseline;
        }
        catch (error) {
            console.warn(`Failed to load baseline for ${scenarioName}:`, error);
            return null;
        }
    }
    /**
     * Save performance baseline
     */
    async saveBaseline(scenarioName, metrics, environment, version) {
        const baseline = {
            scenario: scenarioName,
            timestamp: new Date(),
            metrics,
            environment,
            version
        };
        const baselineFile = path.join(this.baselineDir, `${scenarioName}-${environment}.json`);
        try {
            fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
            console.log(`📊 Saved performance baseline: ${baselineFile}`);
        }
        catch (error) {
            console.warn(`Failed to save baseline for ${scenarioName}:`, error);
        }
    }
    /**
     * Generate comprehensive performance report
     */
    async generatePerformanceReport(results) {
        const reportDir = path.join(this.artifactDir, 'reports');
        this.ensureDirectoryExists(reportDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(reportDir, `performance-report-${timestamp}.html`);
        const htmlReport = this.generateHtmlReport(results);
        fs.writeFileSync(reportFile, htmlReport);
        const jsonReport = path.join(reportDir, `performance-report-${timestamp}.json`);
        fs.writeFileSync(jsonReport, JSON.stringify(results, null, 2));
        console.log(`📊 Performance report generated: ${reportFile}`);
        console.log(`📊 Performance data saved: ${jsonReport}`);
    }
    /**
     * Generate HTML performance report
     */
    generateHtmlReport(results) {
        const totalScenarios = results.length;
        const passedScenarios = results.filter(r => r.thresholdsPassed).length;
        const failedScenarios = totalScenarios - passedScenarios;
        const regressionCount = results.filter(r => r.regression?.detected).length;
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .passed { border-left: 4px solid #4CAF50; }
        .failed { border-left: 4px solid #f44336; }
        .warning { border-left: 4px solid #ff9800; }
        .scenario { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }
        .metric-item { background: #f9f9f9; padding: 10px; border-radius: 3px; }
        .threshold-failures { background: #ffebee; padding: 10px; border-radius: 3px; margin: 10px 0; }
        .regression { background: #fff3e0; padding: 10px; border-radius: 3px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Test Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="metric passed">
            <h3>Passed Scenarios</h3>
            <div style="font-size: 2em; font-weight: bold;">${passedScenarios}</div>
        </div>
        <div class="metric failed">
            <h3>Failed Scenarios</h3>
            <div style="font-size: 2em; font-weight: bold;">${failedScenarios}</div>
        </div>
        <div class="metric warning">
            <h3>Regressions Detected</h3>
            <div style="font-size: 2em; font-weight: bold;">${regressionCount}</div>
        </div>
        <div class="metric">
            <h3>Total Duration</h3>
            <div style="font-size: 2em; font-weight: bold;">${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / 1000)}s</div>
        </div>
    </div>
    
    ${results.map(result => `
        <div class="scenario ${result.thresholdsPassed ? 'passed' : 'failed'}">
            <h2>${result.scenario}</h2>
            <p><strong>Duration:</strong> ${Math.round(result.duration / 1000)}s</p>
            <p><strong>Status:</strong> ${result.thresholdsPassed ? '✅ Passed' : '❌ Failed'}</p>
            
            <div class="metrics-grid">
                <div class="metric-item">
                    <strong>Avg Response Time</strong><br>
                    ${result.metrics.responseTime.avg.toFixed(2)}ms
                </div>
                <div class="metric-item">
                    <strong>95th Percentile</strong><br>
                    ${result.metrics.responseTime.p95.toFixed(2)}ms
                </div>
                <div class="metric-item">
                    <strong>99th Percentile</strong><br>
                    ${result.metrics.responseTime.p99.toFixed(2)}ms
                </div>
                <div class="metric-item">
                    <strong>Requests/sec</strong><br>
                    ${result.metrics.throughput.requestsPerSecond.toFixed(2)}
                </div>
                <div class="metric-item">
                    <strong>Total Requests</strong><br>
                    ${result.metrics.throughput.totalRequests}
                </div>
                <div class="metric-item">
                    <strong>Error Rate</strong><br>
                    ${result.metrics.errors.errorRate.toFixed(2)}%
                </div>
                <div class="metric-item">
                    <strong>Memory Usage</strong><br>
                    ${result.metrics.memory.heapUsed.toFixed(2)}MB
                </div>
                <div class="metric-item">
                    <strong>CPU Usage</strong><br>
                    ${result.metrics.cpu.usage.toFixed(2)}%
                </div>
            </div>
            
            ${result.thresholdFailures.length > 0 ? `
                <div class="threshold-failures">
                    <h4>Threshold Failures:</h4>
                    <ul>
                        ${result.thresholdFailures.map(failure => `<li>${failure}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${result.regression?.detected ? `
                <div class="regression">
                    <h4>Performance Regression Detected:</h4>
                    <ul>
                        ${result.regression.details.map(detail => `<li>${detail}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `).join('')}
</body>
</html>
    `;
    }
    // Helper methods
    getLoadTestScenarios() {
        return [
            {
                name: 'api-baseline',
                description: 'Baseline API performance test',
                duration: 60,
                virtualUsers: 10,
                rampUpTime: 10,
                endpoints: [
                    {
                        name: 'health-check',
                        method: 'GET',
                        url: '/api/health',
                        weight: 20,
                        expectedStatusCode: 200
                    },
                    {
                        name: 'user-profile',
                        method: 'GET',
                        url: '/api/users/profile',
                        weight: 30,
                        headers: { 'Authorization': 'Bearer test-token' },
                        expectedStatusCode: 200
                    },
                    {
                        name: 'game-sessions',
                        method: 'GET',
                        url: '/api/games/sessions',
                        weight: 25,
                        headers: { 'Authorization': 'Bearer test-token' },
                        expectedStatusCode: 200
                    },
                    {
                        name: 'create-lobby',
                        method: 'POST',
                        url: '/api/lobbies',
                        weight: 15,
                        headers: { 'Authorization': 'Bearer test-token' },
                        body: { name: 'Test Lobby', maxPlayers: 4 },
                        expectedStatusCode: 201
                    },
                    {
                        name: 'questions',
                        method: 'GET',
                        url: '/api/questions',
                        weight: 10,
                        headers: { 'Authorization': 'Bearer test-token' },
                        expectedStatusCode: 200
                    }
                ],
                thresholds: {
                    responseTime: { avg: 500, p95: 1000, p99: 2000 },
                    throughput: { minRequestsPerSecond: 50 },
                    memory: { maxHeapUsed: 200, maxRss: 300 },
                    cpu: { maxUsage: 80 },
                    errorRate: { maxPercentage: 1 }
                }
            },
            {
                name: 'high-load',
                description: 'High load stress test',
                duration: 120,
                virtualUsers: 50,
                rampUpTime: 30,
                endpoints: [
                    {
                        name: 'concurrent-games',
                        method: 'GET',
                        url: '/api/games/active',
                        weight: 40,
                        headers: { 'Authorization': 'Bearer test-token' },
                        expectedStatusCode: 200
                    },
                    {
                        name: 'websocket-connections',
                        method: 'GET',
                        url: '/api/lobbies/active',
                        weight: 30,
                        headers: { 'Authorization': 'Bearer test-token' },
                        expectedStatusCode: 200
                    },
                    {
                        name: 'question-generation',
                        method: 'POST',
                        url: '/api/questions/generate',
                        weight: 20,
                        headers: { 'Authorization': 'Bearer test-token' },
                        body: { topic: 'general', difficulty: 'medium', count: 5 },
                        expectedStatusCode: 200
                    },
                    {
                        name: 'file-upload',
                        method: 'POST',
                        url: '/api/files/upload',
                        weight: 10,
                        headers: { 'Authorization': 'Bearer test-token' },
                        body: { file: 'test-data' },
                        expectedStatusCode: 200
                    }
                ],
                thresholds: {
                    responseTime: { avg: 1000, p95: 2000, p99: 5000 },
                    throughput: { minRequestsPerSecond: 100 },
                    memory: { maxHeapUsed: 500, maxRss: 800 },
                    cpu: { maxUsage: 90 },
                    errorRate: { maxPercentage: 5 }
                }
            }
        ];
    }
    async ensureServicesReady(context) {
        console.log('🔍 Ensuring services are ready for performance testing...');
        const status = await this.configManager.performHealthCheck(context.environment);
        if (status.status !== 'ready') {
            throw new Error(`Services not ready for performance testing: ${status.error}`);
        }
        console.log('✅ All services are ready');
    }
    async warmUpServices(context) {
        console.log('🔥 Warming up services...');
        const baseUrl = `http://localhost:${context.environment_config.services.backend.port}`;
        // Make a few warm-up requests
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(`${baseUrl}/api/health`);
                await response.text();
            }
            catch (error) {
                console.warn('Warm-up request failed:', error);
            }
        }
        // Brief pause to let services stabilize
        await this.sleep(2000);
        console.log('✅ Services warmed up');
    }
    getEmptyMetrics() {
        return {
            responseTime: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
            throughput: { requestsPerSecond: 0, totalRequests: 0, successfulRequests: 0, failedRequests: 0 },
            memory: this.getEmptyMemoryMetrics(),
            cpu: { usage: 0, loadAverage: [0, 0, 0] },
            network: { bytesReceived: 0, bytesSent: 0, connections: 0 },
            errors: { total: 0, byType: new Map(), errorRate: 0 }
        };
    }
    getEmptyMemoryMetrics() {
        return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, peak: 0 };
    }
    calculateAverage(values) {
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }
    calculateCpuUsage(cpuMetrics) {
        if (cpuMetrics.length < 2)
            return 0;
        const first = cpuMetrics[0];
        const last = cpuMetrics[cpuMetrics.length - 1];
        const userDiff = last.user - first.user;
        const systemDiff = last.system - first.system;
        const totalDiff = userDiff + systemDiff;
        // Convert microseconds to percentage (rough approximation)
        return Math.min(100, (totalDiff / 1000000) * 100);
    }
    logScenarioResult(result) {
        console.log(`\n📊 Scenario Results: ${result.scenario}`);
        console.log(`⏱️  Duration: ${Math.round(result.duration / 1000)}s`);
        console.log(`📈 Avg Response Time: ${result.metrics.responseTime.avg.toFixed(2)}ms`);
        console.log(`🚀 Requests/sec: ${result.metrics.throughput.requestsPerSecond.toFixed(2)}`);
        console.log(`💾 Memory Usage: ${result.metrics.memory.heapUsed.toFixed(2)}MB`);
        console.log(`⚡ CPU Usage: ${result.metrics.cpu.usage.toFixed(2)}%`);
        console.log(`❌ Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`);
        console.log(`✅ Thresholds: ${result.thresholdsPassed ? 'PASSED' : 'FAILED'}`);
        if (result.regression?.detected) {
            console.log(`⚠️  Regression: DETECTED`);
        }
        console.log('');
    }
    async collectArtifacts(artifactDir) {
        const artifacts = [];
        try {
            if (fs.existsSync(artifactDir)) {
                const files = fs.readdirSync(artifactDir, { recursive: true });
                for (const file of files) {
                    if (typeof file === 'string') {
                        const fullPath = path.join(artifactDir, file);
                        if (fs.statSync(fullPath).isFile()) {
                            artifacts.push(fullPath);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.warn('Failed to collect performance artifacts:', error);
        }
        return artifacts;
    }
    stopProcess(process) {
        try {
            process.kill('SIGTERM');
        }
        catch (error) {
            console.warn('Failed to stop process:', error);
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    findProjectRoot() {
        let currentDir = process.cwd();
        while (currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, 'package.json'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return process.cwd();
    }
    /**
     * Clean up running processes
     */
    cleanup() {
        console.log('🧹 Cleaning up performance test processes...');
        for (const [processId, process] of this.runningProcesses) {
            try {
                process.kill('SIGTERM');
                console.log(`Terminated process: ${processId}`);
            }
            catch (error) {
                console.warn(`Failed to terminate process ${processId}:`, error);
            }
        }
        this.runningProcesses.clear();
    }
}
export default PerformanceTestFramework;
