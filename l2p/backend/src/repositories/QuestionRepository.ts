import { BaseRepository } from './BaseRepository.js';
import { buildOrderBy } from '../utils/pagination.js';
import { QuestionFilterOptions } from '../types/question.js';

export interface Answer {
  text: string;
  correct: boolean;
}

export interface Question {
  id: number;
  question_text: string;
  answers: Answer[];
  explanation?: string;
  difficulty: number;
  created_at: Date;
  category?: string;
  language?: string;
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
  question_text: string;
  answers: Answer[];
  explanation?: string;
  difficulty?: number;
  category?: string;
  language?: string;
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
  private readonly junctionTable = 'question_set_questions';
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
    // Junction table entries cascade-delete automatically
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
    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM questions q
       LEFT JOIN categories c ON q.category_id = c.id
       WHERE q.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findQuestionsBySetId(questionSetId: number): Promise<Question[]> {
    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM questions q
       LEFT JOIN categories c ON q.category_id = c.id
       INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
       WHERE qsq.question_set_id = $1
       ORDER BY qsq.position, q.id`,
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

    const countResult = await this.getDb().query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.junctionTable} WHERE question_set_id = $1`,
      [questionSetId]
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const orderBy = buildOrderBy(`q.${sortBy}`, sortDir, 'q.id');
    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM ${this.questionsTable} q
       LEFT JOIN categories c ON q.category_id = c.id
       INNER JOIN ${this.junctionTable} qsq ON q.id = qsq.question_id
       WHERE qsq.question_set_id = $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [questionSetId, pageSize, (page - 1) * pageSize]
    );
    return { items: result.rows, total };
  }

  async createQuestion(data: CreateQuestionData): Promise<Question> {
    const questionData: Record<string, unknown> = {
      question_text: data.question_text,
      answers: data.answers,
      explanation: data.explanation,
      difficulty: data.difficulty || 1,
    };
    if ((data as any).category_id !== undefined) questionData['category_id'] = (data as any).category_id;
    if (data.language !== undefined) questionData['language'] = data.language;

    return this.create<Question>(this.questionsTable, questionData);
  }

  async updateQuestion(id: number, data: Partial<CreateQuestionData>): Promise<Question | null> {
    return this.update<Question>(this.questionsTable, id, data);
  }

  async deleteQuestion(id: number): Promise<boolean> {
    // Junction table entries cascade-delete automatically
    return this.delete(this.questionsTable, id);
  }

  async getRandomQuestions(questionSetIds: number[], count: number): Promise<Question[]> {
    const placeholders = questionSetIds.map((_, index) => `$${index + 2}`).join(', ');

    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM questions q
       LEFT JOIN categories c ON q.category_id = c.id
       INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
       WHERE qsq.question_set_id IN (${placeholders})
       AND q.question_text IS NOT NULL
       AND q.question_text::text != ''
       AND q.question_text::text != '{}'
       AND q.question_text::text != '""'
       AND q.question_text::text != 'null'
       AND q.answers IS NOT NULL
       AND q.answers::text != ''
       AND q.answers::text != '[]'
       AND q.answers::text != 'null'
       AND length(q.question_text::text) > 5
       AND (
         CASE
           WHEN jsonb_typeof(q.answers) = 'array' THEN jsonb_array_length(q.answers) > 0
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
      `SELECT q.*, c.name AS category FROM questions q
       LEFT JOIN categories c ON q.category_id = c.id
       INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
       WHERE qsq.question_set_id = $1 AND q.difficulty = $2
       ORDER BY q.id`,
      [questionSetId, difficulty]
    );
    return result.rows;
  }

  async getQuestionCount(questionSetId?: number): Promise<number> {
    if (questionSetId) {
      const result = await this.getDb().query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${this.junctionTable} WHERE question_set_id = $1`,
        [questionSetId]
      );
      return parseInt(result.rows[0]?.count || '0', 10);
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
    let query: string;
    const params: unknown[] = [`%${searchTerm}%`];

    if (questionSetId) {
      query = `
        SELECT q.*, c.name AS category FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
        WHERE q.question_text ILIKE $1 AND qsq.question_set_id = $2
        ORDER BY q.id LIMIT 50
      `;
      params.push(questionSetId);
    } else {
      query = `
        SELECT q.*, c.name AS category FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
        WHERE q.question_text ILIKE $1
        ORDER BY q.id LIMIT 50
      `;
    }

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

    if (options.questionSetId) {
      const countResult = await this.getDb().query<{ count: string }>(
        `SELECT COUNT(*) as count FROM questions q
         INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
         WHERE q.question_text ILIKE $1 AND qsq.question_set_id = $2`,
        [`%${searchTerm}%`, options.questionSetId]
      );
      const total = parseInt(countResult.rows[0]?.count || '0', 10);

      const orderBy = buildOrderBy(`q.${sortBy}`, sortDir, 'q.id');
      const result = await this.getDb().query<Question>(
        `SELECT q.*, c.name AS category FROM questions q
         LEFT JOIN categories c ON q.category_id = c.id
         INNER JOIN question_set_questions qsq ON q.id = qsq.question_id
         WHERE q.question_text ILIKE $1 AND qsq.question_set_id = $2
         ORDER BY ${orderBy}
         LIMIT $3 OFFSET $4`,
        [`%${searchTerm}%`, options.questionSetId, pageSize, (page - 1) * pageSize]
      );
      return { items: result.rows, total };
    }

    // No set filter — search all questions
    const params: unknown[] = [`%${searchTerm}%`];
    const total = await this.count(this.questionsTable, 'question_text ILIKE $1', params);
    const orderBy = buildOrderBy(sortBy, sortDir, 'id');
    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM ${this.questionsTable} q
       LEFT JOIN categories c ON q.category_id = c.id
       WHERE q.question_text ILIKE $1
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, pageSize, (page - 1) * pageSize]
    );
    return { items: result.rows, total };
  }

  async getQuestionsWithAnswerCount(): Promise<Array<Question & { answer_count: number }>> {
    const result = await this.getDb().query<Question & { answer_count: number }>(
      `SELECT q.*, c.name AS category,
       jsonb_array_length(q.answers) as answer_count
       FROM questions q
       LEFT JOIN categories c ON q.category_id = c.id
       ORDER BY q.id`
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

  // --- New M:N junction table methods ---

  async findAllQuestionsPaginated(options: QuestionFilterOptions): Promise<{ items: Question[]; total: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const sortBy = this.sanitizeSort(
      options.sortBy || 'id',
      ['id', 'difficulty', 'created_at', 'category'],
      'id'
    );
    const sortDir = this.sanitizeDir(options.sortDir);

    const filters: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (options.category_id) {
      filters.push(`q.category_id = $${idx++}`);
      params.push(options.category_id);
    }
    if (options.difficulty) {
      filters.push(`q.difficulty = $${idx++}`);
      params.push(options.difficulty);
    }
    if (options.answer_type) {
      filters.push(`q.answer_type = $${idx++}`);
      params.push(options.answer_type);
    }
    if (options.search) {
      filters.push(`q.question_text ILIKE $${idx++}`);
      params.push(`%${options.search}%`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countResult = await this.getDb().query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.questionsTable} q ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const orderBy = buildOrderBy(sortBy, sortDir, 'id');
    const result = await this.getDb().query<Question>(
      `SELECT q.*, c.name AS category FROM ${this.questionsTable} q
       LEFT JOIN categories c ON q.category_id = c.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    return { items: result.rows, total };
  }

  async addQuestionsToSet(questionSetId: number, questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;

    // Get current max position
    const posResult = await this.getDb().query<{ max_pos: number | null }>(
      `SELECT MAX(position) as max_pos FROM ${this.junctionTable} WHERE question_set_id = $1`,
      [questionSetId]
    );
    let nextPos = (posResult.rows[0]?.max_pos ?? 0) + 1;

    const values: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const qId of questionIds) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
      params.push(questionSetId, qId, nextPos++);
      idx += 3;
    }

    await this.getDb().query(
      `INSERT INTO ${this.junctionTable} (question_set_id, question_id, position)
       VALUES ${values.join(', ')}
       ON CONFLICT (question_set_id, question_id) DO NOTHING`,
      params
    );
  }

  async removeQuestionsFromSet(questionSetId: number, questionIds: number[]): Promise<void> {
    if (questionIds.length === 0) return;

    const placeholders = questionIds.map((_, i) => `$${i + 2}`).join(', ');
    await this.getDb().query(
      `DELETE FROM ${this.junctionTable}
       WHERE question_set_id = $1 AND question_id IN (${placeholders})`,
      [questionSetId, ...questionIds]
    );
  }

  async getQuestionSetIdsForQuestion(questionId: number): Promise<number[]> {
    const result = await this.getDb().query<{ question_set_id: number }>(
      `SELECT question_set_id FROM ${this.junctionTable} WHERE question_id = $1 ORDER BY question_set_id`,
      [questionId]
    );
    return result.rows.map(r => r.question_set_id);
  }

  async getDistinctQuestionCategories(): Promise<string[]> {
    const result = await this.getDb().query<{ name: string }>(
      `SELECT name FROM categories ORDER BY name`
    );
    return result.rows.map(r => r.name);
  }

  async bulkUpdateQuestions(
    questionIds: number[],
    updates: { category_id?: number; difficulty?: number; answer_type?: string }
  ): Promise<number> {
    if (questionIds.length === 0) return 0;

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.category_id !== undefined) {
      setClauses.push(`category_id = $${idx++}`);
      params.push(updates.category_id);
    }
    if (updates.difficulty !== undefined) {
      setClauses.push(`difficulty = $${idx++}`);
      params.push(updates.difficulty);
    }
    if (updates.answer_type !== undefined) {
      setClauses.push(`answer_type = $${idx++}`);
      params.push(updates.answer_type);
    }

    if (setClauses.length === 0) return 0;

    const placeholders = questionIds.map((_, i) => `$${idx + i}`).join(', ');
    const result = await this.getDb().query(
      `UPDATE ${this.questionsTable} SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`,
      [...params, ...questionIds]
    );
    return result.rowCount ?? 0;
  }
}
