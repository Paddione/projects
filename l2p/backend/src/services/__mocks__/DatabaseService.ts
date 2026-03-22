import { jest } from 'vitest';

// Manual mock for DatabaseService to support tests that import the class directly
export class DatabaseService {
  static getInstance = vi.fn(() => new Proxy({} as any, {
    get(target, prop: string) {
      if (!(prop in target)) {
        target[prop] = vi.fn();
      }
      return target[prop];
    }
  }));
}

// Also export a mocked singleton `db` to match the real module API
export const db = new Proxy({} as any, {
  get(target, prop: string) {
    if (!(prop in target)) {
      target[prop] = vi.fn();
    }
    return target[prop];
  }
});
