import { vi } from 'vitest';

export class GameSessionRepository {
  constructor() {
    return new Proxy(this as any, {
      get(target, prop: string) {
        if (!(prop in target)) {
          target[prop] = vi.fn();
        }
        return target[prop];
      }
    });
  }
}
