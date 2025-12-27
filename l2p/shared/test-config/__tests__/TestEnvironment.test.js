/**
 * Test Environment Orchestrator Tests
 */
import { TestEnvironment } from '../TestEnvironment';
import { ServiceDiscovery } from '../ServiceDiscovery';
import { ResourceCleanup } from '../ResourceCleanup';
// Mock external dependencies
jest.mock('child_process');
jest.mock('node-fetch');
jest.mock('fs', () => ({
    promises: {
        readFileSync: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));
describe('TestEnvironment', () => {
    let testEnv;
    beforeEach(() => {
        testEnv = new TestEnvironment();
        jest.clearAllMocks();
    });
    afterEach(async () => {
        if (testEnv.isRunning()) {
            await testEnv.stop();
        }
    });
    describe('Configuration Loading', () => {
        it('should load default configuration when no config file is provided', () => {
            const env = new TestEnvironment();
            expect(env).toBeDefined();
        });
        it('should load configuration from YAML file when provided', () => {
            const configPath = 'test-config.yml';
            const env = new TestEnvironment(configPath);
            expect(env).toBeDefined();
        });
    });
    describe('Environment Lifecycle', () => {
        it('should start the test environment successfully', async () => {
            // Mock successful Docker operations
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0); // Success
                    }
                })
            }));
            // Mock port availability
            jest.spyOn(ServiceDiscovery, 'isPortAvailable').mockResolvedValue(true);
            // Mock health checks
            const mockFetch = require('node-fetch').default;
            mockFetch.mockResolvedValue({ ok: true, status: 200 });
            await expect(testEnv.start()).resolves.not.toThrow();
            expect(testEnv.isRunning()).toBe(true);
        });
        it('should stop the test environment successfully', async () => {
            // Start first
            await testEnv.start();
            // Mock successful stop
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0); // Success
                    }
                })
            }));
            await expect(testEnv.stop()).resolves.not.toThrow();
            expect(testEnv.isRunning()).toBe(false);
        });
        it('should reset the test environment successfully', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0); // Success
                    }
                })
            }));
            jest.spyOn(ServiceDiscovery, 'isPortAvailable').mockResolvedValue(true);
            const mockFetch = require('node-fetch').default;
            mockFetch.mockResolvedValue({ ok: true, status: 200 });
            await expect(testEnv.reset()).resolves.not.toThrow();
            expect(testEnv.isRunning()).toBe(true);
        });
        it('should cleanup resources successfully', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0); // Success
                    }
                })
            }));
            await expect(testEnv.cleanup()).resolves.not.toThrow();
        });
    });
    describe('Health Checking', () => {
        it('should perform health checks on all services', async () => {
            const mockFetch = require('node-fetch').default;
            mockFetch.mockResolvedValue({ ok: true, status: 200 });
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: {
                    on: jest.fn((event, callback) => {
                        if (event === 'data') {
                            callback('healthy');
                        }
                    })
                },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const healthStatuses = await testEnv.healthCheck();
            expect(Array.isArray(healthStatuses)).toBe(true);
            expect(healthStatuses.length).toBeGreaterThan(0);
        });
        it('should handle unhealthy services gracefully', async () => {
            const mockFetch = require('node-fetch').default;
            mockFetch.mockRejectedValue(new Error('Connection refused'));
            const healthStatuses = await testEnv.healthCheck();
            expect(Array.isArray(healthStatuses)).toBe(true);
            // Some services should be marked as unhealthy
            const unhealthyServices = healthStatuses.filter(h => h.status === 'unhealthy');
            expect(unhealthyServices.length).toBeGreaterThan(0);
        });
    });
    describe('Port Conflict Resolution', () => {
        it('should resolve port conflicts automatically', async () => {
            // Mock port conflict
            jest.spyOn(ServiceDiscovery, 'isPortAvailable')
                .mockResolvedValueOnce(false) // First port is in use
                .mockResolvedValueOnce(true); // Second port is available
            jest.spyOn(ServiceDiscovery, 'findAvailablePort')
                .mockResolvedValue(4000);
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const mockFetch = require('node-fetch').default;
            mockFetch.mockResolvedValue({ ok: true, status: 200 });
            await expect(testEnv.start()).resolves.not.toThrow();
        });
    });
    describe('Service URLs', () => {
        it('should return correct service URLs', () => {
            const urls = testEnv.getServiceUrls();
            expect(typeof urls).toBe('object');
            expect(Object.keys(urls).length).toBeGreaterThan(0);
            // Check that URLs are properly formatted
            Object.values(urls).forEach(url => {
                expect(url).toMatch(/^http:\/\/localhost:\d+/);
            });
        });
    });
    describe('Logging', () => {
        it('should retrieve logs for all services', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: {
                    on: jest.fn((event, callback) => {
                        if (event === 'data') {
                            callback('Test log line 1\nTest log line 2\n');
                        }
                    })
                },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const logs = await testEnv.getLogs();
            expect(Array.isArray(logs)).toBe(true);
        });
        it('should retrieve logs for specific service', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: {
                    on: jest.fn((event, callback) => {
                        if (event === 'data') {
                            callback('Backend service log\n');
                        }
                    })
                },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const logs = await testEnv.getLogs('backend-test');
            expect(Array.isArray(logs)).toBe(true);
        });
    });
    describe('Error Handling', () => {
        it('should handle Docker command failures gracefully', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: {
                    on: jest.fn((event, callback) => {
                        if (event === 'data') {
                            callback('Docker error message');
                        }
                    })
                },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(1); // Error code
                    }
                })
            }));
            await expect(testEnv.start()).rejects.toThrow();
        });
        it('should prevent starting when already started', async () => {
            // Mock successful start
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            jest.spyOn(ServiceDiscovery, 'isPortAvailable').mockResolvedValue(true);
            const mockFetch = require('node-fetch').default;
            mockFetch.mockResolvedValue({ ok: true, status: 200 });
            await testEnv.start();
            // Try to start again
            await expect(testEnv.start()).rejects.toThrow('already started');
        });
        it('should handle service health check timeouts', async () => {
            const mockFetch = require('node-fetch').default;
            mockFetch.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)));
            const healthStatuses = await testEnv.healthCheck();
            const unhealthyServices = healthStatuses.filter(h => h.status === 'unhealthy');
            expect(unhealthyServices.length).toBeGreaterThan(0);
        });
    });
});
describe('ServiceDiscovery', () => {
    describe('Port Management', () => {
        it('should find available ports', async () => {
            const port = await ServiceDiscovery.findAvailablePort();
            expect(typeof port).toBe('number');
            expect(port).toBeGreaterThan(0);
            expect(port).toBeLessThan(65536);
        });
        it('should resolve port conflicts for multiple services', async () => {
            const services = {
                'service1': { port: 3000 },
                'service2': { port: 3000 }, // Conflict
                'service3': { port: 3001 }
            };
            const resolved = await ServiceDiscovery.resolvePortConflicts(services);
            expect(Object.keys(resolved)).toHaveLength(3);
            expect(resolved.service1).toBeDefined();
            expect(resolved.service2).toBeDefined();
            expect(resolved.service3).toBeDefined();
            // Ports should be unique
            const ports = Object.values(resolved);
            const uniquePorts = [...new Set(ports)];
            expect(uniquePorts).toHaveLength(ports.length);
        });
    });
    describe('Service Endpoints', () => {
        it('should check HTTP endpoints', async () => {
            const endpoints = [
                {
                    name: 'test-service',
                    host: 'localhost',
                    port: 3000,
                    protocol: 'http',
                    healthEndpoint: '/health',
                    isAvailable: false,
                    lastCheck: new Date()
                }
            ];
            const results = await ServiceDiscovery.checkServiceEndpoints(endpoints);
            expect(Array.isArray(results)).toBe(true);
            expect(results).toHaveLength(1);
            expect(results[0].lastCheck).toBeInstanceOf(Date);
        });
    });
});
describe('ResourceCleanup', () => {
    let cleanup;
    beforeEach(() => {
        cleanup = new ResourceCleanup();
    });
    describe('Cleanup Operations', () => {
        it('should perform complete cleanup', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const result = await cleanup.cleanup();
            expect(result).toBeDefined();
            expect(result.removed).toBeDefined();
            expect(result.preserved).toBeDefined();
            expect(result.errors).toBeDefined();
            expect(Array.isArray(result.removed)).toBe(true);
            expect(Array.isArray(result.preserved)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
        });
        it('should perform emergency cleanup', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const result = await cleanup.emergencyCleanup();
            expect(result).toBeDefined();
        });
        it('should perform gentle cleanup', async () => {
            const mockSpawn = require('child_process').spawn;
            mockSpawn.mockImplementation(() => ({
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        callback(0);
                    }
                })
            }));
            const result = await cleanup.gentleCleanup();
            expect(result).toBeDefined();
        });
    });
});
