import { jest } from 'vitest';

const questionStore: Record<string, any> = {
  getRandomQuestions: vi.fn(),
};
const questionProxy: any = new Proxy(questionStore, {
  get(target, prop: string | symbol) {
    const key = String(prop);
    if (!(key in target)) {
      (target as any)[key] = vi.fn();
    }
    return (target as any)[key];
  }
});

const QuestionService = vi.fn().mockImplementation(() => questionProxy);

export { QuestionService };
export default QuestionService;
