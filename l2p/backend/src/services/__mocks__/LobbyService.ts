import { jest } from '@jest/globals';

// Manual Jest mock for LobbyService class
const singletonStore: Record<string, any> = {};
const singletonProxy: any = new Proxy(singletonStore, {
  get(target, prop: string | symbol) {
    const key = String(prop);
    if (!(key in target)) {
      (target as any)[key] = jest.fn();
    }
    return (target as any)[key];
  }
});

const LobbyService = jest.fn().mockImplementation(() => singletonProxy);

export { LobbyService };
export default LobbyService;
