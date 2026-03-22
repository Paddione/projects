const generateToken = vi.fn().mockReturnValue('test-jwt-token');
const verifyToken = vi.fn().mockReturnValue({ userId: 'test-user-id' });

const mockJwtUtils = {
  generateToken,
  verifyToken
};

// Export for CommonJS
module.exports = {
  mockJwtUtils,
  default: {
    ...mockJwtUtils
  }
};
