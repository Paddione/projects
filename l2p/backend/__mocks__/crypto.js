// Mock for Node.js crypto module
module.exports = {
  randomBytes: vi.fn().mockImplementation((size) => ({
    toString: vi.fn().mockReturnValue(`mock-token-${size}`)
  }))
};