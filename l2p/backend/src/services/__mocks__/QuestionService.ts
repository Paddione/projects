import { jest } from '@jest/globals';

const questionStore: Record<string, any> = {
  getRandomQuestions: jest.fn(),
};
const questionProxy: any = new Proxy(questionStore, {
  get(target, prop: string | symbol) {
    const key = String(prop);
    if (!(key in target)) {
      (target as any)[key] = jest.fn();
    }
    return (target as any)[key];
  }
});

const QuestionService = jest.fn().mockImplementation(() => questionProxy);

export { QuestionService };
export default QuestionService;
