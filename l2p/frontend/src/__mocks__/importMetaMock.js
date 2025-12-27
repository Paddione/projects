// Mock for import.meta.env to avoid Jest parsing errors
const mockEnv = {
  MODE: 'test',
  VITE_TEST_MODE: 'true',
  VITE_API_URL: 'http://localhost:3001/api',
  VITE_SOCKET_URL: 'http://localhost:3001',
  VITE_APP_TITLE: 'Learn2Play',
  VITE_APP_VERSION: '1.0.0',
  VITE_APP_ENVIRONMENT: 'test',
  VITE_GEMINI_API_KEY: 'test-api-key',
  VITE_AZURE_CONNECTION_STRING: 'test-connection-string',
  VITE_CHROMA_URL: 'http://localhost:8000',
  VITE_CHROMA_COLLECTION: 'test-collection',
  VITE_CHROMA_API_KEY: 'test-chroma-key',
  VITE_APP_DEBUG: 'true',
  VITE_APP_LOG_LEVEL: 'debug',
  VITE_APP_FEATURE_FLAGS: '{}',
  VITE_APP_CONFIG: '{}',
  DEV: false,
  PROD: false,
  SSR: false
};

module.exports = {
  env: mockEnv,
  url: 'http://localhost:3000',
  hot: undefined,
  glob: jest.fn()
};
