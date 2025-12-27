// Ensure Jest globals are available in ESM tests without changing test files
import { jest as jestGlobals, expect as expectGlobals, describe, test, it, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createRequire } from 'module';

// Attach commonly-used globals
Object.assign(globalThis as any, {
  jest: jestGlobals,
  expect: expectGlobals,
  describe,
  test,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
});

// Provide a Node-style require in ESM context for legacy tests
if (!(globalThis as any).require) {
  // Use __filename when available (Jest often runs this file in CJS),
  // otherwise fall back to the project root to construct a resolver.
  // This avoids relying on import.meta in environments where it's not enabled.
  const baseForRequire = (typeof __filename !== 'undefined' && __filename)
    ? __filename
    : (process.cwd() + '/');
  (globalThis as any).require = createRequire(baseForRequire);
}

// No global fs mock; tests will mock fs locally where needed

// Note: Do not globally mock 'path' as some native deps (e.g., bcrypt) rely on path.resolve

// Provide default env expected by some tests/services
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
