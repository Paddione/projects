import { BaseRepository } from './BaseRepository.js';
import { buildOrderBy } from '../utils/pagination.js';

export interface Answer {
  text: string;
  correct: boolean;
}

export interface Question {
  id: number;
  question_set_id: number;
  question_text: string;
  answers: Answer[];
  explanation?: string;
  difficulty: number;
  created_at: Date;
}

export interface QuestionSet {
  id: number;
  name: string;
  description?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateQuestionData {
  question_set_id: number;
  question_text: string;
  answers: Answer[];
  explanation?: string;
  difficulty?: number;
}

export interface CreateQuestionSetData {
  name: string;
  description?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  is_active?: boolean;
}

export class QuestionRepository extends BaseRepository {
  private readonly questionsTable = 'questions';
  private readonly questionSetsTable = 'question_sets';
  // Note: BaseRepository is jest-mocked in tests to return an object with mocked methods.
  // To ensure mocks are captured, delegate to instance methods on `this` instead of `super.*`.

  // Pagination and sorting helpers
  private sanitizeSort(column: string, allowed: string[], defaultCol: string): string {
    return allowed.includes(column) ? column : defaultCol;
  }
  private sanitizeDir(dir: string | undefined): 'ASC' | 'DESC' {
    return (dir && dir.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
  }

  // Question Set Methods
  async findQuestionSetById(id: number): Promise<QuestionSet | null> {
    return this.findById<QuestionSet>(this.questionSetsTable, id);
  }

  async findAllQuestionSets(activeOnly: boolean = true): Promise<QuestionSet[]> {
    let query = 'SELECT * FROM question_sets WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (activeOnly) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(true);
      paramIndex++;
    }

    query += ' ORDER BY name';

    const result = await this.getDb().query<QuestionSet>(query, params);
    return result.rows;
  }

  async findQuestionSetsPaginated(options: {
    page?: number;
    pageSize?: number;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortDir?: 'ASC' | 'DESC';
    activeOnly?: boolean;
    category?: string;
  }): Promise<{ items: QuestionSet[]; total: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const sortBy = this.sanitizeSort(options.sortBy || 'name', ['name', 'created_at', 'updated_at'], 'name');
    const sortDir = this.sanitizeDir(options.sortDir);

    const filters: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.activeOnly !== false) { // default true
      filters.push(`is_active = $${idx++}`);
      params.push(true);
    }
    if (options.category) {
      filters.push(`category = $${idx++}`);
      params.push(options.category);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const total = await this.count(this.questionSetsTable, filters.join(' AND ') || undefined, params);

    const query = `SELECT * FROM ${this.questionSetsTable}
       ${where}
       ORDER BY ${sortBy} ${sortDir}, id ASC
       LIMIT $${idx} OFFSET $${idx + 1}`;

    const result = await this.getDb().query<QuestionSet>(query, [...params, pageSize, (page - 1) * pageSize]);

    return { items: result.rows, total };
  }

  async createQuestionSet(data: CreateQuestionSetData): Promise<QuestionSet> {
    const questionSetData = {
      name: data.name,
      description: data.description,
      category: data.category,
      difficulty: data.difficulty || 'medium',
      is_active: data.is_active !== undefined ? data.is_active : true
    };

    return this.create<QuestionSet>(this.questionSetsTable, questionSetData);
  }

  async updateQuestionSet(id: number, data: Partial<CreateQuestionSetData>): Promise<QuestionSet | null> {
    return this.update<QuestionSet>(this.questionSetsTable, id, data);
  }

  async deleteQuestionSet(id: number): Promise<boolean> {
    return this.delete(this.questionSetsTable, id);
  }

  async findQuestionSetsByCategory(category: string): Promise<QuestionSet[]> {
    const result = await this.getDb().query<QuestionSet>(
      'SELECT * FROM question_sets WHERE category = $1 AND is_active = true ORDER BY name',
      [category]
    );
    return result.rows;
  }

  // Question Methods
  async findQuestionById(id: number): Promise<Question | null> {
    return this.findById<Question>(this.questionsTable, id);
  }

  async findQuestionsBySetId(questionSetId: number): Promise<Question[]> {
    const result = await this.getDb().query<Question>(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY id',
      [questionSetId]
    );
    return result.rows;
  }

