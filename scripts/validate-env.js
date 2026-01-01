#!/usr/bin/env node

/**
 * Environment Validation Script
 * Validates environment files across all services in the monorepo
 */

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const PROJECTS_ROOT = path.resolve(__dirname, '..');

// Environment validation configuration for each service
const SERVICE_CONFIGS = {
  'shared-infrastructure': {
    name: 'Shared Infrastructure',
    envFiles: ['.env-prod'],
    required: {
      '.env-prod': [
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'AUTH_DB_USER',
        'AUTH_DB_PASSWORD',
        'L2P_DB_USER',
        'L2P_DB_PASSWORD',
        'PAYMENT_DB_USER',
        'PAYMENT_DB_PASSWORD',
        'VIDEOVAULT_DB_USER',
        'VIDEOVAULT_DB_PASSWORD',
      ],
    },
    validatePasswords: true,
  },
  auth: {
    name: 'Auth Service',
    envFiles: ['.env-dev', '.env-prod'],
    required: {
      '.env-dev': [
        'PORT',
        'NODE_ENV',
        'DATABASE_URL',
        'AUTH_DB_USER',
        'AUTH_DB_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
      ],
      '.env-prod': [
        'PORT',
        'NODE_ENV',
        'DATABASE_URL',
        'AUTH_DB_USER',
        'AUTH_DB_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
      ],
    },
    secrets: ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'],
    matchPasswords: ['AUTH_DB_PASSWORD'],
  },
  l2p: {
    name: 'Learn2Play',
    envFiles: ['.env-dev', '.env-prod'],
    required: {
      '.env-dev': [
        'DATABASE_URL',
        'DB_USER',
        'DB_PASSWORD',
        'L2P_DB_USER',
        'L2P_DB_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
      ],
      '.env-prod': [
        'DATABASE_URL',
        'DB_USER',
        'DB_PASSWORD',
        'L2P_DB_USER',
        'L2P_DB_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
      ],
    },
    secrets: ['JWT_SECRET', 'JWT_REFRESH_SECRET'],
    matchPasswords: ['L2P_DB_PASSWORD'],
  },
  VideoVault: {
    name: 'VideoVault',
    envFiles: ['.env-dev', '.env-prod'],
    required: {
      '.env-dev': [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'SESSION_SECRET',
        'ADMIN_USER',
        'ADMIN_PASS',
      ],
      '.env-prod': [
        'NODE_ENV',
        'PORT',
        'DATABASE_URL',
        'SESSION_SECRET',
        'ADMIN_USER',
        'ADMIN_PASS',
      ],
    },
    secrets: ['SESSION_SECRET', 'ADMIN_PASS'],
    matchPasswords: ['VIDEOVAULT_DB_PASSWORD'],
  },
  payment: {
    name: 'Payment Service',
    envFiles: ['.env-dev', '.env-prod'],
    required: {
      '.env-dev': [
        'DATABASE_URL',
        'PAYMENT_DB_USER',
        'PAYMENT_DB_PASSWORD',
        'NEXTAUTH_SECRET',
        'AUTH_SECRET',
      ],
      '.env-prod': [
        'DATABASE_URL',
        'PAYMENT_DB_USER',
        'PAYMENT_DB_PASSWORD',
        'NEXTAUTH_SECRET',
        'AUTH_SECRET',
      ],
    },
    secrets: ['NEXTAUTH_SECRET', 'AUTH_SECRET'],
    matchPasswords: ['PAYMENT_DB_PASSWORD'],
  },
  vllm: {
    name: 'VLLM',
    envFiles: ['.env-dev', '.env-prod'],
    required: {
      '.env-dev': ['VLLM_BASE_URL', 'PORT'],
      '.env-prod': ['VLLM_BASE_URL', 'PORT', 'HF_TOKEN'],
    },
    optional: true, // VLLM is optional
  },
  'reverse-proxy': {
    name: 'Reverse Proxy (Traefik)',
    envFiles: ['.env-prod'],
    required: {
      '.env-prod': ['ACME_EMAIL', 'TRAEFIK_DASHBOARD_USER'],
    },
    optional: true, // Reverse proxy is optional for local dev
  },
};

// Default placeholder values that should be replaced
const PLACEHOLDER_PATTERNS = [
  /^your[_-]/i,
  /^change[_-]/i,
  /placeholder/i,
  /example/i,
  /\.\.\./,
  /^sk_test_\.\.\.$/,
  /^whsec_\.\.\.$/,
  /^pk_test_\.\.\.$/,
];

class ValidationError {
  constructor(service, envFile, message) {
    this.service = service;
    this.envFile = envFile;
    this.message = message;
  }
}

class ValidationWarning {
  constructor(service, envFile, message) {
    this.service = service;
    this.envFile = envFile;
    this.message = message;
  }
}

/**
 * Load environment file and parse variables
 */
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const vars = {};

  content.split('\n').forEach((line) => {
    line = line.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      vars[key] = value.replace(/^["']|["']$/g, '');
    }
  });

  return vars;
}

/**
 * Check if a value is a placeholder
 */
