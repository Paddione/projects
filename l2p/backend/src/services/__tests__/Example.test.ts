import { describe, it, expect } from '@jest/globals';

describe('Example Service Test', () => {
  it('should perform a simple calculation', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  it('should handle string operations', () => {
    const text = 'Hello World';
    expect(text).toContain('Hello');
    expect(text.length).toBe(11);
  });
}); 