  async findQuestionsBySetIdPaginated(
    questionSetId: number,
    options: {
      page?: number;
      pageSize?: number;
      sortBy?: 'id' | 'difficulty' | 'created_at';
      sortDir?: 'ASC' | 'DESC';
    }
  ): Promise<{ items: Question[]; total: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const sortBy = this.sanitizeSort(options.sortBy || 'id', ['id', 'difficulty', 'created_at'], 'id');
    const sortDir = this.sanitizeDir(options.sortDir);

    const total = await this.count(this.questionsTable, 'question_set_id = $1', [questionSetId]);
    const orderBy = buildOrderBy(sortBy, sortDir, 'id');
    const result = await this.getDb().query<Question>(
      `SELECT * FROM ${this.questionsTable}
       WHERE question_set_id = $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [questionSetId, pageSize, (page - 1) * pageSize]
    );
    return { items: result.rows, total };
  }

  async createQuestion(data: CreateQuestionData): Promise<Question> {
    const questionData = {
      ...data,
      difficulty: data.difficulty || 1
    };

    return this.create<Question>(this.questionsTable, questionData);
  }

  async updateQuestion(id: number, data: Partial<CreateQuestionData>): Promise<Question | null> {
    return this.update<Question>(this.questionsTable, id, data);
  }

  async deleteQuestion(id: number): Promise<boolean> {
    return this.delete(this.questionsTable, id);
  }

  async getRandomQuestions(questionSetIds: number[], count: number): Promise<Question[]> {
    const placeholders = questionSetIds.map((_, index) => `$${index + 2}`).join(', ');

    const result = await this.getDb().query<Question>(
      `SELECT * FROM questions 
       WHERE question_set_id IN (${placeholders})
       AND question_text IS NOT NULL 
       AND question_text::text != ''
       AND question_text::text != '{}'
       AND question_text::text != '""'
       AND question_text::text != 'null'
       AND answers IS NOT NULL 
       AND answers::text != ''
       AND answers::text != '[]'
       AND answers::text != 'null'
       AND length(question_text::text) > 5
       AND (
         CASE 
           WHEN jsonb_typeof(answers) = 'array' THEN jsonb_array_length(answers) > 0
           ELSE false
         END
       )
       ORDER BY RANDOM() 
       LIMIT $1`,
      [count, ...questionSetIds]
    );
    return result.rows;
  }

  async getQuestionsByDifficulty(questionSetId: number, difficulty: number): Promise<Question[]> {
    const result = await this.getDb().query<Question>(
      'SELECT * FROM questions WHERE question_set_id = $1 AND difficulty = $2 ORDER BY id',
      [questionSetId, difficulty]
    );
    return result.rows;
  }

  async getQuestionCount(questionSetId?: number): Promise<number> {
    if (questionSetId) {
      return this.count(this.questionsTable, 'question_set_id = $1', [questionSetId]);
    }
    return this.count(this.questionsTable);
  }

  async getQuestionSetCount(activeOnly: boolean = true): Promise<number> {
    if (activeOnly) {
      return this.count(this.questionSetsTable, 'is_active = $1', [true]);
    }
    return this.count(this.questionSetsTable);
  }

  async searchQuestions(searchTerm: string, questionSetId?: number): Promise<Question[]> {
    let query = `
      SELECT * FROM questions 
      WHERE (question_text->>'en' ILIKE $1 OR question_text->>'de' ILIKE $1)
    `;
    const params: unknown[] = [`%${searchTerm}%`];

    if (questionSetId) {
      query += ' AND question_set_id = $2';
      params.push(questionSetId);
    }

    query += ' ORDER BY id LIMIT 50';

    const result = await this.getDb().query<Question>(query, params);
    return result.rows;
  }

  async searchQuestionsPaginated(
    searchTerm: string,
    options: {
      questionSetId?: number;
      page?: number;
      pageSize?: number;
      sortBy?: 'id' | 'difficulty' | 'created_at';
      sortDir?: 'ASC' | 'DESC';
    }
  ): Promise<{ items: Question[]; total: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const sortBy = this.sanitizeSort(options.sortBy || 'id', ['id', 'difficulty', 'created_at'], 'id');
    const sortDir = this.sanitizeDir(options.sortDir);

    const params: unknown[] = [`%${searchTerm}%`];
    let where = `(question_text->>'en' ILIKE $1 OR question_text->>'de' ILIKE $1)`;
    let idx = 2;
    if (options.questionSetId) {
      where += ` AND question_set_id = $${idx}`;
      params.push(options.questionSetId);
      idx++;
    }
    const total = await this.count(this.questionsTable, where, params);
    const orderBy = buildOrderBy(sortBy, sortDir, 'id');
    const result = await this.getDb().query<Question>(
      `SELECT * FROM ${this.questionsTable}
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    return { items: result.rows, total };
  }

  async getQuestionsWithAnswerCount(): Promise<Array<Question & { answer_count: number }>> {
    const result = await this.getDb().query<Question & { answer_count: number }>(
      `SELECT *, 
       jsonb_array_length(answers) as answer_count 
       FROM questions 
       ORDER BY question_set_id, id`
    );
    return result.rows;
  }

  async validateQuestionStructure(questionId: number): Promise<boolean> {
    const question = await this.findQuestionById(questionId);
    if (!question) return false;

    // Check if question has required text
    if (!question.question_text || question.question_text.trim() === '') {
      return false;
    }

    // Check if answers array exists and has at least 2 answers
    if (!question.answers || question.answers.length < 2) {
      return false;
    }

    // Check if at least one answer is correct
    const hasCorrectAnswer = question.answers.some(answer => answer.correct);
    if (!hasCorrectAnswer) {
      return false;
    }

    // Check if all answers have text
    const allAnswersHaveText = question.answers.every(answer =>
      answer.text && answer.text.trim() !== ''
    );
    if (!allAnswersHaveText) {
      return false;
    }

    return true;
  }


  async findAccessibleQuestionSets(): Promise<QuestionSet[]> {
    const result = await this.getDb().query<QuestionSet>(
      `SELECT * FROM question_sets WHERE is_active = true ORDER BY name`
    );
    return result.rows;
  }

  async searchQuestionSets(searchTerm: string): Promise<QuestionSet[]> {
    const query = `
      SELECT * FROM question_sets 
      WHERE (name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1)
        AND is_active = true 
      ORDER BY name 
      LIMIT 50
    `;
    const params = [`%${searchTerm}%`];

    const result = await this.getDb().query<QuestionSet>(query, params);
    return result.rows;
  }
}