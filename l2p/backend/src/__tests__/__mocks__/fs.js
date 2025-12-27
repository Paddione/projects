// Jest mock for Node 'fs' module (Hybrid CommonJS/ES Module format)

// Try to get Jest from different sources
let jestMock;
try {
  // Check if Jest is already available globally (common in Jest environment)
  if (typeof globalThis !== 'undefined' && globalThis.jest) {
    jestMock = globalThis.jest;
  } else if (typeof global !== 'undefined' && global.jest) {
    jestMock = global.jest;
  } else {
    // Try CommonJS import
    const jestGlobals = require('@jest/globals');
    jestMock = jestGlobals.jest;
  }
} catch (e) {
  // If Jest is not available, create simple mock functions
  jestMock = {
    fn: (impl) => {
      const mockFn = impl || (() => {});
      mockFn.mockImplementation = (newImpl) => {
        Object.assign(mockFn, newImpl);
        return mockFn;
      };
      mockFn.mockReturnValue = (value) => {
        Object.assign(mockFn, () => value);
        return mockFn;
      };
      return mockFn;
    }
  };
}

const existsSync = jestMock.fn(() => true);
const mkdirSync = jestMock.fn(() => undefined);
const unlinkSync = jestMock.fn();
const statSync = jestMock.fn(() => ({
  size: BigInt(1024),
  isFile: () => true,
  isDirectory: () => false,
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  atime: new Date(),
  mtime: new Date(),
  ctime: new Date(),
  birthtime: new Date()
}));
const readFileSync = jestMock.fn(() => Buffer.from('Test content'));

const fsMock = {
  existsSync,
  mkdirSync,
  unlinkSync,
  statSync,
  readFileSync,
};

// Support both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = fsMock;
  module.exports.default = fsMock;
  // Named exports for CommonJS
  module.exports.existsSync = existsSync;
  module.exports.mkdirSync = mkdirSync;
  module.exports.unlinkSync = unlinkSync;
  module.exports.statSync = statSync;
  module.exports.readFileSync = readFileSync;
}
