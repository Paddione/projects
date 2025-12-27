import { jest } from '@jest/globals';

/**
 * Creates a mock for a module with proper ESM compatibility
 */
export function createMock<T extends object>(
  modulePath: string,
  mockImplementation?: Partial<T>
): T {
  const mock = jest.createMockFromModule<T>(modulePath);
  if (mockImplementation) {
    return { ...mock, ...mockImplementation } as T;
  }
  return mock;
}

/**
 * Mocks a module with the given implementation
 */
export function mockModule(modulePath: string, implementation: any) {
  jest.unstable_mockModule(modulePath, () => ({
    __esModule: true,
    default: implementation,
    ...implementation,
  }));
}

/**
 * Sets up common mocks used across test files
 */
export function setupCommonMocks() {
  // Mock console methods to reduce test noise
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export default {
  createMock,
  mockModule,
  setupCommonMocks,
};
