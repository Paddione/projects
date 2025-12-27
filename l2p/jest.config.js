import path from 'node:path';
import { fileURLToPath } from 'node:url';

import frontendConfig from './frontend/jest.config.mjs';
import backendConfig from './backend/jest.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = __dirname;
const projectRoot = (relativePath) => path.join(repoRoot, relativePath);
const GLOBAL_ONLY_KEYS = new Set([
  'bail',
  'collectCoverage',
  'coverageReporters',
  'testTimeout',
  'verbose',
]);

const cloneConfig = (config) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(config);
  }

  return JSON.parse(JSON.stringify(config));
};

const buildProjectConfig = (name, relativeDir, config) => {
  const cloned = cloneConfig(config);

  for (const key of GLOBAL_ONLY_KEYS) {
    if (key in cloned) {
      delete cloned[key];
    }
  }

  return {
    displayName: name,
    rootDir: projectRoot(relativeDir),
    ...cloned,
  };
};

const frontendProject = buildProjectConfig('frontend', 'frontend', frontendConfig);
const backendProject = buildProjectConfig('backend', 'backend', backendConfig);

export default {
  projects: [frontendProject, backendProject],
  coverageDirectory: path.join(repoRoot, 'coverage-reports'),
  collectCoverageFrom: [
    '<rootDir>/frontend/src/**/*.{ts,tsx}',
    '<rootDir>/backend/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
};