function isPlaceholder(value) {
  if (!value || value.length === 0) {
    return true;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Validate password is alphanumeric only
 */
function isAlphanumeric(value) {
  return /^[a-zA-Z0-9]+$/.test(value);
}

/**
 * Validate a single environment file
 */
function validateEnvFile(serviceName, envFileName, config) {
  const errors = [];
  const warnings = [];
  const servicePath = path.join(PROJECTS_ROOT, serviceName);
  const envFilePath = path.join(servicePath, envFileName);
  const requiredVars = config.required[envFileName] || [];

  // Check if file exists
  const envVars = loadEnvFile(envFilePath);
  if (!envVars) {
    if (!config.optional) {
      errors.push(
        new ValidationError(
          serviceName,
          envFileName,
          `File not found: ${envFilePath}`
        )
      );
    }
    return { errors, warnings };
  }

  // Check required variables
  for (const varName of requiredVars) {
    if (!(varName in envVars)) {
      errors.push(
        new ValidationError(
          serviceName,
          envFileName,
          `Missing required variable: ${varName}`
        )
      );
      continue;
    }

    const value = envVars[varName];

    // Check for placeholder values in secrets
    if (config.secrets && config.secrets.includes(varName)) {
      if (isPlaceholder(value)) {
        errors.push(
          new ValidationError(
            serviceName,
            envFileName,
            `Variable ${varName} has placeholder value: "${value}"`
          )
        );
      }
    }

    // Check password format for database passwords
    if (config.matchPasswords && config.matchPasswords.includes(varName)) {
      if (!isAlphanumeric(value)) {
        warnings.push(
          new ValidationWarning(
            serviceName,
            envFileName,
            `Password ${varName} contains special characters. Use alphanumeric only to avoid Docker/PostgreSQL escaping issues.`
          )
        );
      }
    }
  }

  return { errors, warnings, envVars };
}

/**
 * Validate password consistency across services
 */
function validatePasswordConsistency(results) {
  const errors = [];
  const sharedInfra = results['shared-infrastructure']?.['.env-prod'];

  if (!sharedInfra || !sharedInfra.envVars) {
    return errors;
  }

  const passwordMap = {
    AUTH_DB_PASSWORD: 'auth',
    L2P_DB_PASSWORD: 'l2p',
    PAYMENT_DB_PASSWORD: 'payment',
    VIDEOVAULT_DB_PASSWORD: 'VideoVault',
  };

  for (const [passwordVar, serviceName] of Object.entries(passwordMap)) {
    const sharedPassword = sharedInfra.envVars[passwordVar];

    if (!sharedPassword) {
      continue;
    }

    // Check both dev and prod environments
    for (const envFile of ['.env-dev', '.env-prod']) {
      const serviceResult = results[serviceName]?.[envFile];

      if (!serviceResult || !serviceResult.envVars) {
        continue;
      }

      const servicePassword = serviceResult.envVars[passwordVar];

      if (servicePassword && servicePassword !== sharedPassword) {
        errors.push(
          new ValidationError(
            serviceName,
            envFile,
            `Password mismatch: ${passwordVar} in ${serviceName}/${envFile} does not match shared-infrastructure/.env-prod`
          )
        );
      }
    }
  }

  return errors;
}

/**
 * Validate all services
 */
function validateAll(environment = 'all') {
  const results = {};
  const allErrors = [];
  const allWarnings = [];

  console.log(
    `${colors.bold}${colors.cyan}Environment Validation${colors.reset}\n`
  );
  console.log(`Environment: ${environment}\n`);

  // Validate each service
  for (const [serviceName, config] of Object.entries(SERVICE_CONFIGS)) {
    results[serviceName] = {};

    const envFilesToCheck =
      environment === 'all'
        ? config.envFiles
        : config.envFiles.filter((f) =>
            environment === 'dev' ? f.includes('dev') : f.includes('prod')
          );

    for (const envFile of envFilesToCheck) {
      const { errors, warnings, envVars } = validateEnvFile(
        serviceName,
        envFile,
        config
      );

      results[serviceName][envFile] = { errors, warnings, envVars };
      allErrors.push(...errors);
      allWarnings.push(...warnings);
    }
  }

  // Validate password consistency
  const passwordErrors = validatePasswordConsistency(results);
  allErrors.push(...passwordErrors);

  // Print results
  console.log(`${colors.bold}Validation Results:${colors.reset}\n`);

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log(
      `${colors.green}✓ All environment files are valid!${colors.reset}\n`
    );
    return true;
  }

  // Print errors
  if (allErrors.length > 0) {
    console.log(`${colors.bold}${colors.red}Errors:${colors.reset}`);
    for (const error of allErrors) {
      console.log(
        `  ${colors.red}✗${colors.reset} ${colors.bold}${error.service}/${error.envFile}:${colors.reset} ${error.message}`
      );
    }
    console.log();
  }

  // Print warnings
  if (allWarnings.length > 0) {
    console.log(`${colors.bold}${colors.yellow}Warnings:${colors.reset}`);
    for (const warning of allWarnings) {
      console.log(
        `  ${colors.yellow}⚠${colors.reset} ${colors.bold}${warning.service}/${warning.envFile}:${colors.reset} ${warning.message}`
      );
    }
    console.log();
  }

  // Print summary
  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`  Errors: ${allErrors.length}`);
  console.log(`  Warnings: ${allWarnings.length}`);
  console.log();

  if (allErrors.length > 0) {
    console.log(
      `${colors.red}Validation failed. Please fix the errors above.${colors.reset}\n`
    );
    process.exit(1);
  }

  return false;
}

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'all'; // 'all', 'dev', or 'prod'

if (!['all', 'dev', 'prod'].includes(environment)) {
  console.error(
    `${colors.red}Invalid environment: ${environment}${colors.reset}`
  );
  console.error('Usage: node validate-env.js [all|dev|prod]');
  process.exit(1);
}

validateAll(environment);
