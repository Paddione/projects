const generateToken = jest.fn().mockReturnValue('test-jwt-token');
const verifyToken = jest.fn().mockReturnValue({ userId: 'test-user-id' });

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
