const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
const mockGetClient = vi.fn().mockResolvedValue({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn()
});

const mockClose = vi.fn().mockResolvedValue(undefined);

const mockGetInstance = vi.fn().mockReturnValue({
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
