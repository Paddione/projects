import { jest } from '@jest/globals';

const scoringStore: Record<string, any> = {
  calculateScore: jest.fn(),
};
const scoringProxy: any = new Proxy(scoringStore, {
  get(target, prop: string | symbol) {
    const key = String(prop);
    if (!(key in target)) {
      (target as any)[key] = jest.fn();
    }
    return (target as any)[key];
  }
});

const ScoringService = jest.fn().mockImplementation(() => scoringProxy);

export { ScoringService };
export default ScoringService;
