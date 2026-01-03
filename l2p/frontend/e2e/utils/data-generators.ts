/**
 * Test data generators for consistent and realistic test data creation
 */

export interface UserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  character?: string;
}

export interface LobbyData {
  name: string;
  questionCount: number;
  questionSet: string;
  maxPlayers: number;
  isPrivate: boolean;
  timeLimit: number;
}

export interface QuestionData {
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  explanation?: string;
}

export class TestDataGenerator {
  private static readonly FIRST_NAMES = [
    'Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Avery', 'Quinn',
    'Sage', 'River', 'Phoenix', 'Rowan', 'Skyler', 'Cameron', 'Dakota'
  ];

  private static readonly LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez'
  ];

  private static readonly DOMAINS = [
    'example.com', 'test.com', 'demo.org', 'sample.net', 'mock.io'
  ];

  private static readonly QUESTION_CATEGORIES = [
    'general', 'science', 'history', 'sports', 'entertainment', 'geography'
  ];

  private static readonly CHARACTERS = [
    'student', 'teacher', 'scientist', 'explorer', 'artist', 'athlete'
  ];

  /**
   * Generate a unique user with realistic data
   */
  static generateUser(overrides: Partial<UserData> = {}): UserData {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);

    const firstName = this.randomChoice(this.FIRST_NAMES);
    const lastName = this.randomChoice(this.LAST_NAMES);
    const domain = this.randomChoice(this.DOMAINS);

    const baseUser: UserData = {
      username: `${firstName.toLowerCase()}${randomId}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${timestamp}@${domain}`,
      password: this.generateSecurePassword(),
      firstName,
      lastName,
      role: 'user',
      character: this.randomChoice(this.CHARACTERS)
    };

    return { ...baseUser, ...overrides };
  }

  /**
   * Generate multiple users for testing scenarios
   */
  static generateUsers(count: number, overrides: Partial<UserData> = {}): UserData[] {
    return Array.from({ length: count }, () => this.generateUser(overrides));
  }

  /**
   * Generate lobby data with realistic settings
   */
  static generateLobby(overrides: Partial<LobbyData> = {}): LobbyData {
    const baseLobby: LobbyData = {
      name: `Test Lobby ${Date.now()}`,
      questionCount: this.randomChoice([5, 10, 15, 20]),
      questionSet: this.randomChoice(this.QUESTION_CATEGORIES),
      maxPlayers: this.randomChoice([2, 4, 6, 8]),
      isPrivate: Math.random() > 0.5,
      timeLimit: this.randomChoice([15, 30, 45, 60])
    };

    return { ...baseLobby, ...overrides };
  }

  /**
   * Generate question data for testing
   */
  static generateQuestion(overrides: Partial<QuestionData> = {}): QuestionData {
    const categories = this.QUESTION_CATEGORIES;
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

    const baseQuestion: QuestionData = {
      question: `What is the test question ${Date.now()}?`,
      options: [
        'Option A - Correct Answer',
        'Option B - Wrong Answer',
        'Option C - Wrong Answer',
        'Option D - Wrong Answer'
      ],
      correctAnswer: 0,
      category: this.randomChoice(categories),
      difficulty: this.randomChoice(difficulties),
      explanation: 'This is a test question explanation.'
    };

    return { ...baseQuestion, ...overrides };
  }

  /**
   * Generate multiple questions for a question set
   */
  static generateQuestionSet(count: number, category?: string): QuestionData[] {
    return Array.from({ length: count }, (_, index) =>
      this.generateQuestion({
        question: `Test question ${index + 1} for ${category || 'general'} category`,
        category: category || this.randomChoice(this.QUESTION_CATEGORIES)
      })
    );
  }

  /**
   * Generate a secure password for testing
   */
  static generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';

    const allChars = uppercase + lowercase + numbers + symbols;

    // Ensure at least one character from each category
    let password = '';
    password += this.randomChoice(uppercase.split(''));
    password += this.randomChoice(lowercase.split(''));
    password += this.randomChoice(numbers.split(''));
    password += this.randomChoice(symbols.split(''));

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += this.randomChoice(allChars.split(''));
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate a lobby code (6 characters, alphanumeric)
   */
  static generateLobbyCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 6 }, () => this.randomChoice(chars.split(''))).join('');
  }

  /**
   * Generate realistic email addresses
   */
  static generateEmail(username?: string): string {
    const name = username || `user${Date.now()}`;
    const domain = this.randomChoice(this.DOMAINS);
    return `${name}@${domain}`;
  }

  /**
   * Generate phone numbers for testing
   */
  static generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `(${areaCode}) ${exchange}-${number}`;
  }

  /**
   * Generate test file data
   */
  static generateFileData(type: 'pdf' | 'txt' | 'docx' = 'txt'): {
    name: string;
    content: string;
    size: number;
    type: string;
  } {
    const timestamp = Date.now();
    const content = `Test file content generated at ${new Date().toISOString()}`;

    return {
      name: `test-file-${timestamp}.${type}`,
      content,
      size: content.length,
      type: `application/${type}`
    };
  }

  /**
   * Generate performance test data
   */
  static generatePerformanceData(): {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
  } {
    return {
      responseTime: Math.floor(Math.random() * 1000) + 100, // 100-1100ms
      memoryUsage: Math.floor(Math.random() * 100) + 50,    // 50-150MB
      cpuUsage: Math.floor(Math.random() * 80) + 10,        // 10-90%
      networkLatency: Math.floor(Math.random() * 200) + 50  // 50-250ms
    };
  }

  /**
   * Generate error scenarios for testing
   */
  static generateErrorScenarios(): Array<{
    type: string;
    message: string;
    code: number;
  }> {
    return [
      { type: 'NetworkError', message: 'Network request failed', code: 500 },
      { type: 'ValidationError', message: 'Invalid input data', code: 400 },
      { type: 'AuthenticationError', message: 'Invalid credentials', code: 401 },
      { type: 'AuthorizationError', message: 'Access denied', code: 403 },
      { type: 'NotFoundError', message: 'Resource not found', code: 404 },
      { type: 'TimeoutError', message: 'Request timeout', code: 408 },
      { type: 'ServerError', message: 'Internal server error', code: 500 }
    ];
  }

  /**
   * Generate accessibility test data
   */
  static generateAccessibilityTestData(): {
    colorContrast: { foreground: string; background: string; ratio: number }[];
    ariaLabels: string[];
    headingStructure: Array<{ level: number; text: string }>;
    focusableElements: string[];
  } {
    return {
      colorContrast: [
        { foreground: '#000000', background: '#FFFFFF', ratio: 21 },
        { foreground: '#333333', background: '#F0F0F0', ratio: 12.6 },
        { foreground: '#0066CC', background: '#FFFFFF', ratio: 7.7 }
      ],
      ariaLabels: [
        'Main navigation',
        'Search form',
        'User menu',
        'Game controls',
        'Question options'
      ],
      headingStructure: [
        { level: 1, text: 'Main Page Title' },
        { level: 2, text: 'Section Heading' },
        { level: 3, text: 'Subsection Heading' }
      ],
      focusableElements: [
        'button',
        'input[type="text"]',
        'input[type="email"]',
        'input[type="password"]',
        'select',
        'textarea',
        'a[href]'
      ]
    };
  }

  /**
   * Utility method to randomly choose from an array
   */
  private static randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean with optional probability
   */
  static randomBoolean(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /**
   * Generate random date within a range
   */
  static randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  /**
   * Generate test data for specific scenarios
   */
  static generateScenarioData(scenario: string):
    | { players: ReturnType<typeof this.generateUsers>; lobby: ReturnType<typeof this.generateLobby>; questions: ReturnType<typeof this.generateQuestionSet> }
    | { users: ReturnType<typeof this.generateUsers>; concurrent_requests: number; duration_minutes: number; expected_response_time: number }
    | ReturnType<typeof this.generateAccessibilityTestData>
    | ReturnType<typeof this.generateErrorScenarios>
    | Record<string, never> {
    switch (scenario) {
      case 'multiplayer-game':
        return {
          players: this.generateUsers(4),
          lobby: this.generateLobby({ maxPlayers: 4, questionCount: 10 }),
          questions: this.generateQuestionSet(10)
        };

      case 'performance-test':
        return {
          users: this.generateUsers(100),
          concurrent_requests: 50,
          duration_minutes: 5,
          expected_response_time: 500
        };

      case 'accessibility-test':
        return this.generateAccessibilityTestData();

      case 'error-handling':
        return this.generateErrorScenarios();

      default:
        return {};
    }
  }
}