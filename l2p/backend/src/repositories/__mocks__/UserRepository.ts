import { jest } from '@jest/globals';

export class UserRepository {
  constructor() {
    return new Proxy(this as any, {
      get(target, prop: string) {
        if (!(prop in target)) {
          target[prop] = jest.fn();
        }
        return target[prop];
      }
    });
  }
}
