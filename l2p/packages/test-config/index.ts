// Barrel file for test-config shared module
export { PerformanceTestFramework } from './PerformanceTestFramework';
export { TestConfigManager } from './TestConfigManager';

// Re-export types
export type { 
  TestConfig,
  TestEnvironmentConfig,
  TestTypeConfig,
  GlobalTestConfig,
  TestExecutionContext,
  TestEnvironmentType,
  TestType
} from './types';
