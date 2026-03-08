import { QuestionRepository, Question, QuestionSet, CreateQuestionSetData } from '../repositories/QuestionRepository.js';
import { CreateQuestionData, AnswerType, EstimationMetadata, OrderingMetadata, MatchingMetadata, FillInBlankMetadata, QuestionFilterOptions } from '../types/question.js';
import { TtlCache } from '../utils/cache.js';

export interface QuestionSelectionOptions {
  questionSetIds: number[];
  count: number;
  difficulty?: number;
  excludeIds?: number[];
}

export interface LocalizedQuestion {
  id: number;
  questionText: string;
  answers: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  explanation?: string | undefined;
  difficulty: number;
}

export interface QuestionSetWithStats extends QuestionSet {
  questionCount: number;
  averageDifficulty: number;
}

export class QuestionService {
  private questionRepository: QuestionRepository;

  // Caches
  private categoriesCache = new TtlCache<string, string[]>('qs:categories');
  private setStatsCache = new TtlCache<string, QuestionSetWithStats | null>('qs:set-stats');
  private allStatsCache = new TtlCache<string, QuestionSetWithStats[]>('qs:all-stats');
  private globalStatsCache = new TtlCache<string, { totalSets: number; activeSets: number; totalQuestions: number; averageQuestionsPerSet: number; categories: string[] }>('qs:global-stats');

  constructor() {
    this.questionRepository = new QuestionRepository();
  }

  async getQuestionSetById(id: number): Promise<QuestionSet | null> {
    return this.questionRepository.findQuestionSetById(id);
  }

  async getAllQuestionSets(activeOnly: boolean = true): Promise<QuestionSet[]> {
    return this.questionRepository.findAllQuestionSets(activeOnly);
  }

