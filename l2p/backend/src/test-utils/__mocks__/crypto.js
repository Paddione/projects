const randomBytes = vi.fn().mockReturnValue(Buffer.from('test-buffer'));
const randomInt = vi.fn().mockReturnValue(12345);
const createHash = vi.fn().mockReturnValue({
  update: vi.fn().mockReturnThis(),
  digest: vi.fn().mockReturnValue('hashed-value')
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
