
const fs = require('fs');
const path = require('path');
const os = require('os');

const metricsFile = path.join('/home/patrick/projects/l2p/test-artifacts/performance/api-baseline', 'system-metrics.json');
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
