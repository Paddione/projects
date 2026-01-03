/**
 * Test Data Seeder
 * Provides utilities for seeding test database with consistent test data
 */

import { DatabaseService } from '../../services/DatabaseService';
import { AuthService } from '../../services/AuthService';

export interface TestUser {
  id?: number;
  username: string;
  email: string;
  password: string;
  selectedCharacter?: string;
  characterLevel?: number;
  experiencePoints?: number;
  isAdmin?: boolean;
  emailVerified?: boolean;
}

export interface TestQuestionSet {
  id?: number;
  title: string;
  description?: string;
  difficulty?: string;
  isPublic?: boolean;
}

export interface TestQuestion {
  id?: number;
  questionText: string;
  answer: string;
  difficulty?: string;
  category?: string;
  questionSetId?: number;
}

export class TestDataSeeder {
  private db: DatabaseService;
  private authService: AuthService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.authService = new AuthService();
  }

  /**
   * Clean all test data from database
   */
  async cleanAll(): Promise<void> {
    // Delete in correct order to respect foreign key constraints
    await this.db.query('DELETE FROM game_sessions');
    await this.db.query('DELETE FROM lobby_participants');
    await this.db.query('DELETE FROM lobbies');
    await this.db.query('DELETE FROM user_perks');
    await this.db.query('DELETE FROM perks');
    await this.db.query('DELETE FROM user_experience');
    await this.db.query('DELETE FROM questions');
    await this.db.query('DELETE FROM question_sets');
    await this.db.query('DELETE FROM users WHERE username NOT LIKE \'%_seed%\'');
  }

  /**
   * Clean specific tables
   */
  async cleanTables(tables: string[]): Promise<void> {
    for (const table of tables) {
      await this.db.query(`DELETE FROM ${table}`);
    }
  }

  /**
   * Create a test user
   */
  async createUser(userData: Partial<TestUser>): Promise<TestUser> {
    const defaultUser: TestUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'TestPass123!',
      selectedCharacter: 'student',
      characterLevel: 1,
      experiencePoints: 0,
      isAdmin: false,
      emailVerified: false,
      ...userData
    };

    // Hash the password
    const hashedPassword = await this.authService.hashPassword(defaultUser.password);

    const result = await this.db.query(
      `INSERT INTO users (
        username, email, password_hash, selected_character,
        character_level, experience_points, is_admin, email_verified,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [
        defaultUser.username,
        defaultUser.email,
        hashedPassword,
        defaultUser.selectedCharacter,
        defaultUser.characterLevel,
        defaultUser.experiencePoints,
        defaultUser.isAdmin,
        defaultUser.emailVerified
      ]
    );

    return {
      ...defaultUser,
      id: result.rows[0].id
    };
  }

  /**
   * Create multiple test users
   */
  async createUsers(count: number, baseData?: Partial<TestUser>): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createUser({
        ...baseData,
        username: `${baseData?.username || 'testuser'}_${Date.now()}_${i}`,
        email: `test_${Date.now()}_${i}@example.com`
      });
      users.push(user);
    }
    return users;
  }

  /**
   * Create a test question set
   */
  async createQuestionSet(data: Partial<TestQuestionSet>): Promise<TestQuestionSet> {
    const defaultSet: TestQuestionSet = {
      title: `Test Set ${Date.now()}`,
      description: 'Test question set',
      difficulty: 'medium',
      isPublic: true,
      ...data
    };

    const result = await this.db.query(
      `INSERT INTO question_sets (title, description, difficulty, is_public, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [defaultSet.title, defaultSet.description, defaultSet.difficulty, defaultSet.isPublic]
    );

    return {
      ...defaultSet,
      id: result.rows[0].id
    };
  }

  /**
   * Create a test question
   */
  async createQuestion(data: Partial<TestQuestion>): Promise<TestQuestion> {
    const defaultQuestion: TestQuestion = {
      questionText: `Test question ${Date.now()}?`,
      answer: 'Test answer',
      difficulty: 'medium',
      category: 'general',
      ...data
    };

    const result = await this.db.query(
      `INSERT INTO questions (question_text, answer, difficulty, category, question_set_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        defaultQuestion.questionText,
        defaultQuestion.answer,
        defaultQuestion.difficulty,
        defaultQuestion.category,
        defaultQuestion.questionSetId || null
      ]
    );

    return {
      ...defaultQuestion,
      id: result.rows[0].id
    };
  }

  /**
   * Create multiple test questions
   */
  async createQuestions(count: number, baseData?: Partial<TestQuestion>): Promise<TestQuestion[]> {
    const questions: TestQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const question = await this.createQuestion({
        ...baseData,
        questionText: `${baseData?.questionText || 'Test question'} ${i + 1}?`
      });
      questions.push(question);
    }
    return questions;
  }

  /**
   * Create a complete test scenario with user, question set, and questions
   */
  async createCompleteScenario(): Promise<{
    user: TestUser;
    questionSet: TestQuestionSet;
    questions: TestQuestion[];
  }> {
    const user = await this.createUser({});
    const questionSet = await this.createQuestionSet({});
    const questions = await this.createQuestions(5, { questionSetId: questionSet.id });

    return { user, questionSet, questions };
  }

  /**
   * Reset sequence counters (useful after cleanup)
   */
  async resetSequences(): Promise<void> {
    const tables = [
      'users',
      'question_sets',
      'questions',
      'lobbies',
      'lobby_participants',
      'game_sessions',
      'perks',
      'user_perks',
      'user_experience'
    ];

    for (const table of tables) {
      try {
        await this.db.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`
        );
      } catch (error) {
        // Ignore errors for tables without id sequence
        console.log(`Skipping sequence reset for ${table}`);
      }
    }
  }
}
