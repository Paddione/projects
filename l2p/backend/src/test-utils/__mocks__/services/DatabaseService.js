const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
const mockGetClient = jest.fn().mockResolvedValue({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn()
});

const mockClose = jest.fn().mockResolvedValue(undefined);

const mockGetInstance = jest.fn().mockReturnValue({
  query: mockQuery,
  getClient: mockGetClient,
  close: mockClose
});

const mockDatabaseService = {
  query: mockQuery,
  getClient: mockGetClient,
  close: mockClose
};

// Export for CommonJS
module.exports = {
  mockDatabaseService,
  default: {
    getInstance: mockGetInstance,
    ...mockDatabaseService
  }
};
