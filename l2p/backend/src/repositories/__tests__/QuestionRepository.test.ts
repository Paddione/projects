import { QuestionRepository } from '../QuestionRepository';
import { BaseRepository } from '../BaseRepository';
import { DatabaseService } from '../../services/DatabaseService';
import { 
  Question, 
  QuestionSet, 
  CreateQuestionData, 
  CreateQuestionSetData,
  CreateQuestionSetVersionData 
} from '../../types/Question';

// Mock the DatabaseService
jest.mock('../../services/DatabaseService');

// Mock data
export const mockQuestion: Question = {
  id: 1,
  question_set_id: 1,
  question_text: 'What is the capital of France?',
  question_type: 'multiple_choice',
  difficulty_level: 'easy',
  points: 10,
  time_limit: 30,
  explanation: 'Paris is the capital and largest city of France.',
  metadata: { category: 'geography' },
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z')
};

export const mockQuestionSet: QuestionSet = {
  id: 1,
  name: 'Geography Quiz',
  description: 'Test your geography knowledge',
  difficulty_level: 'easy',
  estimated_duration: 300,
  is_active: true,
  metadata: { subject: 'geography' },
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z')
};

export const mockCreateQuestionData: CreateQuestionData = {
  question_set_id: 1,
  question_text: 'What is the capital of France?',
  question_type: 'multiple_choice',
  difficulty_level: 'easy',
  points: 10,
  time_limit: 30,
  explanation: 'Paris is the capital and largest city of France.',
  metadata: { category: 'geography' }
};

export const mockCreateQuestionSetData: CreateQuestionSetData = {
  name: 'Geography Quiz',
  description: 'Test your geography knowledge',
  category: 'geography',
  difficulty: 'easy'
};

export const mockCreateQuestionSetVersionData: CreateQuestionSetVersionData = {
  question_set_id: 1,
  version_number: 1,
  changes: { description: 'Initial version' },
  created_by: 1
};

describe('QuestionRepository', () => {
  let questionRepository: QuestionRepository;
  let mockDb: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock database connection and query methods
    mockDb = {
      query: jest.fn()
    };

    // Mock DatabaseService.getInstance to return our mock database
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDb);

    // Mock BaseRepository methods to use mockDb.query
    jest.spyOn(BaseRepository.prototype as any, 'findById').mockImplementation(async (...args: any[]) => {
      const [table, id] = args;
      const result = await mockDb.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return result.rows[0] || null;
    });

    jest.spyOn(BaseRepository.prototype as any, 'create').mockImplementation(async (...args: any[]) => {
      const [table, data] = args;
      const columns = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(data);
      const result = await mockDb.query(
        `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      return result.rows[0] || null;
    });

    jest.spyOn(BaseRepository.prototype as any, 'update').mockImplementation(async (...args: any[]) => {
      const [table, id, data] = args;
      const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(data)];
      const result = await mockDb.query(
        `UPDATE ${table} SET ${setClause} WHERE id = $1 RETURNING *`,
        values
      );
      return result.rows[0] || null;
    });

    jest.spyOn(BaseRepository.prototype as any, 'delete').mockImplementation(async (...args: any[]) => {
      const [table, id] = args;
      const result = await mockDb.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
      return result.rows[0] || null;
    });

    jest.spyOn(BaseRepository.prototype as any, 'findAll').mockImplementation(async (...args: any[]) => {
      const [table] = args;
      const result = await mockDb.query(`SELECT * FROM ${table}`);
      return result.rows || [];
    });

    jest.spyOn(BaseRepository.prototype as any, 'exists').mockImplementation(async (...args: any[]) => {
      const [table, condition, params] = args;
      const result = await mockDb.query(`SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${condition})`, params);
      return result.rows[0]?.exists || false;
    });

    jest.spyOn(BaseRepository.prototype as any, 'count').mockImplementation(async (...args: any[]) => {
      const [table, condition, params] = args;
      const whereClause = condition ? `WHERE ${condition}` : '';
      const result = await mockDb.query(`SELECT COUNT(*) FROM ${table} ${whereClause}`, params || []);
      return parseInt(result.rows[0]?.count || '0');
    });

    // Create fresh instance for each test
    questionRepository = new QuestionRepository();
  });

  afterEach(() => {
    // Clean up the global mock after each test
    delete (globalThis as any).__DB_SERVICE__;
    // Reset the DatabaseService mock
    (DatabaseService.getInstance as jest.Mock).mockReset();
  });

  describe('Question Set Methods', () => {
    describe('findQuestionSetById', () => {
      it('should return a question set when found', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestionSet] });

        const result = await questionRepository.findQuestionSetById(1);

        expect(result).toEqual(mockQuestionSet);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM question_sets WHERE id = $1'),
          [1]
        );
      });

      it('should return null when question set not found', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await questionRepository.findQuestionSetById(999);

        expect(result).toBeNull();
      });
    });

    describe('createQuestionSet', () => {
      it('should create question set successfully', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestionSet] });

        const result = await questionRepository.createQuestionSet(mockCreateQuestionSetData);

        expect(result).toEqual(mockQuestionSet);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO question_sets'),
          expect.arrayContaining([
            'Geography Quiz',
            'Test your geography knowledge',
            'geography',
            'easy',
            true
          ])
        );
      });
    });

    describe('updateQuestionSet', () => {
      it('should update question set successfully', async () => {
        const updateData = { name: 'Updated Geography Quiz' };
        mockDb.query.mockResolvedValue({ rows: [{ ...mockQuestionSet, ...updateData }] });

        const result = await questionRepository.updateQuestionSet(1, updateData);

        expect(result).toEqual({ ...mockQuestionSet, ...updateData });
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE question_sets'),
          expect.arrayContaining([1, 'Updated Geography Quiz'])
        );
      });

      it('should return null when question set not found', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await questionRepository.updateQuestionSet(999, { name: 'Test' });

        expect(result).toBeNull();
      });
    });

    describe('deleteQuestionSet', () => {
      it('should delete question set successfully', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestionSet] });

        const result = await questionRepository.deleteQuestionSet(1);

        expect(result).toEqual(mockQuestionSet);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM question_sets WHERE id = $1'),
          [1]
        );
      });
    });
  });

  describe('Question Methods', () => {
    describe('findQuestionById', () => {
      it('should return a question when found', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestion] });

        const result = await questionRepository.findQuestionById(1);

        expect(result).toEqual(mockQuestion);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM questions WHERE id = $1'),
          [1]
        );
      });
    });

    describe('createQuestion', () => {
      it('should create question successfully', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestion] });

        const result = await questionRepository.createQuestion(mockCreateQuestionData);

        expect(result).toEqual(mockQuestion);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO questions'),
          expect.arrayContaining([
            1,
            'What is the capital of France?',
            'multiple_choice',
            'easy',
            10,
            30,
            'Paris is the capital and largest city of France.',
            { category: 'geography' }
          ])
        );
      });
    });

    describe('findQuestionsBySetId', () => {
      it('should return questions for a question set', async () => {
        mockDb.query.mockResolvedValue({ rows: [mockQuestion] });

        const result = await questionRepository.findQuestionsBySetId(1);

        expect(result).toEqual([mockQuestion]);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM questions WHERE question_set_id = $1'),
          [1]
        );
      });
    });

    describe('getQuestionCount', () => {
      it('should return question count for a question set', async () => {
        mockDb.query.mockResolvedValue({ rows: [{ count: '5' }] });

        const result = await questionRepository.getQuestionCount(1);

        expect(result).toBe(5);
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT COUNT(*) FROM questions WHERE question_set_id = $1'),
          [1]
        );
      });
    });
  });
});
