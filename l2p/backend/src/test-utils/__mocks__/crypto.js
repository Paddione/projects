const randomBytes = jest.fn().mockReturnValue(Buffer.from('test-buffer'));
const randomInt = jest.fn().mockReturnValue(12345);
const createHash = jest.fn().mockReturnValue({
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue('hashed-value')
});

module.exports = {
  randomBytes,
  randomInt,
  createHash,
  default: {
    randomBytes,
    randomInt,
    createHash
  }
};
