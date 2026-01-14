/**
 * BlueGreenDeployment Tests
 * Tests for blue-green deployment functionality
 */

import { BlueGreenDeployment } from '../BlueGreenDeployment';
import { DEFAULT_BLUE_GREEN_CONFIG, STAGING_BLUE_GREEN_CONFIG } from '../blue-green-config';
import { STAGING_TARGET } from '../deployment-targets';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  symlinkSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock all console methods to prevent test pollution and catch unexpected logs
let consoleSpies: Record<string, jest.SpyInstance> = {};

beforeAll(() => {
  // Mock all console methods
  ['log', 'warn', 'error', 'debug', 'info'].forEach((method) => {
    consoleSpies[method] = jest.spyOn(console, method as any).mockImplementation(() => {});
  });
});

afterAll(() => {
  // Restore all console mocks
  Object.values(consoleSpies).forEach(spy => spy.mockRestore());
});

// Helper to wait for all pending promises to resolve
const flushPromises = () => new Promise(setImmediate);

describe('BlueGreenDeployment', () => {
  let blueGreenDeployment: BlueGreenDeployment;
  let sleepSpy: jest.SpyInstance;
  let monitoringSpy: jest.SpyInstance;
  let verifySwitchSpy: jest.SpyInstance;
  let sendAlertSpy: jest.SpyInstance;

  beforeEach(() => {
    // Use a fast configuration to avoid long timers in tests
    const FAST_STAGING = {
      ...STAGING_BLUE_GREEN_CONFIG,
      monitoring: {
        ...STAGING_BLUE_GREEN_CONFIG.monitoring,
        monitoringDuration: 1, // 1s
        checkInterval: 0.05 // 50ms
      },
      trafficSwitching: {
        ...STAGING_BLUE_GREEN_CONFIG.trafficSwitching,
        switchTimeout: 1000
      },
      smokeTests: {
        ...STAGING_BLUE_GREEN_CONFIG.smokeTests,
        timeout: 1000,
        retries: 0
      }
    } as typeof STAGING_BLUE_GREEN_CONFIG;

    blueGreenDeployment = new BlueGreenDeployment(FAST_STAGING);
    jest.clearAllMocks();

    // Stub internal async helpers that schedule timers or heavy IO
    sleepSpy = jest
      .spyOn(BlueGreenDeployment.prototype as any, 'sleep')
      .mockResolvedValue(undefined);

    monitoringSpy = jest
      .spyOn(blueGreenDeployment as any, 'startPostDeploymentMonitoring')
      .mockResolvedValue([
        {
          timestamp: new Date(),
          errorRate: 0,
          averageResponseTime: 10,
          healthyServices: 2,
          totalServices: 2,
          alerts: []
        }
      ]);

    verifySwitchSpy = jest
      .spyOn(blueGreenDeployment as any, 'verifyTrafficSwitch')
      .mockResolvedValue(undefined);

    sendAlertSpy = jest
      .spyOn(blueGreenDeployment as any, 'sendAlert')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    blueGreenDeployment.cleanup();
    sleepSpy.mockRestore();
    monitoringSpy.mockRestore();
    verifySwitchSpy.mockRestore();
    sendAlertSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with blue-green configuration', () => {
      expect(blueGreenDeployment).toBeDefined();
    });

    it('should create environments with default status', () => {
      const status = blueGreenDeployment.getEnvironmentStatus();
      
      expect(status.blue).toBeDefined();
      expect(status.green).toBeDefined();
      expect(status.blue.status).toBe('inactive');
      expect(status.green.status).toBe('inactive');
      expect(status.blue.name).toBe('blue');
      expect(status.green.name).toBe('green');
    });
  });

  describe('getActiveEnvironment', () => {
    it('should determine active environment from load balancer config', async () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
      
      const activeEnv = await blueGreenDeployment.getActiveEnvironment();
      
      expect(activeEnv).toBe('blue');
      
      // Ensure all promises are resolved
      await flushPromises();
    });

    it('should default to blue if config is unclear', async () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue('upstream backend { server localhost:3001; }');
      
      const activeEnv = await blueGreenDeployment.getActiveEnvironment();
      
      expect(activeEnv).toBe('blue');
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        'Unable to determine active environment from load balancer config, defaulting to blue'
      );
      
      // Ensure all promises are resolved
      await flushPromises();
    });

    it('should handle file read errors gracefully', async () => {
      const fs = require('fs');
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const activeEnv = await blueGreenDeployment.getActiveEnvironment();
      
      expect(activeEnv).toBe('blue');
      // Verify warning was logged
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to read load balancer config, defaulting to blue:',
        expect.any(Error)
      );
      
      // Ensure all promises are resolved
      await flushPromises();
    });
  });

  describe('deploy', () => {
    it('should perform blue-green deployment successfully', async () => {
      // Increase timeout for this test
      jest.setTimeout(15000);
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      // Mock file operations
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
      
      // Mock successful command execution
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success exit code
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      // Mock successful health checks and smoke tests
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('healthy');
        }
      });
      
      const result = await blueGreenDeployment.deploy(
        STAGING_TARGET,
        'v1.2.3',
        ['dist/app.js', 'dist/styles.css']
      );
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deploymentId).toMatch(/^bg-deploy-\d+$/);
      expect(result.blueEnvironment).toBeDefined();
      expect(result.greenEnvironment).toBeDefined();
      expect(result.trafficSwitched).toBe(true);
    });

    it('should handle deployment failures gracefully', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
      
      // Mock failed command execution
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Failure exit code
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('Deployment failed');
        }
      });
      
      // Override monitoring to exceed thresholds so rollback is triggered
      (monitoringSpy as jest.SpyInstance).mockResolvedValue([
        {
          timestamp: new Date(),
          errorRate: STAGING_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold + 50,
          averageResponseTime: STAGING_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold + 1000,
          healthyServices: 0,
          totalServices: 2,
          alerts: ['High error rate', 'High response time']
        },
        {
          timestamp: new Date(),
          errorRate: STAGING_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold + 10,
          averageResponseTime: STAGING_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold + 500,
          healthyServices: 1,
          totalServices: 2,
          alerts: ['High error rate']
        }
      ]);

      const result = await blueGreenDeployment.deploy(
        STAGING_TARGET,
        'v1.2.3',
        ['dist/app.js']
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.rollbackTriggered).toBe(false);
    });

    it('should trigger rollback when monitoring thresholds are exceeded', async () => {
      // Increase timeout for this test
      jest.setTimeout(15000);
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
      
      // Mock process that always succeeds for shell commands used by executeCommand
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };
      spawn.mockReturnValue(mockProcess);
      
      // Ensure monitoring results exceed thresholds to trigger rollback
      (monitoringSpy as jest.SpyInstance).mockResolvedValue([
        {
          timestamp: new Date(),
          errorRate: STAGING_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold + 10,
          averageResponseTime: STAGING_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold + 100,
          healthyServices: 0,
          totalServices: 2,
          alerts: ['High error rate', 'High response time']
        },
        {
          timestamp: new Date(),
          errorRate: STAGING_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold + 5,
          averageResponseTime: STAGING_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold + 50,
          healthyServices: 1,
          totalServices: 2,
          alerts: ['High error rate']
        }
      ]);
      
      const result = await blueGreenDeployment.deploy(
        STAGING_TARGET,
        'v1.2.3',
        ['dist/app.js']
      );
      
      expect(result.success).toBe(false);
      expect(result.rollbackTriggered).toBe(true);
      expect(result.trafficSwitched).toBe(true);
      expect(result.error).toBe('Deployment rolled back due to monitoring triggers');
    });

    it('should handle traffic switch failure and report error', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
      
      // Mock process that succeeds for earlier steps
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };
      spawn.mockReturnValue(mockProcess);
      
      // Force switchTraffic to fail by making verifyTrafficSwitch throw via update step
      const updateSpy = jest
        .spyOn(blueGreenDeployment as any, 'updateLoadBalancerConfig')
        .mockRejectedValue(new Error('Failed to update load balancer config: write error'));
      
      const result = await blueGreenDeployment.deploy(
        STAGING_TARGET,
        'v1.2.3',
        ['dist/app.js']
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Traffic switch failed');
      expect(result.rollbackTriggered).toBe(false);
      
      updateSpy.mockRestore();
    });
  });

  describe('rollback', () => {
    it('should perform rollback successfully', async () => {
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_green { server localhost:3101; }');
      
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0);
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('healthy');
        }
      });
      
      await expect(
        blueGreenDeployment.rollback('Test rollback')
      ).resolves.not.toThrow();
    });

    it('should handle rollback when previous environment is unhealthy', async () => {
      // Increase timeout for this test
      jest.setTimeout(15000);
      const fs = require('fs');
      const { spawn } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_green { server localhost:3101; }');
      
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(1); // Health check fails
          }
        })
      };
      
      spawn.mockReturnValue(mockProcess);
      
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback('Service unhealthy');
        }
      });
      
      // Make performEnvironmentHealthChecks return unhealthy before and after restart
      const unhealthyResult = [
        { service: 'backend-green', url: 'http://localhost', status: 'unhealthy', responseTime: 10, timestamp: new Date(), error: 'Service unhealthy' }
      ];
      const healthSpy = jest
        .spyOn(blueGreenDeployment as any, 'performEnvironmentHealthChecks')
        .mockResolvedValueOnce(unhealthyResult as any)
        .mockResolvedValueOnce(unhealthyResult as any);

      // Ensure restartEnvironment succeeds so code path throws the specific rollback error
      const restartSpy = jest
        .spyOn(blueGreenDeployment as any, 'restartEnvironment')
        .mockResolvedValue(undefined);

      await expect(
        blueGreenDeployment.rollback('Test rollback')
      ).rejects.toThrow('Cannot rollback: previous environment');

      healthSpy.mockRestore();
      restartSpy.mockRestore();
    });

    it('should prevent concurrent rollbacks', async () => {
      // Increase timeout for this test
      jest.setTimeout(15000);
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('upstream backend_green { server localhost:3101; }');
      
      // Start first rollback (will be slow)
      const rollback1 = blueGreenDeployment.rollback('First rollback');
      
      // Try to start second rollback immediately
      await expect(
        blueGreenDeployment.rollback('Second rollback')
      ).rejects.toThrow('Rollback already in progress');
      
      // Wait for first rollback to complete (it will fail due to mocked conditions)
      await expect(rollback1).rejects.toThrow();
    });
  });

  describe('getEnvironmentStatus', () => {
    it('should return current environment status', () => {
      const status = blueGreenDeployment.getEnvironmentStatus();
      
      expect(status).toHaveProperty('blue');
      expect(status).toHaveProperty('green');
      expect(status.blue.name).toBe('blue');
      expect(status.green.name).toBe('green');
      expect(status.blue.status).toBe('inactive');
      expect(status.green.status).toBe('inactive');
    });

    it('should return deep copies of environment objects', () => {
      const status1 = blueGreenDeployment.getEnvironmentStatus();
      const status2 = blueGreenDeployment.getEnvironmentStatus();
      
      expect(status1.blue).not.toBe(status2.blue);
      expect(status1.green).not.toBe(status2.green);
      expect(status1.blue).toEqual(status2.blue);
      expect(status1.green).toEqual(status2.green);
    });
  });

  describe('cleanup', () => {
    it('should cleanup without errors', () => {
      expect(() => blueGreenDeployment.cleanup()).not.toThrow();
    });

    it('should handle cleanup when monitoring process exists', () => {
      // Simulate monitoring process
      const mockProcess = {
        kill: jest.fn()
      };
      
      // Access private property for testing
      (blueGreenDeployment as any).monitoringProcess = mockProcess;
      
      expect(() => blueGreenDeployment.cleanup()).not.toThrow();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle cleanup errors gracefully', () => {
      const mockProcess = {
        kill: jest.fn(() => {
          throw new Error('Kill failed');
        })
      };
      
      (blueGreenDeployment as any).monitoringProcess = mockProcess;
      
      expect(() => blueGreenDeployment.cleanup()).not.toThrow();
    });
  });
});

