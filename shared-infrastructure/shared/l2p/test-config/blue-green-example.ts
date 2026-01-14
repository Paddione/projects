#!/usr/bin/env node

/**
 * Blue-Green Deployment Example
 * Demonstrates how to use the blue-green deployment system
 */

import { DeploymentPipeline } from './DeploymentPipeline.js';
import { BlueGreenDeployment } from './BlueGreenDeployment.js';
import { STAGING_TARGET, PRODUCTION_TARGET } from './deployment-targets.js';
import { STAGING_BLUE_GREEN_CONFIG, PRODUCTION_BLUE_GREEN_CONFIG } from './blue-green-config.js';
import { NginxConfigGenerator } from './generate-nginx-config.js';

async function demonstrateBlueGreenDeployment() {
  console.log('🔄 Blue-Green Deployment Demonstration\n');

  try {
    // 1. Initialize deployment pipeline and blue-green deployment
    console.log('📋 Step 1: Initialize deployment systems...');
    const pipeline = new DeploymentPipeline();
    const blueGreenDeployment = new BlueGreenDeployment(STAGING_BLUE_GREEN_CONFIG);
    const nginxGenerator = new NginxConfigGenerator();

    // 2. Generate nginx configurations for both environments
    console.log('🔧 Step 2: Generate nginx configurations...');
    const nginxConfigs = nginxGenerator.generateBothEnvironments({
      domain: 'staging.learn2play.local',
      backendPort: 3001,
      frontendPort: 3000,
      sslEnabled: false
    });
    
    console.log(`   ✅ Blue config: ${nginxConfigs.blue}`);
    console.log(`   ✅ Green config: ${nginxConfigs.green}`);

    // 3. Validate deployment configuration
    console.log('\n🔍 Step 3: Validate deployment configuration...');
    const validation = await pipeline.validate(STAGING_TARGET);
    
    if (!validation.isValid) {
      console.log('❌ Validation failed:');
      validation.errors.forEach(error => console.log(`   - ${error.message}`));
      return;
    }
    console.log('   ✅ Validation passed');

    // 4. Build application
    console.log('\n🔨 Step 4: Build application...');
    const buildResult = await pipeline.build({
      skipTests: true, // Skip for demo
      verbose: false
    });
    
    if (!buildResult.success) {
      console.log(`❌ Build failed: ${buildResult.error}`);
      return;
    }
    console.log(`   ✅ Build completed (${buildResult.artifacts.length} artifacts)`);

    // 5. Check current environment status
    console.log('\n📊 Step 5: Check environment status...');
    const envStatus = blueGreenDeployment.getEnvironmentStatus();
    const activeEnv = await blueGreenDeployment.getActiveEnvironment();
    
    console.log(`   📍 Active environment: ${activeEnv}`);
    console.log(`   🔵 Blue status: ${envStatus.blue.status} (${envStatus.blue.healthStatus})`);
    console.log(`   🟢 Green status: ${envStatus.green.status} (${envStatus.green.healthStatus})`);

    // 6. Perform blue-green deployment
    console.log('\n🚀 Step 6: Perform blue-green deployment...');
    const deploymentResult = await blueGreenDeployment.deploy(
      STAGING_TARGET,
      'v1.2.3',
      buildResult.artifacts
    );

    if (deploymentResult.success) {
      console.log('   ✅ Blue-green deployment successful!');
      console.log(`   🆔 Deployment ID: ${deploymentResult.deploymentId}`);
      console.log(`   📍 New active environment: ${deploymentResult.activeEnvironment}`);
      console.log(`   🔀 Traffic switched: ${deploymentResult.trafficSwitched}`);
      console.log(`   📊 Monitoring results: ${deploymentResult.monitoringResults.length} data points`);
      
      // Show health check results
      console.log('\n   🏥 Health check results:');
      deploymentResult.healthChecks.forEach(hc => {
        const status = hc.status === 'healthy' ? '✅' : '❌';
        console.log(`      ${status} ${hc.service}: ${hc.status} (${hc.responseTime}ms)`);
      });
      
      // Show smoke test results
      if (deploymentResult.smokeTestResults) {
        const smokeStatus = deploymentResult.smokeTestResults.failed === 0 ? '✅' : '❌';
        console.log(`\n   💨 Smoke tests: ${smokeStatus}`);
        console.log(`      Passed: ${deploymentResult.smokeTestResults.passed}`);
        console.log(`      Failed: ${deploymentResult.smokeTestResults.failed}`);
      }
      
    } else {
      console.log('❌ Blue-green deployment failed:');
      console.log(`   Error: ${deploymentResult.error}`);
      console.log(`   Rollback triggered: ${deploymentResult.rollbackTriggered}`);
      
      if (deploymentResult.rollbackAvailable) {
        console.log('   🔄 Rollback is available');
      }
    }

    // 7. Demonstrate rollback (if deployment was successful)
    if (deploymentResult.success) {
      console.log('\n🔄 Step 7: Demonstrate rollback capability...');
      console.log('   (In a real scenario, you would only rollback if there were issues)');
      
      try {
        await blueGreenDeployment.rollback('Demonstration rollback');
        console.log('   ✅ Rollback completed successfully');
        
        const newActiveEnv = await blueGreenDeployment.getActiveEnvironment();
        console.log(`   📍 Active environment after rollback: ${newActiveEnv}`);
        
      } catch (error) {
        console.log(`   ⚠️  Rollback demonstration failed: ${error}`);
      }
    }

    // 8. Show final environment status
    console.log('\n📊 Step 8: Final environment status...');
    const finalStatus = blueGreenDeployment.getEnvironmentStatus();
    const finalActiveEnv = await blueGreenDeployment.getActiveEnvironment();
    
    console.log(`   📍 Final active environment: ${finalActiveEnv}`);
    console.log(`   🔵 Blue: ${finalStatus.blue.status} (version: ${finalStatus.blue.version || 'none'})`);
    console.log(`   🟢 Green: ${finalStatus.green.status} (version: ${finalStatus.green.version || 'none'})`);

    // 9. Cleanup
    console.log('\n🧹 Step 9: Cleanup...');
    pipeline.cleanup();
    blueGreenDeployment.cleanup();
    console.log('   ✅ Cleanup completed');

    console.log('\n🎉 Blue-Green Deployment Demonstration Complete!');
    console.log('\nKey Benefits Demonstrated:');
    console.log('   • Zero-downtime deployments');
    console.log('   • Automatic health checking');
    console.log('   • Smoke test validation');
    console.log('   • Monitoring-based rollback triggers');
    console.log('   • Instant rollback capability');
    console.log('   • Environment isolation');

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  }
}

