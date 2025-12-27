import { jest } from '@jest/globals';

// Re-export jest for convenience
export { jest };

// Helper to wait for promises to resolve
export const flushPromises = () => new Promise(setImmediate);

// Helper to mock timers and advance time
export const advanceTimersByTime = (ms: number) => {
  jest.advanceTimersByTime(ms);
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
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

// Helper to create a mock next function
export const createMockNext = () => jest.fn();

// Helper to reset all mocks between tests
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetModules();
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
