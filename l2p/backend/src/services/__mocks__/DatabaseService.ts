import { jest } from '@jest/globals';

// Manual mock for DatabaseService to support tests that import the class directly
export class DatabaseService {
  static getInstance = jest.fn(() => new Proxy({} as any, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = jest.fn();
      }
      return target[prop];
    }
  }));
}

// Also export a mocked singleton `db` to match the real module API
export const db = new Proxy({} as any, {
  get(target, prop: string) {
    if (!(prop in target)) {
      target[prop] = jest.fn();
    }
    return target[prop];
  }
});
