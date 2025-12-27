const DEFAULT_TIMEOUTS = {
  unit: 30_000,
  integration: 60_000,
  e2e: 120_000,
  performance: 300_000,
};

const testType = process.env.TEST_TYPE ?? 'unit';
const configuredTimeout = Number(process.env.JEST_TEST_TIMEOUT ?? DEFAULT_TIMEOUTS[testType]);

if (!Number.isNaN(configuredTimeout) && typeof jest !== 'undefined') {
  jest.setTimeout(configuredTimeout);
}
