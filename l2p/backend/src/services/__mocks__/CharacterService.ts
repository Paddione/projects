import { jest } from '@jest/globals';

export class CharacterService {
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
