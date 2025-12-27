// Simple test to verify Jest is working
describe('Basic Test Setup', () => {
  it('should run a basic test', () => {
    expect(true).toBe(true);
  });

  it('should have Jest globals available', () => {
    expect(jest).toBeDefined();
    expect(expect).toBeDefined();
    expect(test).toBeDefined();
    expect(describe).toBeDefined();
    expect(beforeEach).toBeDefined();
    expect(afterEach).toBeDefined();
  });
});
