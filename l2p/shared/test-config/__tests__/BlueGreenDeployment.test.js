/**
 * BlueGreenDeployment Tests
 * Tests for blue-green deployment functionality
 */
import { BlueGreenDeployment } from '../BlueGreenDeployment';
import { DEFAULT_BLUE_GREEN_CONFIG, STAGING_BLUE_GREEN_CONFIG } from '../blue-green-config';
import { STAGING_TARGET } from '../deployment-targets';

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

// Silence noisy warnings/errors in this suite while allowing assertions
let warnSpy;
let errorSpy;

beforeAll(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});
describe('BlueGreenDeployment', () => {
    let blueGreenDeployment;
    beforeEach(() => {
        blueGreenDeployment = new BlueGreenDeployment(STAGING_BLUE_GREEN_CONFIG);
        jest.clearAllMocks();
    });
    afterEach(() => {
        blueGreenDeployment.cleanup();
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
        });

        it('should default to blue if config is unclear', async () => {
            const fs = require('fs');
            fs.readFileSync.mockReturnValue('upstream backend { server localhost:3001; }');
            const activeEnv = await blueGreenDeployment.getActiveEnvironment();
            expect(activeEnv).toBe('blue');
            expect(console.warn).toHaveBeenCalled();
        });

        it('should handle file read errors gracefully', async () => {
            const fs = require('fs');
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File not found');
            });
            const activeEnv = await blueGreenDeployment.getActiveEnvironment();
            expect(activeEnv).toBe('blue');
            expect(console.warn).toHaveBeenCalled();
        });
    });
    describe('deploy', () => {
        it('should perform blue-green deployment successfully', async () => {
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
            const result = await blueGreenDeployment.deploy(STAGING_TARGET, 'v1.2.3', ['dist/app.js', 'dist/styles.css']);
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
            const result = await blueGreenDeployment.deploy(STAGING_TARGET, 'v1.2.3', ['dist/app.js']);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.rollbackTriggered).toBe(false);
        });
        it('should trigger rollback when monitoring thresholds are exceeded', async () => {
            const fs = require('fs');
            const { spawn } = require('child_process');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('upstream backend_blue { server localhost:3001; }');
            // Mock process that succeeds initially but fails health checks
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        // First few calls succeed (deployment), later calls fail (health checks)
                        const callCount = mockProcess.on.mock.calls.filter(call => call[0] === 'close').length;
                        callback(callCount <= 3 ? 0 : 1);
                    }
                })
            };
            spawn.mockReturnValue(mockProcess);
            // Mock health check failures
            mockProcess.stdout.on.mockImplementation((event, callback) => {
                if (event === 'data') {
                    callback('unhealthy');
                }
            });
            const result = await blueGreenDeployment.deploy(STAGING_TARGET, 'v1.2.3', ['dist/app.js']);
            expect(result.success).toBe(false);
            expect(result.rollbackTriggered).toBe(true);
            expect(result.error).toContain('rolled back');
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
            await expect(blueGreenDeployment.rollback('Test rollback')).resolves.not.toThrow();
        });
        it('should handle rollback when previous environment is unhealthy', async () => {
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
            await expect(blueGreenDeployment.rollback('Test rollback')).rejects.toThrow('Cannot rollback: previous environment');
        });
        it('should prevent concurrent rollbacks', async () => {
            const fs = require('fs');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('upstream backend_green { server localhost:3101; }');
            // Start first rollback (will be slow)
            const rollback1 = blueGreenDeployment.rollback('First rollback');
            // Try to start second rollback immediately
            await expect(blueGreenDeployment.rollback('Second rollback')).rejects.toThrow('Rollback already in progress');
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
            blueGreenDeployment.monitoringProcess = mockProcess;
            expect(() => blueGreenDeployment.cleanup()).not.toThrow();
            expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
        });
        it('should handle cleanup errors gracefully', () => {
            const mockProcess = {
                kill: jest.fn(() => {
                    throw new Error('Kill failed');
                })
            };
            blueGreenDeployment.monitoringProcess = mockProcess;
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
