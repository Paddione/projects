/**
 * Unified Test Configuration Types
 * Defines interfaces for test configuration across frontend and backend
 */

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
  pool_size: number;
  timeout: number;
}

export interface ServiceConfig {
  port: number;
  health_endpoint: string;
  timeout: number;
  base_url: string;
}

export interface ServicesConfig {
  backend: ServiceConfig;
  frontend: ServiceConfig;
  [key: string]: ServiceConfig;
}

export interface CoverageThreshold {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface CoverageConfig {
  threshold: CoverageThreshold;
  exclude: string[];
}

export interface ReportingConfig {
  formats: string[];
  output_dir: string;
  open_browser: boolean;
}

export interface EnvironmentVariables {
  [key: string]: string;
}

export interface TestEnvironmentConfig {
  database: DatabaseConfig;
  services: ServicesConfig;
  coverage: CoverageConfig;
  reporting: ReportingConfig;
  environment_variables: EnvironmentVariables;
}

export interface TestTypeConfig {
  timeout: number;
  parallel: boolean;
  max_workers: string | number;
  bail: boolean;
  verbose: boolean;
  collect_coverage: boolean;
  setup_database?: boolean;
  headless?: boolean;
  browsers?: string[];
}

export interface GlobalTestConfig {
  max_test_timeout: number;
  setup_timeout: number;
  teardown_timeout: number;
  retry_attempts: number;
  retry_delay: number;
  log_level: string;
  clear_mocks: boolean;
  reset_mocks: boolean;
  restore_mocks: boolean;
  [key: string]: any;
}

export interface TestConfig {
  environments: {
    [key: string]: TestEnvironmentConfig;
  };
  test_types: {
    [key: string]: TestTypeConfig;
  };
  global: GlobalTestConfig;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'timeout';
  response_time?: number;
  error?: string;
  url: string;
}

export interface TestEnvironmentStatus {
  environment: string;
  status: 'ready' | 'starting' | 'failed' | 'stopped';
  services: HealthCheckResult[];
  database_connected: boolean;
  setup_time?: number;
  error?: string;
}

export type TestEnvironmentType = 'local' | 'ci' | 'docker';
export type TestType = 'unit' | 'integration' | 'e2e' | 'performance' | 'accessibility';

export interface TestExecutionContext {
  environment: TestEnvironmentType;
  test_type: TestType;
  config: TestConfig;
  environment_config: TestEnvironmentConfig;
  test_type_config: TestTypeConfig;
  global_config: GlobalTestConfig;
}