describe('Blue-Green Configuration', () => {
  describe('DEFAULT_BLUE_GREEN_CONFIG', () => {
    it('should have valid configuration structure', () => {
      expect(DEFAULT_BLUE_GREEN_CONFIG).toBeDefined();
      expect(DEFAULT_BLUE_GREEN_CONFIG.loadBalancer).toBeDefined();
      expect(DEFAULT_BLUE_GREEN_CONFIG.monitoring).toBeDefined();
      expect(DEFAULT_BLUE_GREEN_CONFIG.rollbackTriggers).toBeDefined();
      expect(DEFAULT_BLUE_GREEN_CONFIG.smokeTests).toBeDefined();
      expect(DEFAULT_BLUE_GREEN_CONFIG.trafficSwitching).toBeDefined();
    });

    it('should have reasonable monitoring thresholds', () => {
      const monitoring = DEFAULT_BLUE_GREEN_CONFIG.monitoring;
      
      expect(monitoring.errorRateThreshold).toBeGreaterThan(0);
      expect(monitoring.errorRateThreshold).toBeLessThan(100);
      expect(monitoring.responseTimeThreshold).toBeGreaterThan(0);
      expect(monitoring.monitoringDuration).toBeGreaterThan(0);
      expect(monitoring.checkInterval).toBeGreaterThan(0);
    });

    it('should have enabled rollback triggers', () => {
      const triggers = DEFAULT_BLUE_GREEN_CONFIG.rollbackTriggers;
      
      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.some(t => t.enabled)).toBe(true);
      
      triggers.forEach(trigger => {
        expect(trigger.type).toBeDefined();
        expect(trigger.threshold).toBeGreaterThan(0);
        expect(trigger.duration).toBeGreaterThan(0);
        expect(typeof trigger.enabled).toBe('boolean');
      });
    });

    it('should have valid smoke test configuration', () => {
      const smokeTests = DEFAULT_BLUE_GREEN_CONFIG.smokeTests;
      
      expect(smokeTests.command).toBeDefined();
      expect(smokeTests.timeout).toBeGreaterThan(0);
      expect(smokeTests.retries).toBeGreaterThan(0);
      expect(Array.isArray(smokeTests.criticalEndpoints)).toBe(true);
      expect(smokeTests.criticalEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('STAGING_BLUE_GREEN_CONFIG', () => {
    it('should have more lenient thresholds than default', () => {
      expect(STAGING_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold)
        .toBeGreaterThanOrEqual(DEFAULT_BLUE_GREEN_CONFIG.monitoring.errorRateThreshold);
      
      expect(STAGING_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold)
        .toBeGreaterThanOrEqual(DEFAULT_BLUE_GREEN_CONFIG.monitoring.responseTimeThreshold);
    });

    it('should have staging-specific load balancer configuration', () => {
      const loadBalancer = STAGING_BLUE_GREEN_CONFIG.loadBalancer;
      
      expect(loadBalancer.configPath).toContain('staging');
      expect(loadBalancer.reloadCommand).toContain('docker-compose');
    });
  });
});