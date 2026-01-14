#!/usr/bin/env node

/**
 * Deployment Pipeline CLI
 * Command-line interface for deployment pipeline operations
 */

import { Command } from 'commander';
import { DeploymentPipeline, DeploymentPipelineOptions } from './DeploymentPipeline';
import { DEPLOYMENT_TARGETS } from './deployment-targets';

const program = new Command();

program
  .name('deployment-pipeline')
  .description('Learn2Play Deployment Pipeline CLI')
  .version('1.0.0');

// Validate command
program
  .command('validate')
  .description('Run pre-deployment validation')
  .option('-t, --target <target>', 'deployment target (staging|production)')
  .option('-v, --verbose', 'verbose output')
  .action(async (options) => {
    try {
      console.log('🔍 Starting deployment validation...\n');
      
      const pipeline = new DeploymentPipeline();
      const target = options.target ? DEPLOYMENT_TARGETS[options.target as keyof typeof DEPLOYMENT_TARGETS] : undefined;
      
      if (options.target && !target) {
        console.error(`❌ Invalid target: ${options.target}. Available targets: staging, production`);
        process.exit(1);
      }
      
      const result = await pipeline.validate(target);
      
      if (result.isValid) {
        console.log('✅ Validation passed successfully');
        process.exit(0);
      } else {
        console.log(`❌ Validation failed with ${result.errors.length} errors:`);
        result.errors.forEach(error => {
          console.log(`   - [${error.type}] ${error.message}`);
          if (options.verbose && error.details) {
            console.log(`     Details: ${JSON.stringify(error.details, null, 2)}`);
          }
        });
        
        if (result.warnings.length > 0) {
          console.log(`⚠️  ${result.warnings.length} warnings:`);
          result.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

// Build command
program
  .command('build')
  .description('Build application for deployment')
  .option('--skip-tests', 'skip test execution')
  .option('--skip-build', 'skip build process')
  .option('-v, --verbose', 'verbose output')
  .option('--timeout <timeout>', 'build timeout in milliseconds', '300000')
  .action(async (options) => {
    try {
      console.log('🔨 Starting build process...\n');
      
      const pipeline = new DeploymentPipeline();
      const pipelineOptions: DeploymentPipelineOptions = {
        skipTests: options.skipTests,
        skipBuild: options.skipBuild,
        verbose: options.verbose,
        timeout: parseInt(options.timeout, 10)
      };
      
      const result = await pipeline.build(pipelineOptions);
      
      if (result.success) {
        console.log(`✅ Build completed successfully in ${result.duration}ms`);
        console.log(`📦 Generated ${result.artifacts.length} artifacts`);
        
        if (options.verbose) {
          console.log('\n📋 Build logs:');
          result.logs.forEach(log => console.log(`   ${log}`));
          
          console.log('\n📦 Artifacts:');
          result.artifacts.forEach(artifact => console.log(`   ${artifact}`));
        }
        
        process.exit(0);
      } else {
        console.log(`❌ Build failed after ${result.duration}ms: ${result.error}`);
        
        if (options.verbose) {
          console.log('\n📋 Build logs:');
          result.logs.forEach(log => console.log(`   ${log}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  });

// Deploy command
program
  .command('deploy <target>')
  .description('Deploy to specified target (staging|production)')
  .option('--skip-tests', 'skip test execution')
  .option('--skip-build', 'skip build process')
  .option('--dry-run', 'perform dry run without actual deployment')
  .option('--force-rollback', 'force rollback if deployment fails')
  .option('-v, --verbose', 'verbose output')
  .option('--timeout <timeout>', 'deployment timeout in milliseconds', '600000')
  .action(async (targetName, options) => {
    try {
      const target = DEPLOYMENT_TARGETS[targetName as keyof typeof DEPLOYMENT_TARGETS];
      
      if (!target) {
        console.error(`❌ Invalid target: ${targetName}. Available targets: staging, production`);
        process.exit(1);
      }
      
      console.log(`🚀 Starting deployment to ${targetName}...\n`);
      
      const pipeline = new DeploymentPipeline();
      const pipelineOptions: DeploymentPipelineOptions = {
        skipTests: options.skipTests,
        skipBuild: options.skipBuild,
        dryRun: options.dryRun,
        forceRollback: options.forceRollback,
        verbose: options.verbose,
        timeout: parseInt(options.timeout, 10)
      };
      
      const result = await pipeline.deploy(target, pipelineOptions);
      
      if (result.success) {
        console.log(`✅ Deployment to ${targetName} completed successfully in ${result.duration}ms`);
        console.log(`🆔 Deployment ID: ${result.deploymentId}`);
        
        if (options.verbose) {
          console.log('\n📋 Deployment logs:');
          result.logs.forEach(log => console.log(`   ${log}`));
          
          console.log('\n🏥 Health check results:');
          result.healthChecks.forEach(hc => {
            const status = hc.status === 'healthy' ? '✅' : '❌';
            console.log(`   ${status} ${hc.service}: ${hc.status} (${hc.responseTime}ms)`);
          });
          
          console.log('\n🚀 Service deployment results:');
          result.services.forEach(service => {
            const status = service.status === 'deployed' ? '✅' : '❌';
            console.log(`   ${status} ${service.serviceName}: ${service.status}`);
          });
        }
        
        process.exit(0);
      } else {
        console.log(`❌ Deployment to ${targetName} failed after ${result.duration}ms: ${result.error}`);
        
        if (result.rollbackAvailable) {
          console.log('🔄 Rollback is available');
        }
        
        if (options.verbose) {
          console.log('\n📋 Deployment logs:');
          result.logs.forEach(log => console.log(`   ${log}`));
        }
        
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback <target>')
  .description('Rollback deployment for specified target')
  .option('-r, --reason <reason>', 'rollback reason', 'Manual rollback requested')
  .option('-d, --deployment-id <id>', 'specific deployment ID to rollback')
  .option('-v, --verbose', 'verbose output')
  .action(async (targetName, options) => {
    try {
      const target = DEPLOYMENT_TARGETS[targetName as keyof typeof DEPLOYMENT_TARGETS];
      
      if (!target) {
        console.error(`❌ Invalid target: ${targetName}. Available targets: staging, production`);
        process.exit(1);
      }
      
      console.log(`🔄 Starting rollback for ${targetName}...\n`);
      
      const pipeline = new DeploymentPipeline();
      
      await pipeline.rollback(target, {
        reason: options.reason,
        deploymentId: options.deploymentId
      });
      
      console.log(`✅ Rollback for ${targetName} completed successfully`);
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('Show deployment history')
  .option('-l, --limit <limit>', 'limit number of results', '10')
  .option('-t, --target <target>', 'filter by target')
  .option('--json', 'output as JSON')
  .action(async (options) => {
    try {
      const pipeline = new DeploymentPipeline();
      let history = pipeline.getDeploymentHistory();
      
      if (options.target) {
        history = history.filter(deployment => deployment.target.name === options.target);
      }
      
      const limit = parseInt(options.limit, 10);
      history = history.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
      } else {
        console.log('📋 Deployment History:\n');
        
        if (history.length === 0) {
          console.log('No deployments found');
          return;
        }
        
        history.forEach((deployment, index) => {
          const status = deployment.success ? '✅' : '❌';
          const duration = `${deployment.duration}ms`;
          const timestamp = deployment.timestamp.toISOString();
          
          console.log(`${index + 1}. ${status} ${deployment.target.name} (${deployment.deploymentId})`);
          console.log(`   Timestamp: ${timestamp}`);
          console.log(`   Duration: ${duration}`);
          
          if (deployment.error) {
            console.log(`   Error: ${deployment.error}`);
          }
          
          console.log(`   Services: ${deployment.services.length}`);
          console.log(`   Health Checks: ${deployment.healthChecks.length}`);
          console.log('');
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to get deployment history:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status <deployment-id>')
  .description('Get status of specific deployment')
  .option('--json', 'output as JSON')
  .action(async (deploymentId, options) => {
    try {
      const pipeline = new DeploymentPipeline();
      const deployment = pipeline.getDeployment(deploymentId);
      
      if (!deployment) {
        console.error(`❌ Deployment not found: ${deploymentId}`);
        process.exit(1);
      }
      
      if (options.json) {
        console.log(JSON.stringify(deployment, null, 2));
      } else {
        const status = deployment.success ? '✅ Success' : '❌ Failed';
        
        console.log(`📋 Deployment Status: ${deploymentId}\n`);
        console.log(`Status: ${status}`);
        console.log(`Target: ${deployment.target.name}`);
        console.log(`Duration: ${deployment.duration}ms`);
        console.log(`Timestamp: ${deployment.timestamp.toISOString()}`);
        
        if (deployment.error) {
          console.log(`Error: ${deployment.error}`);
        }
        
        console.log(`\n🚀 Services (${deployment.services.length}):`);
        deployment.services.forEach(service => {
          const serviceStatus = service.status === 'deployed' ? '✅' : '❌';
          console.log(`   ${serviceStatus} ${service.serviceName}: ${service.status}`);
        });
        
        console.log(`\n🏥 Health Checks (${deployment.healthChecks.length}):`);
        deployment.healthChecks.forEach(hc => {
          const healthStatus = hc.status === 'healthy' ? '✅' : '❌';
          console.log(`   ${healthStatus} ${hc.service}: ${hc.status} (${hc.responseTime}ms)`);
        });
        
        if (deployment.smokeTestResults) {
          const smokeStatus = deployment.smokeTestResults.failed === 0 ? '✅' : '❌';
          console.log(`\n💨 Smoke Tests: ${smokeStatus}`);
          console.log(`   Passed: ${deployment.smokeTestResults.passed}`);
          console.log(`   Failed: ${deployment.smokeTestResults.failed}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get deployment status:', error);
      process.exit(1);
    }
  });

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

program.parse();