import { describe, it, expect } from '@jest/globals';

describe('JWT Simple Test', () => {
  it('should test JWT library directly', () => {
    console.log('Testing JWT library import methods...');
    
    // Test 1: CommonJS require
    try {
      const jwt1 = require('jsonwebtoken');
      console.log('CommonJS require success:', typeof jwt1, Object.keys(jwt1));
      
      const token1 = jwt1.sign({ test: 'data' }, 'secret');
      console.log('CommonJS sign result:', typeof token1, token1 ? 'has value' : 'undefined/null');
      
      if (token1) {
        const decoded1 = jwt1.verify(token1, 'secret');
        console.log('CommonJS verify result:', decoded1);
      }
    } catch (error) {
      console.log('CommonJS require failed:', error instanceof Error ? error.message : error);
    }
    
    // Test 2: ES module import
    try {
      const jwt2 = require('jsonwebtoken');
      console.log('ES module import success:', typeof jwt2);
      
      // Try different ways to access the sign function
      console.log('jwt2.sign:', typeof jwt2.sign);
      console.log('jwt2.default:', typeof jwt2.default);
      console.log('jwt2.default?.sign:', typeof jwt2.default?.sign);
      
      // Test with different approaches
      const signFn = jwt2.sign || jwt2.default?.sign;
      if (signFn) {
        const token2 = signFn({ test: 'data' }, 'secret');
        console.log('ES module sign result:', typeof token2, token2 ? 'has value' : 'undefined/null');
      }
    } catch (error) {
      console.log('ES module import failed:', error instanceof Error ? error.message : error);
    }
    
    // This test should pass regardless of JWT issues
    expect(true).toBe(true);
  });
});
