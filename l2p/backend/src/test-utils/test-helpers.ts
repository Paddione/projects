import { vi } from 'vitest';

// Re-export vi for convenience
export { vi };

// Helper to wait for promises to resolve
export const flushPromises = () => new Promise(setImmediate);

// Helper to mock timers and advance time
export const advanceTimersByTime = (ms: number) => {
  vi.advanceTimersByTime(ms);
  return flushPromises();
};

// Helper to create a mock request
export const createMockRequest = (overrides: any = {}) => ({
  params: {},
  query: {},
  body: {},
  headers: {},
  ...overrides,
});

// Helper to create a mock response
export const createMockResponse = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
};

// Helper to create a mock next function
export const createMockNext = () => vi.fn();

// Helper to reset all mocks between tests
export const resetAllMocks = () => {
  vi.clearAllMocks();
  vi.resetModules();
};

// Export mock data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  isAdmin: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockGame = {
  id: 'test-game-id',
  name: 'Test Game',
  description: 'A test game',
  status: 'waiting',
  maxPlayers: 4,
  currentPlayers: 1,
  createdBy: 'test-user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
