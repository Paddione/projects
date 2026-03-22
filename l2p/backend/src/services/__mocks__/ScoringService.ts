import { vi } from 'vitest';

const scoringStore: Record<string, any> = {
  calculateScore: vi.fn(),
};
const scoringProxy: any = new Proxy(scoringStore, {
  get(target, prop: string | symbol) {
    const key = String(prop);
    if (!(key in target)) {
      (target as any)[key] = vi.fn();
    }
    return (target as any)[key];
  }
});

const ScoringService = vi.fn().mockImplementation(() => scoringProxy);

export { ScoringService };
export default ScoringService;