async function demonstrateProductionDeployment() {
  console.log('🏭 Production Blue-Green Deployment Example\n');

  try {
    const pipeline = new DeploymentPipeline();
    const blueGreenDeployment = new BlueGreenDeployment(PRODUCTION_BLUE_GREEN_CONFIG);

    console.log('📋 Production deployment process:');
    console.log('   1. Comprehensive validation (security, dependencies, tests)');
    console.log('   2. Build with production optimizations');
    console.log('   3. Deploy to inactive environment');
    console.log('   4. Extended health checking (10 minutes)');
    console.log('   5. Comprehensive smoke tests');
    console.log('   6. Gradual traffic switching (10% → 25% → 50% → 75% → 100%)');
    console.log('   7. Extended monitoring with strict thresholds');
    console.log('   8. Automatic rollback on any issues');

    // Demonstrate production validation
    console.log('\n🔍 Production validation example...');
    const validation = await pipeline.validate(PRODUCTION_TARGET);
    
    console.log(`   Validation result: ${validation.isValid ? '✅ Passed' : '❌ Failed'}`);
    if (validation.errors.length > 0) {
      console.log('   Errors found:');
      validation.errors.forEach(error => console.log(`      - [${error.type}] ${error.message}`));
    }
    if (validation.warnings.length > 0) {
      console.log('   Warnings:');
      validation.warnings.forEach(warning => console.log(`      - ${warning}`));
    }

    console.log('\n📊 Production monitoring configuration:');
    const config = PRODUCTION_BLUE_GREEN_CONFIG;
    console.log(`   Error rate threshold: ${config.monitoring.errorRateThreshold}%`);
    console.log(`   Response time threshold: ${config.monitoring.responseTimeThreshold}ms`);
    console.log(`   Monitoring duration: ${config.monitoring.monitoringDuration}s`);
    console.log(`   Check interval: ${config.monitoring.checkInterval}s`);

    console.log('\n🚨 Rollback triggers:');
    config.rollbackTriggers.forEach((trigger, index) => {
      const status = trigger.enabled ? '✅' : '❌';
      console.log(`   ${status} ${index + 1}. ${trigger.type}: ${trigger.threshold} (${trigger.duration}s window)`);
    });

    console.log('\n💨 Production smoke tests:');
    console.log(`   Command: ${config.smokeTests.command}`);
    console.log(`   Timeout: ${config.smokeTests.timeout}ms`);
    console.log(`   Retries: ${config.smokeTests.retries}`);
    console.log(`   Critical endpoints: ${config.smokeTests.criticalEndpoints.length}`);
    config.smokeTests.criticalEndpoints.forEach(endpoint => {
      console.log(`      - ${endpoint}`);
    });

    console.log('\n🔄 Traffic switching strategy:');
    console.log(`   Strategy: ${config.trafficSwitching.strategy}`);
    if (config.trafficSwitching.gradualSteps) {
      console.log(`   Gradual steps: ${config.trafficSwitching.gradualSteps.join('% → ')}%`);
    }
    console.log(`   Switch timeout: ${config.trafficSwitching.switchTimeout}ms`);

    pipeline.cleanup();
    blueGreenDeployment.cleanup();

  } catch (error) {
    console.error('❌ Production example failed:', error);
  }
}

