import { 
  Question, 
  QuestionSet, 
  QuestionSetPermission, 
  QuestionSetVersion, 
  Answer 
} from '../../types/question.js';
 
// In the current model, text fields are simple strings
export const createText = (text: string): string => text;

export const createAnswer = (overrides: Partial<Answer> = {}): Answer => ({
  id: 1,
  question_id: 1,
  text: createText('Test Answer'),
  correct: true,
  created_at: new Date(),
  ...overrides,
});

export const createQuestion = (overrides: Partial<Question> = {}): Question => ({
  id: 1,
  question_set_id: 1,
  question_text: createText('Test Question'),
  answers: [createAnswer()],
  difficulty: 1,
  created_at: new Date(),
  ...overrides,
});

export const createQuestionSet = (overrides: Partial<QuestionSet> = {}): QuestionSet => ({
  id: 1,
  name: 'Test Question Set',
  description: 'Test Description',
  category: 'Test Category',
  difficulty: 'medium',
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

export const createQuestionSetPermission = (
  overrides: Partial<QuestionSetPermission> = {}
): QuestionSetPermission => ({
  id: 1,
  question_set_id: 1,
  user_id: 1,
  permission_type: 'read',
  granted_at: new Date(),
  granted_by: 2,
  ...overrides,
});

export const createQuestionSetVersion = (
  overrides: Partial<QuestionSetVersion> = {}
): QuestionSetVersion => ({
  id: 1,
  question_set_id: 1,
  version_number: 1,
  changes: {},
  created_at: new Date(),
  ...overrides,
});

export const createMockQueryResult = <T = any>(rows: T[] = []) => ({
  command: 'SELECT',
  rowCount: rows.length,
  oid: 0,
  fields: [],
  rows,
});

export const createMockBaseRepository = () => ({
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
});

export const createMockDatabaseService = () => ({
  query: jest.fn(),
  getClient: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn(),
  })),
  pool: {
    connect: jest.fn(),
    end: jest.fn(),
  },
});
