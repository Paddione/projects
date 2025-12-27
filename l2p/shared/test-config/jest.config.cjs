module.exports = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // Handle module aliases if any (adjust as needed)
    '^@/(.*)$': '<rootDir>/$1',
    // Map .js imports to .ts files for local modules
    '^(.*)\.js$': '$1',
    // Handle built-in modules
    '^(\.{1,2}/.*)\.js$': '$1'
  },
  transform: {
    // Process both .ts and .js files with ts-jest
    '^.+\.[tj]sx?$': ['ts-jest', {
      useESM: true,
      tsconfig: './tsconfig.test.json',
      isolatedModules: true,
      babelConfig: {
        presets: [
          ['@babel/preset-env', { 
            targets: { node: 'current' },
            modules: 'commonjs' // Ensure we use CommonJS for Jest
          }],
          '@babel/preset-typescript'
        ]
      }
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|commander|yargs|yargs-parser)/)'
  ],
  testMatch: [
    '**/__tests__/**/*.test.ts'
  ],
  moduleFileExtensions: ['js', 'ts', 'json', 'node'],
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true
    }
  }
};
