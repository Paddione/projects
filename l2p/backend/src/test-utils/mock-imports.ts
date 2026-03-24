import { vi } from 'vitest';

/**
 * Creates a mock for a module with proper ESM compatibility
 */
export function createMock<T extends object>(
  _modulePath: string,
  mockImplementation?: Partial<T>
): T {
  const mock = {} as T; // Vitest doesn't have createMockFromModule — use empty object
  if (mockImplementation) {
    return { ...mock, ...mockImplementation } as T;
  }
  return mock;
}

/**
 * Mocks a module with the given implementation
 */
export function mockModule(modulePath: string, implementation: any) {
  vi.mock(modulePath, () => ({
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
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

export default {
  createMock,
  mockModule,
  setupCommonMocks,
};