async function demonstrateNginxConfiguration() {
  console.log('🔧 Nginx Configuration Management Example\n');

  try {
    const generator = new NginxConfigGenerator();

    console.log('📋 Generating nginx configurations...');
    
    // Generate staging configurations
    const stagingConfigs = generator.generateBothEnvironments({
      domain: 'staging.learn2play.com',
      backendPort: 3001,
      frontendPort: 3000,
      sslEnabled: false
    });

    console.log(`   ✅ Staging blue: ${stagingConfigs.blue}`);
    console.log(`   ✅ Staging green: ${stagingConfigs.green}`);

    // Generate production configurations
    const productionConfigs = generator.generateBothEnvironments({
      domain: 'learn2play.com',
      backendPort: 3001,
      frontendPort: 3000,
      sslEnabled: true
    });

    console.log(`   ✅ Production blue: ${productionConfigs.blue}`);
    console.log(`   ✅ Production green: ${productionConfigs.green}`);

    console.log('\n🔀 Traffic switching simulation...');
    console.log('   Current active: blue');
    console.log('   Switching to: green');
    
    try {
      generator.switchActiveConfig('green');
      console.log('   ✅ Traffic switched to green environment');
    } catch (error) {
      console.log(`   ⚠️  Traffic switch simulation: ${error}`);
    }

    console.log('\n✅ Nginx configuration management complete');

  } catch (error) {
    console.error('❌ Nginx configuration example failed:', error);
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2] || 'staging';

  switch (command) {
    case 'staging':
      demonstrateBlueGreenDeployment();
      break;
    case 'production':
      demonstrateProductionDeployment();
      break;
    case 'nginx':
      demonstrateNginxConfiguration();
      break;
    case 'all':
      (async () => {
        await demonstrateBlueGreenDeployment();
        console.log('\n' + '='.repeat(80) + '\n');
        await demonstrateProductionDeployment();
        console.log('\n' + '='.repeat(80) + '\n');
        await demonstrateNginxConfiguration();
      })();
      break;
    default:
      console.log('Usage: blue-green-example [staging|production|nginx|all]');
      console.log('');
      console.log('Commands:');
      console.log('  staging     - Demonstrate staging blue-green deployment');
      console.log('  production  - Show production deployment configuration');
      console.log('  nginx       - Demonstrate nginx configuration management');
      console.log('  all         - Run all demonstrations');
      process.exit(1);
  }
}

export {
  demonstrateBlueGreenDeployment,
  demonstrateProductionDeployment,
  demonstrateNginxConfiguration
};