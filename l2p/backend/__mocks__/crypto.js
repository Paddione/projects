// Mock for Node.js crypto module
module.exports = {
  randomBytes: jest.fn().mockImplementation((size) => ({
    toString: jest.fn().mockReturnValue(`mock-token-${size}`)
  }))
};