  async getQuestionSetsPaginated(options: {
    page?: number;
    pageSize?: number;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortDir?: 'ASC' | 'DESC';
    activeOnly?: boolean;
    category?: string;
  }): Promise<{ items: QuestionSet[]; total: number; page: number; pageSize: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));

    const result = await this.questionRepository.findQuestionSetsPaginated(options);

    return { items: result.items, total: result.total, page, pageSize };
  }

  async getQuestionSetsByCategory(category: string): Promise<QuestionSet[]> {
    return this.questionRepository.findQuestionSetsByCategory(category);
  }

  async createQuestionSet(data: CreateQuestionSetData): Promise<QuestionSet> {
    const created = await this.questionRepository.createQuestionSet(data);
    this.invalidateQuestionSetCaches();
    return created;
  }

  async updateQuestionSet(id: number, data: Partial<CreateQuestionSetData>): Promise<QuestionSet | null> {
    const updated = await this.questionRepository.updateQuestionSet(id, data);
    this.invalidateQuestionSetCaches(id);
    return updated;
  }

  async deleteQuestionSet(id: number): Promise<boolean> {
    const ok = await this.questionRepository.deleteQuestionSet(id);
    this.invalidateQuestionSetCaches(id);
    return ok;
  }

  async getQuestionById(id: number): Promise<Question | null> {
    return this.questionRepository.findQuestionById(id);
  }

  async getQuestionsBySetId(questionSetId: number): Promise<Question[]> {
    return this.questionRepository.findQuestionsBySetId(questionSetId);
  }

  async getQuestionsBySetIdPaginated(questionSetId: number, options: {
    page?: number;
    pageSize?: number;
    sortBy?: 'id' | 'difficulty' | 'created_at';
    sortDir?: 'ASC' | 'DESC';
  }): Promise<{ items: Question[]; total: number; page: number; pageSize: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const { items, total } = await this.questionRepository.findQuestionsBySetIdPaginated(questionSetId, options);
    return { items, total, page, pageSize };
  }

  async createQuestion(data: CreateQuestionData): Promise<Question> {
    const created = await this.questionRepository.createQuestion(data as any);
    this.invalidateQuestionSetCaches();
    return created;
  }

  async updateQuestion(id: number, data: Partial<CreateQuestionData>): Promise<Question | null> {
    const updated = await this.questionRepository.updateQuestion(id, data as any);
    this.invalidateQuestionSetCaches();
    return updated;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const ok = await this.questionRepository.deleteQuestion(id);
    this.invalidateQuestionSetCaches();
    return ok;
  }

  async getRandomQuestions(options: QuestionSelectionOptions): Promise<Question[]> {
    return this.questionRepository.getRandomQuestions(options.questionSetIds, options.count);
  }

  async getQuestionsByDifficulty(questionSetId: number, difficulty: number): Promise<Question[]> {
    return this.questionRepository.getQuestionsByDifficulty(questionSetId, difficulty);
  }

  async getQuestionCount(questionSetId?: number): Promise<number> {
    return this.questionRepository.getQuestionCount(questionSetId);
  }

  async getQuestionSetCount(activeOnly: boolean = true): Promise<number> {
    return this.questionRepository.getQuestionSetCount(activeOnly);
  }

  async searchQuestions(searchTerm: string, questionSetId?: number): Promise<Question[]> {
    return this.questionRepository.searchQuestions(searchTerm, questionSetId);
  }

  async searchQuestionsPaginated(searchTerm: string, options: {
    questionSetId?: number;
    page?: number;
    pageSize?: number;
    sortBy?: 'id' | 'difficulty' | 'created_at';
    sortDir?: 'ASC' | 'DESC';
  }): Promise<{ items: Question[]; total: number; page: number; pageSize: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const { items, total } = await this.questionRepository.searchQuestionsPaginated(searchTerm, options);
    return { items, total, page, pageSize };
  }

  async validateQuestionStructure(questionId: number): Promise<boolean> {
    return this.questionRepository.validateQuestionStructure(questionId);
  }

  // Question conversion methods (removed localization)
  convertToSimpleFormat(question: Question): LocalizedQuestion {
    // Extract string from localized text objects if needed, otherwise use as-is
    const getTextValue = (text: any): string => {
      if (typeof text === 'string') return text;
      if (typeof text === 'object' && text !== null) {
        return text.en || text.de || text.text || String(text);
      }
      return String(text || '');
    };

    return {
      id: question.id,
      questionText: getTextValue(question.question_text),
      answers: question.answers.map((answer: any, index: number) => ({
        id: answer.id || String.fromCharCode(65 + index), // A, B, C, D, etc.
        text: getTextValue(answer.text),
        isCorrect: answer.is_correct || answer.correct || false
      })),
      explanation: question.explanation ? getTextValue(question.explanation) : undefined,
      difficulty: question.difficulty
    };
  }

  async convertQuestionsToSimpleFormat(questions: Question[]): Promise<LocalizedQuestion[]> {
    return questions.map((question: Question) => this.convertToSimpleFormat(question));
  }

  // Legacy method names for backward compatibility
  getLocalizedQuestion(question: Question, _language?: string): LocalizedQuestion {
    return this.convertToSimpleFormat(question);
  }

  async getLocalizedQuestions(questions: Question[], _language?: string): Promise<LocalizedQuestion[]> {
    return this.convertQuestionsToSimpleFormat(questions);
  }

  // Question set statistics
  async getQuestionSetWithStats(id: number): Promise<QuestionSetWithStats | null> {
    return this.setStatsCache.getOrRefresh(
      String(id),
      { ttlMs: 60_000, staleWhileRevalidateMs: 120_000 },
      async () => {
        const questionSet = await this.getQuestionSetById(id);
        if (!questionSet) return null;
        const questions = await this.getQuestionsBySetId(id);
        const questionCount = questions.length;
        const averageDifficulty = questions.length > 0 ?
          questions.reduce((sum, q) => sum + q.difficulty, 0) / questions.length : 0;
        return {
          ...questionSet,
          questionCount,
          averageDifficulty: Math.round(averageDifficulty * 10) / 10
        } as QuestionSetWithStats;
      }
    );
  }

  async getAllQuestionSetsWithStats(activeOnly: boolean = true): Promise<QuestionSetWithStats[]> {
    return this.allStatsCache.getOrRefresh(
      `active:${activeOnly ? '1' : '0'}`,
      { ttlMs: 60_000, staleWhileRevalidateMs: 120_000 },
      async () => {
        const questionSets = await this.getAllQuestionSets(activeOnly);
        const questionSetsWithStats: QuestionSetWithStats[] = [];
        for (const questionSet of questionSets) {
          const stats = await this.getQuestionSetWithStats(questionSet.id);
          if (stats) {
            questionSetsWithStats.push(stats);
          }
        }
        return questionSetsWithStats;
      }
    );
  }

  // Validation methods
  validateQuestionData(data: CreateQuestionData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate question text
    if (!data.question_text || typeof data.question_text !== 'string') {
      errors.push('Question text must be provided in German');
    }

    // Validate answer_type if provided
    const validAnswerTypes: AnswerType[] = [
      'multiple_choice', 'free_text', 'true_false',
      'estimation', 'ordering', 'matching', 'fill_in_blank'
    ];
    const answerType: AnswerType = data.answer_type || 'multiple_choice';
    if (!validAnswerTypes.includes(answerType)) {
      errors.push(`answer_type must be one of: ${validAnswerTypes.join(', ')}`);
    }

    // Per-type validation
    switch (answerType) {
      case 'true_false':
        if (!data.answers || data.answers.length !== 2) {
          errors.push('True/false questions must have exactly 2 answers');
        } else {
          const hasCorrectAnswer = data.answers.some(answer => answer.correct);
          if (!hasCorrectAnswer) {
            errors.push('At least one answer must be marked as correct');
          }
          for (let i = 0; i < data.answers.length; i++) {
            const answer = data.answers[i];
            if (!answer?.text || typeof answer.text !== 'string') {
              errors.push(`Answer ${i + 1} must have text`);
            }
          }
        }
        break;

      case 'estimation':
        {
          const meta = data.answer_metadata as EstimationMetadata | undefined;
          if (!meta) {
            errors.push('Estimation questions require answer_metadata');
          } else {
            if (typeof meta.correct_value !== 'number' || isNaN(meta.correct_value)) {
              errors.push('answer_metadata.correct_value must be a number');
            }
            if (typeof meta.tolerance !== 'number' || isNaN(meta.tolerance) || meta.tolerance <= 0) {
              errors.push('answer_metadata.tolerance must be a positive number');
            }
            if (meta.tolerance_type && meta.tolerance_type !== 'absolute' && meta.tolerance_type !== 'percentage') {
              errors.push('answer_metadata.tolerance_type must be "absolute" or "percentage"');
            }
          }
        }
        break;

      case 'ordering':
        {
          const meta = data.answer_metadata as OrderingMetadata | undefined;
          if (!meta) {
            errors.push('Ordering questions require answer_metadata');
          } else {
            if (!Array.isArray(meta.items) || meta.items.length < 2) {
              errors.push('answer_metadata.items must be an array with at least 2 items');
            }
            if (!Array.isArray(meta.correct_order) || meta.correct_order.length < 2) {
              errors.push('answer_metadata.correct_order must be an array with at least 2 entries');
            }
            if (Array.isArray(meta.items) && Array.isArray(meta.correct_order) &&
                meta.items.length !== meta.correct_order.length) {
              errors.push('answer_metadata.items and answer_metadata.correct_order must have the same length');
            }
          }
        }
        break;

      case 'matching':
        {
          const meta = data.answer_metadata as MatchingMetadata | undefined;
          if (!meta) {
            errors.push('Matching questions require answer_metadata');
          } else {
            if (!Array.isArray(meta.pairs) || meta.pairs.length < 2) {
              errors.push('answer_metadata.pairs must be an array with at least 2 pairs');
            } else {
              for (let i = 0; i < meta.pairs.length; i++) {
                const pair = meta.pairs[i];
                if (!pair || typeof pair.left !== 'string' || typeof pair.right !== 'string') {
                  errors.push(`answer_metadata.pairs[${i}] must have "left" and "right" string properties`);
                }
              }
            }
          }
        }
        break;

      case 'fill_in_blank':
        {
          const meta = data.answer_metadata as FillInBlankMetadata | undefined;
          if (!meta) {
            errors.push('Fill-in-the-blank questions require answer_metadata');
          } else {
            if (!meta.template || typeof meta.template !== 'string' || !meta.template.includes('___')) {
              errors.push('answer_metadata.template must be a string containing "___" placeholder(s)');
            }
            if (!Array.isArray(meta.blanks) || meta.blanks.length < 1) {
              errors.push('answer_metadata.blanks must be an array with at least 1 entry');
            }
          }
          // fill_in_blank also needs at least 1 correct answer for the correctAnswer field
          if (!data.answers || data.answers.length < 1) {
            errors.push('Fill-in-the-blank questions must have at least 1 answer (the correct answer)');
          } else {
            const hasCorrectAnswer = data.answers.some(answer => answer.correct);
            if (!hasCorrectAnswer) {
              errors.push('At least one answer must be marked as correct');
            }
            for (let i = 0; i < data.answers.length; i++) {
              const answer = data.answers[i];
              if (!answer?.text || typeof answer.text !== 'string') {
                errors.push(`Answer ${i + 1} must have text`);
              }
            }
          }
        }
        break;

      case 'free_text':
        if (!data.answers || data.answers.length < 1) {
          errors.push('Free-text questions must have at least 1 answer (the correct answer)');
        } else {
          const hasCorrectAnswer = data.answers.some(answer => answer.correct);
          if (!hasCorrectAnswer) {
            errors.push('At least one answer must be marked as correct');
          }
          for (let i = 0; i < data.answers.length; i++) {
            const answer = data.answers[i];
            if (!answer?.text || typeof answer.text !== 'string') {
              errors.push(`Answer ${i + 1} must have text`);
            }
          }
        }
        break;

      case 'multiple_choice':
      default:
        if (!data.answers || data.answers.length < 2) {
          errors.push('At least 2 answers must be provided');
        } else {
          const hasCorrectAnswer = data.answers.some(answer => answer.correct);
          if (!hasCorrectAnswer) {
            errors.push('At least one answer must be marked as correct');
          }
          // Validate answer text
          for (let i = 0; i < data.answers.length; i++) {
            const answer = data.answers[i];
            if (!answer?.text || typeof answer.text !== 'string') {
              errors.push(`Answer ${i + 1} must have text in German`);
            }
          }
        }
        break;
    }

    // Validate difficulty
    if (data.difficulty && (data.difficulty < 1 || data.difficulty > 5)) {
      errors.push('Difficulty must be between 1 and 5');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateQuestionSetData(data: CreateQuestionSetData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Question set name is required');
    }

    if (data.name && data.name.length > 100) {
      errors.push('Question set name must be 100 characters or less');
    }

    if (data.difficulty && !['easy', 'medium', 'hard'].includes(data.difficulty)) {
      errors.push('Difficulty must be one of: easy, medium, hard');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // New M:N methods

  async getAllQuestionsPaginated(options: QuestionFilterOptions): Promise<{ items: Question[]; total: number; page: number; pageSize: number; }> {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 20));
    const { items, total } = await this.questionRepository.findAllQuestionsPaginated(options);
    return { items, total, page, pageSize };
  }

  async addQuestionsToSet(setId: number, questionIds: number[]): Promise<void> {
    const set = await this.questionRepository.findQuestionSetById(setId);
    if (!set) throw new Error('Question set not found');
    await this.questionRepository.addQuestionsToSet(setId, questionIds);
    this.invalidateQuestionSetCaches(setId);
  }

  async removeQuestionsFromSet(setId: number, questionIds: number[]): Promise<void> {
    await this.questionRepository.removeQuestionsFromSet(setId, questionIds);
    this.invalidateQuestionSetCaches(setId);
  }

  async createSetWithQuestions(setData: CreateQuestionSetData, questionDataList: CreateQuestionData[]): Promise<{ questionSet: QuestionSet; questions: Question[] }> {
    const questionSet = await this.questionRepository.createQuestionSet(setData);
    const createdQuestions: Question[] = [];

    for (const qData of questionDataList) {
      const question = await this.questionRepository.createQuestion(qData as any);
      createdQuestions.push(question);
    }

    if (createdQuestions.length > 0) {
      await this.questionRepository.addQuestionsToSet(
        questionSet.id,
        createdQuestions.map(q => q.id)
      );
    }

    this.invalidateQuestionSetCaches();
    return { questionSet, questions: createdQuestions };
  }

  async getQuestionSetIdsForQuestion(questionId: number): Promise<number[]> {
    return this.questionRepository.getQuestionSetIdsForQuestion(questionId);
  }

  async getDistinctQuestionCategories(): Promise<string[]> {
    return this.questionRepository.getDistinctQuestionCategories();
  }

  async bulkUpdateQuestions(
    questionIds: number[],
    updates: { category_id?: number; difficulty?: number; answer_type?: string }
  ): Promise<number> {
    if (updates.difficulty !== undefined && (updates.difficulty < 1 || updates.difficulty > 5)) {
      throw new Error('Difficulty must be between 1 and 5');
    }
    const validTypes = ['multiple_choice', 'free_text', 'true_false', 'estimation', 'ordering', 'matching', 'fill_in_blank'];
    if (updates.answer_type !== undefined && !validTypes.includes(updates.answer_type)) {
      throw new Error(`answer_type must be one of: ${validTypes.join(', ')}`);
    }
    const count = await this.questionRepository.bulkUpdateQuestions(questionIds, updates);
    this.invalidateQuestionSetCaches();
    return count;
  }

  // Utility methods
  async getAvailableCategories(): Promise<string[]> {
    return this.categoriesCache.getOrRefresh(
      'categories',
      { ttlMs: 300_000, staleWhileRevalidateMs: 300_000 },
      async () => {
        // Combine categories from both question sets and individual questions
        const questionSets = await this.getAllQuestionSets(true);
        const questionCategories = await this.getDistinctQuestionCategories();
        const categories = new Set<string>();

        questionSets.forEach(qs => {
          if (qs.category) {
            categories.add(qs.category);
          }
        });
        questionCategories.forEach(c => categories.add(c));

        return Array.from(categories).sort();
      }
    );
  }

  async getQuestionSetStats(): Promise<{
    totalSets: number;
    activeSets: number;
    totalQuestions: number;
    averageQuestionsPerSet: number;
    categories: string[];
  }> {
    return this.globalStatsCache.getOrRefresh(
      'global-stats',
      { ttlMs: 60_000, staleWhileRevalidateMs: 120_000 },
      async () => {
        const totalSets = await this.getQuestionSetCount(false);
        const activeSets = await this.getQuestionSetCount(true);
        const totalQuestions = await this.getQuestionCount();
        const categories = await this.getAvailableCategories();
        return {
          totalSets,
          activeSets,
          totalQuestions,
          averageQuestionsPerSet: totalSets > 0 ? Math.round((totalQuestions / totalSets) * 10) / 10 : 0,
          categories
        };
      }
    );
  }

  private invalidateQuestionSetCaches(questionSetId?: number) {
    // Broad invalidation for simplicity
    this.categoriesCache.clear();
    this.allStatsCache.clear();
    this.globalStatsCache.clear();
    if (typeof questionSetId === 'number') {
      this.setStatsCache.invalidate(String(questionSetId));
    } else {
      this.setStatsCache.clear();
    }
  }
}
