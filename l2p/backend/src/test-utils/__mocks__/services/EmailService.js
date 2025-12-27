const sendEmail = jest.fn().mockResolvedValue(true);

const mockEmailService = {
  sendEmail
};

// Export for CommonJS
module.exports = {
  mockEmailService,
  default: {
    ...mockEmailService
  }
};
