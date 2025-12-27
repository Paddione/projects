#!/usr/bin/env node

/**
 * Test Configuration CLI Tool
 * Provides commands for managing and validating test configuration
 */

import { TestConfigManager } from '../shared/test-config/dist/TestConfigManager.js';
import { TestUtilities } from '../shared/test-config/dist/TestUtilities.js';

const commands = {
  validate: validateConfig,
  'health-check': healthCheck,
  'list-environments': listEnvironments,
  'list-test-types': listTestTypes,
  'show-config': showConfig,
  'init-env': initEnvironment,
  help: showHelp
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  if (!commands[command]) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }
  
  try {
    await commands[command](args.slice(1));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function validateConfig(args) {
  console.log('Validating test configuration...');
  
  const configManager = TestConfigManager.getInstance();
  
  try {
    configManager.loadConfig();
    const validation = configManager.validateConfig();
    
    if (validation.isValid) {
      console.log('✅ Configuration is valid');
      
      if (validation.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validation.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
    } else {
      console.log('❌ Configuration validation failed:');
      validation.errors.forEach(error => {
        console.log(`  - ${error.field}: ${error.message}`);
      });
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    process.exit(1);
  }
}

async function healthCheck(args) {
  const environment = args[0] || 'local';
  
  console.log(`Performing health check for ${environment} environment...`);
  
  const configManager = TestConfigManager.getInstance();
  
  try {
    const status = await configManager.performHealthCheck(environment);
    
    console.log(`\nEnvironment: ${status.environment}`);
    console.log(`Status: ${status.status}`);
    console.log(`Database Connected: ${status.database_connected}`);
    
    if (status.setup_time) {
      console.log(`Setup Time: ${status.setup_time}ms`);
    }
    
    console.log('\nServices:');
    status.services.forEach(service => {
      const statusIcon = service.status === 'healthy' ? '✅' : '❌';
      console.log(`  ${statusIcon} ${service.service}: ${service.status}`);
      
      if (service.response_time) {
        console.log(`     Response Time: ${service.response_time}ms`);
      }
      
      if (service.error) {
        console.log(`     Error: ${service.error}`);
      }
      
      console.log(`     URL: ${service.url}`);
    });
    
    if (status.error) {
      console.log(`\nError: ${status.error}`);
    }
    
    if (status.status !== 'ready') {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

async function listEnvironments(args) {
  const configManager = TestConfigManager.getInstance();
  
  try {
    const config = configManager.loadConfig();
    
    console.log('Available environments:');
    Object.keys(config.environments).forEach(env => {
      console.log(`  - ${env}`);
    });
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    process.exit(1);
  }
}

async function listTestTypes(args) {
  const configManager = TestConfigManager.getInstance();
  
  try {
    const config = configManager.loadConfig();
    
    console.log('Available test types:');
    Object.keys(config.test_types).forEach(type => {
      console.log(`  - ${type}`);
    });
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    process.exit(1);
  }
}

async function showConfig(args) {
  const environment = args[0];
  const testType = args[1];
  
  const configManager = TestConfigManager.getInstance();
  
  try {
    if (environment && testType) {
      const context = configManager.createExecutionContext(environment, testType);
      console.log(`Configuration for ${environment}/${testType}:`);
      console.log(JSON.stringify(context, null, 2));
    } else if (environment) {
      const envConfig = configManager.getEnvironmentConfig(environment);
      console.log(`Environment configuration for ${environment}:`);
      console.log(JSON.stringify(envConfig, null, 2));
    } else {
      const config = configManager.loadConfig();
      console.log('Full configuration:');
      console.log(JSON.stringify(config, null, 2));
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    process.exit(1);
  }
}

async function initEnvironment(args) {
  const environment = args[0] || 'local';
  const testType = args[1] || 'unit';
  
  console.log(`Initializing ${environment} environment for ${testType} tests...`);
  
  try {
    const context = await TestUtilities.initializeTestEnvironment(environment, testType);
    
    console.log('✅ Environment initialized successfully');
    console.log(`Database URL: ${context.environment_config.database.url}`);
    console.log(`Backend URL: ${context.environment_config.services.backend.base_url}`);
    console.log(`Frontend URL: ${context.environment_config.services.frontend.base_url}`);
    
    // Perform health check
    console.log('\nPerforming health check...');
    const status = await TestUtilities.configManager.performHealthCheck(environment);
    
    if (status.status === 'ready') {
      console.log('✅ All services are ready');
    } else {
      console.log('⚠️  Some services may not be ready');
      status.services.forEach(service => {
        if (service.status !== 'healthy') {
          console.log(`  - ${service.service}: ${service.status} (${service.error || 'Unknown error'})`);
        }
      });
    }
  } catch (error) {
    console.error('❌ Failed to initialize environment:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Test Configuration CLI

Usage: node scripts/test-config.js <command> [options]

Commands:
  validate                    Validate the test configuration file
  health-check [environment]  Check health of services in environment (default: local)
  list-environments          List all available environments
  list-test-types            List all available test types
  show-config [env] [type]   Show configuration (full, environment, or specific context)
  init-env [env] [type]      Initialize environment and check services
  help                       Show this help message

Examples:
  node scripts/test-config.js validate
  node scripts/test-config.js health-check local
  node scripts/test-config.js show-config local unit
  node scripts/test-config.js init-env ci integration

Environment Variables:
  TEST_ENVIRONMENT           Set default test environment (local, ci, docker)
  TEST_TYPE                  Set default test type (unit, integration, e2e, performance, accessibility)
`);
}

// Run the CLI
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});