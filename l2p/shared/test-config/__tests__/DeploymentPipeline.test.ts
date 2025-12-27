/**
 * DeploymentPipeline Tests
 * Tests for deployment pipeline functionality
 */

import { DeploymentPipeline } from '../DeploymentPipeline';
import { STAGING_TARGET, PRODUCTION_TARGET } from '../deployment-targets';

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
  readdirSync: jest.fn(),
  statSync: jest.fn()
}));

describe('DeploymentPipeline', () => {
  let pipeline: DeploymentPipeline;

  beforeEach(() => {
    pipeline = new DeploymentPipeline();
    jest.clearAllMocks();
  });

  afterEach(() => {
    pipeline.cleanup();
  });

  describe('validate', () => {
    it('should validate deployment configuration', async () => {
      // Mock successful validation
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      
      const result = await pipeline.validate();
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should validate with specific target', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      
      const result = await pipeline.validate(STAGING_TARGET);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should return validation errors for missing files', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const result = await pipeline.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('build', () => {
    it('should build application successfully', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);
      
      const result = await pipeline.build({ skipBuild: true });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.buildId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeDefined();
    });

    it('should skip build when skipBuild option is true', async () => {
      const result = await pipeline.build({ skipBuild: true });
      
      expect(result.success).toBe(true);
      expect(result.logs).toContain('Build skipped');
    });

    it('should include build artifacts', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['index.js', 'styles.css']);
      fs.statSync.mockReturnValue({ isFile: () => true });
      
      const result = await pipeline.build({ skipBuild: true });
      
      expect(result.artifacts).toBeDefined();
      expect(Array.isArray(result.artifacts)).toBe(true);
    });
  });

  describe('deploy', () => {
    it('should perform dry run deployment', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      
      const result = await pipeline.deploy(STAGING_TARGET, { 
        dryRun: true,
        skipTests: true,
        skipBuild: true
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deploymentId).toBeDefined();
      expect(result.target).toBe(STAGING_TARGET);
      expect(result.logs).toContain('Dry run completed');
    });

    it('should include deployment metadata', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      
      const result = await pipeline.deploy(STAGING_TARGET, { 
        dryRun: true,
        skipTests: true,
        skipBuild: true
      });
      
      expect(result.deploymentId).toMatch(/^deploy-staging-\d+$/);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.rollbackAvailable).toBeDefined();
    });

    it('should validate target configuration', async () => {
      const invalidTarget = {
        ...STAGING_TARGET,
        config: {
          ...STAGING_TARGET.config,
          dockerCompose: '', // Invalid empty docker compose
          healthCheckUrl: '' // Invalid empty health check URL
        }
      };

      const result = await pipeline.deploy(invalidTarget, { 
        dryRun: true,
        skipTests: true,
        skipBuild: true
      });
      
      // Should fail validation
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('rollback', () => {
    it('should handle rollback when no previous deployment exists', async () => {
      await expect(
        pipeline.rollback(STAGING_TARGET, { reason: 'Test rollback' })
      ).rejects.toThrow('No previous successful deployment found for rollback');
    });

    it('should execute rollback with custom reason', async () => {
      const reason = 'Test rollback reason';
      
      try {
        await pipeline.rollback(STAGING_TARGET, { reason });
      } catch (error) {
        // Expected to fail due to no previous deployment
        expect(error).toBeDefined();
      }
    });
  });

  describe('deployment history', () => {
    it('should return empty history initially', () => {
      const history = pipeline.getDeploymentHistory();
      
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });

    it('should return undefined for non-existent deployment', () => {
      const deployment = pipeline.getDeployment('non-existent-id');
      
      expect(deployment).toBeUndefined();
    });

    it('should store deployment in history after deployment', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      
      const result = await pipeline.deploy(STAGING_TARGET, { 
        dryRun: true,
        skipTests: true,
        skipBuild: true
      });
      
      const history = pipeline.getDeploymentHistory();
      expect(history.length).toBe(1);
      expect(history[0]!.deploymentId).toBe(result.deploymentId);
      
      const deployment = pipeline.getDeployment(result.deploymentId);
      expect(deployment).toBeDefined();
      expect(deployment?.deploymentId).toBe(result.deploymentId);
    });
  });

  describe('cleanup', () => {
    it('should cleanup without errors', () => {
      expect(() => pipeline.cleanup()).not.toThrow();
    });
  });
});

describe('Deployment Targets', () => {
  describe('STAGING_TARGET', () => {
    it('should have valid configuration', () => {
      expect(STAGING_TARGET.name).toBe('staging');
      expect(STAGING_TARGET.environment).toBe('staging');
      expect(STAGING_TARGET.config).toBeDefined();
      expect(STAGING_TARGET.config.dockerCompose).toBeDefined();
      expect(STAGING_TARGET.config.healthCheckUrl).toBeDefined();
      expect(STAGING_TARGET.config.services).toBeDefined();
      expect(Array.isArray(STAGING_TARGET.config.services)).toBe(true);
    });

    it('should have required services', () => {
      const serviceNames = STAGING_TARGET.config.services.map(s => s.name);
      
      expect(serviceNames).toContain('postgres');
      expect(serviceNames).toContain('chromadb');
      expect(serviceNames).toContain('backend');
      expect(serviceNames).toContain('frontend');
    });

    it('should have valid service configurations', () => {
      STAGING_TARGET.config.services.forEach(service => {
        expect(service.name).toBeDefined();
        expect(service.image).toBeDefined();
        expect(service.healthCheck).toBeDefined();
        expect(service.healthCheck.endpoint).toBeDefined();
        expect(service.healthCheck.timeout).toBeGreaterThan(0);
        expect(service.healthCheck.retries).toBeGreaterThan(0);
        expect(service.dependencies).toBeDefined();
        expect(Array.isArray(service.dependencies)).toBe(true);
      });
    });
  });

  describe('PRODUCTION_TARGET', () => {
    it('should have valid configuration', () => {
      expect(PRODUCTION_TARGET.name).toBe('production');
      expect(PRODUCTION_TARGET.environment).toBe('production');
      expect(PRODUCTION_TARGET.config).toBeDefined();
      expect(PRODUCTION_TARGET.config.dockerCompose).toBeDefined();
      expect(PRODUCTION_TARGET.config.healthCheckUrl).toBeDefined();
    });

    it('should have production-specific settings', () => {
      expect(PRODUCTION_TARGET.config.healthCheckTimeout).toBeGreaterThan(STAGING_TARGET.config.healthCheckTimeout);
      expect(PRODUCTION_TARGET.config.healthCheckRetries).toBeGreaterThanOrEqual(STAGING_TARGET.config.healthCheckRetries);
    });

    it('should have secure environment variables', () => {
      const envVars = PRODUCTION_TARGET.config.environmentVariables;
      
      expect(envVars.NODE_ENV).toBe('production');
      expect(envVars.LOG_LEVEL).toBe('warn');
      expect(envVars.ENABLE_CORS).toBe('false');
      
      // Should use environment variable placeholders for secrets
      expect(envVars.DATABASE_URL).toContain('${');
      expect(envVars.JWT_SECRET).toContain('${');
    });
  });
});