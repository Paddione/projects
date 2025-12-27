// Jest mock for Node 'path' module (Hybrid CommonJS/ES Module format)

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

const join = jestMock.fn((...args) => args.join('/'));
const resolve = jestMock.fn((...args) => args.join('/'));
const relative = jestMock.fn((from, to) => to);
const dirname = jestMock.fn((p) => p.split('/').slice(0, -1).join('/'));
const basename = jestMock.fn((p, ext) => {
  const base = p.split('/').pop() || '';
  return ext ? base.replace(ext, '') : base;
});
const extname = jestMock.fn(() => '.pdf'); // Default return value for tests

const pathMock = {
  join,
  resolve,
  relative,
  dirname,
  basename,
  extname,
};

// Support both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = pathMock;
  module.exports.default = pathMock;
  // Named exports for CommonJS
  module.exports.join = join;
  module.exports.resolve = resolve;
  module.exports.relative = relative;
  module.exports.dirname = dirname;
  module.exports.basename = basename;
  module.exports.extname = extname;
}
