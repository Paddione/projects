// Jest teardown for integration tests
export default async function teardown() {
  // Simple teardown that just ensures clean exit
  // The SUPPRESS_DB_LOGGING flag already handles the main issue
  console.log('Jest teardown completed');
}
