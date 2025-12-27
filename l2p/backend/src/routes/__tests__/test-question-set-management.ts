import request from 'supertest';
import { app } from '../../server.js';
import { DatabaseService } from '../../services/DatabaseService.js';
import { QuestionService } from '../../services/QuestionService.js';
import { GeminiService } from '../../services/GeminiService.js';

describe('Question Set Management - Complete Integration', () => {
  let dbService: DatabaseService;
  let questionService: QuestionService;
  let geminiService: GeminiService;
  let authToken: string;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    
    questionService = new QuestionService();
    geminiService = new GeminiService();

    // Create a test user and get auth token
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123!',
      characterId: 1
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData)
      .expect(201);

    // Verify email using users table token
    const tokenResult = await dbService.query(
      'SELECT email_verification_token FROM users WHERE email = $1',
      [userData.email]
    );
    await request(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenResult.rows[0]!.email_verification_token })
      .expect(200);

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'TestPass123!' })
      .expect(200);

    authToken = loginResponse.body?.tokens?.accessToken;
  });

  afterAll(async () => {
    await dbService.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await dbService.query('DELETE FROM questions WHERE question_set_id IN (SELECT id FROM question_sets WHERE owner_id = (SELECT id FROM users WHERE username = $1))', ['testuser']);
    await dbService.query('DELETE FROM question_sets WHERE owner_id = (SELECT id FROM users WHERE username = $1)', ['testuser']);
  });

  describe('Question Set CRUD Operations', () => {
    it('should create a new question set', async () => {
      const questionSetData = {
        name: 'Test Question Set',
        description: 'A test question set for unit testing',
        category: 'Science',
        isPublic: false
      };

      const response = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', questionSetData.name);
      expect(response.body).toHaveProperty('description', questionSetData.description);
      expect(response.body).toHaveProperty('category', questionSetData.category);
      expect(response.body).toHaveProperty('isPublic', questionSetData.isPublic);
      expect(response.body).toHaveProperty('ownerId');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should reject question set creation without authentication', async () => {
      const questionSetData = {
        name: 'Test Question Set',
        description: 'A test question set',
        category: 'Science',
        isPublic: false
      };

      const response = await request(app)
        .post('/api/question-management/sets')
        .send(questionSetData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should reject question set creation with invalid data', async () => {
      const questionSetData = {
        name: '', // Invalid empty name
        description: 'A test question set',
        category: 'Science',
        isPublic: false
      };

      const response = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should get user question sets', async () => {
      // Create a question set first
      const questionSetData = {
        name: 'Test Question Set',
        description: 'A test question set',
        category: 'Science',
        isPublic: false
      };

      await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      // Get user's question sets
      const response = await request(app)
        .get('/api/question-management/sets/my')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('questionSets');
      expect(Array.isArray(response.body.questionSets)).toBe(true);
      expect(response.body.questionSets.length).toBeGreaterThan(0);
      expect(response.body.questionSets[0]).toHaveProperty('name', questionSetData.name);
    });

    it('should get public question sets', async () => {
      // Create a public question set
      const questionSetData = {
        name: 'Public Test Set',
        description: 'A public test question set',
        category: 'Science',
        isPublic: true
      };

      await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      // Get public question sets
      const response = await request(app)
        .get('/api/question-management/sets/public')
        .expect(200);

      expect(response.body).toHaveProperty('questionSets');
      expect(Array.isArray(response.body.questionSets)).toBe(true);
      expect(response.body.questionSets.length).toBeGreaterThan(0);
    });

    it('should update a question set', async () => {
      // Create a question set first
      const questionSetData = {
        name: 'Original Name',
        description: 'Original description',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      const questionSetId = createResponse.body.id;

      // Update the question set
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
        category: 'History',
        isPublic: true
      };

      const response = await request(app)
        .put(`/api/question-management/sets/${questionSetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
      expect(response.body).toHaveProperty('category', updateData.category);
      expect(response.body).toHaveProperty('isPublic', updateData.isPublic);
    });

    it('should reject updating question set owned by another user', async () => {
      // Create another user
      const otherUserData = {
        username: 'otheruser',
        email: 'other@example.com',
        password: 'TestPass123!',
        selectedCharacter: 'student'
      };

      await request(app)
        .post('/api/auth/register')
        .send(otherUserData)
        .expect(201);

      // Verify email for other user
      const tokenResult = await dbService.query(
        'SELECT email_verification_token FROM users WHERE email = $1',
        [otherUserData.email]
      );
      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: tokenResult.rows[0]!.email_verification_token })
        .expect(200);

      // Login as other user
      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'otheruser', password: 'TestPass123!' })
        .expect(200);

      const otherAuthToken = otherLoginResponse.body?.tokens?.accessToken;

      // Create question set as other user
      const questionSetData = {
        name: 'Other User Set',
        description: 'A question set owned by another user',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send(questionSetData)
        .expect(201);

      const questionSetId = createResponse.body.id;

      // Try to update as original user
      const updateData = {
        name: 'Unauthorized Update',
        description: 'This should fail',
        category: 'History',
        isPublic: true
      };

      const response = await request(app)
        .put(`/api/question-management/sets/${questionSetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should delete a question set', async () => {
      // Create a question set first
      const questionSetData = {
        name: 'To Delete',
        description: 'This will be deleted',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      const questionSetId = createResponse.body.id;

      // Delete the question set
      const response = await request(app)
        .delete(`/api/question-management/sets/${questionSetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Question set deleted successfully');

      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/question-management/sets/${questionSetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Question Management within Sets', () => {
    let questionSetId: string;

    beforeEach(async () => {
      // Create a question set for testing
      const questionSetData = {
        name: 'Test Question Set',
        description: 'A test question set',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      questionSetId = createResponse.body.id;
    });

    it('should add a question to a question set', async () => {
      const questionData = {
        question: 'What is the capital of France?',
        correctAnswer: 'Paris',
        incorrectAnswers: ['London', 'Berlin', 'Madrid'],
        explanation: 'Paris is the capital and largest city of France.',
        difficulty: 'easy',
        category: 'Geography'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('question', questionData.question);
      expect(response.body).toHaveProperty('correctAnswer', questionData.correctAnswer);
      expect(response.body).toHaveProperty('incorrectAnswers');
      expect(response.body).toHaveProperty('explanation', questionData.explanation);
      expect(response.body).toHaveProperty('difficulty', questionData.difficulty);
      expect(response.body).toHaveProperty('category', questionData.category);
    });

    it('should get questions from a question set', async () => {
      // Add a question first
      const questionData = {
        question: 'What is the capital of France?',
        correctAnswer: 'Paris',
        incorrectAnswers: ['London', 'Berlin', 'Madrid'],
        explanation: 'Paris is the capital and largest city of France.',
        difficulty: 'easy',
        category: 'Geography'
      };

      await request(app)
        .post(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      // Get questions from the set
      const response = await request(app)
        .get(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('questions');
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBeGreaterThan(0);
      expect(response.body.questions[0]).toHaveProperty('question', questionData.question);
    });

    it('should update a question in a question set', async () => {
      // Add a question first
      const questionData = {
        question: 'Original question?',
        correctAnswer: 'Original answer',
        incorrectAnswers: ['Wrong1', 'Wrong2', 'Wrong3'],
        explanation: 'Original explanation',
        difficulty: 'easy',
        category: 'Geography'
      };

      const createResponse = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.id;

      // Update the question
      const updateData = {
        question: 'Updated question?',
        correctAnswer: 'Updated answer',
        incorrectAnswers: ['NewWrong1', 'NewWrong2', 'NewWrong3'],
        explanation: 'Updated explanation',
        difficulty: 'medium',
        category: 'History'
      };

      const response = await request(app)
        .put(`/api/question-management/sets/${questionSetId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('question', updateData.question);
      expect(response.body).toHaveProperty('correctAnswer', updateData.correctAnswer);
      expect(response.body).toHaveProperty('explanation', updateData.explanation);
      expect(response.body).toHaveProperty('difficulty', updateData.difficulty);
      expect(response.body).toHaveProperty('category', updateData.category);
    });

    it('should delete a question from a question set', async () => {
      // Add a question first
      const questionData = {
        question: 'To delete?',
        correctAnswer: 'Answer',
        incorrectAnswers: ['Wrong1', 'Wrong2', 'Wrong3'],
        explanation: 'Explanation',
        difficulty: 'easy',
        category: 'Geography'
      };

      const createResponse = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      const questionId = createResponse.body.id;

      // Delete the question
      const response = await request(app)
        .delete(`/api/question-management/sets/${questionSetId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Question deleted successfully');

      // Verify it's deleted
      const getResponse = await request(app)
        .get(`/api/question-management/sets/${questionSetId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('JSON Import System', () => {
    let questionSetId: string;

    beforeEach(async () => {
      // Create a question set for testing
      const questionSetData = {
        name: 'Import Test Set',
        description: 'A test question set for JSON import',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      questionSetId = createResponse.body.id;
    });

    it('should import valid JSON question set', async () => {
      const validJsonData = {
        name: 'Imported Question Set',
        description: 'Questions imported from JSON',
        category: 'Science',
        isPublic: false,
        questions: [
          {
            question: 'What is the chemical symbol for gold?',
            correctAnswer: 'Au',
            incorrectAnswers: ['Ag', 'Fe', 'Cu'],
            explanation: 'Au comes from the Latin word for gold, aurum.',
            difficulty: 'medium',
            category: 'Chemistry'
          },
          {
            question: 'What is the largest planet in our solar system?',
            correctAnswer: 'Jupiter',
            incorrectAnswers: ['Saturn', 'Neptune', 'Uranus'],
            explanation: 'Jupiter is the largest planet in our solar system.',
            difficulty: 'easy',
            category: 'Astronomy'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jsonData: JSON.stringify(validJsonData) })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Questions imported successfully');
      expect(response.body).toHaveProperty('importedCount', 2);

      // Verify questions were imported
      const questionsResponse = await request(app)
        .get(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(questionsResponse.body.questions.length).toBe(2);
    });

    it('should reject invalid JSON format', async () => {
      const invalidJson = '{ invalid json }';

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jsonData: invalidJson })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid JSON format');
    });

    it('should reject JSON with missing required fields', async () => {
      const invalidData = {
        questions: [
          {
            question: 'What is the capital of France?',
            // Missing correctAnswer and other required fields
            incorrectAnswers: ['London', 'Berlin', 'Madrid']
          }
        ]
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jsonData: JSON.stringify(invalidData) })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('missing required field');
    });

    it('should reject JSON with invalid question structure', async () => {
      const invalidData = {
        questions: [
          {
            question: 'What is the capital of France?',
            correctAnswer: 'Paris',
            incorrectAnswers: ['London'], // Should have exactly 3 incorrect answers
            explanation: 'Paris is the capital of France.',
            difficulty: 'easy',
            category: 'Geography'
          }
        ]
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jsonData: JSON.stringify(invalidData) })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('incorrect answers');
    });

    it('should handle partial import with some valid questions', async () => {
      const mixedData = {
        questions: [
          {
            question: 'Valid question?',
            correctAnswer: 'Valid answer',
            incorrectAnswers: ['Wrong1', 'Wrong2', 'Wrong3'],
            explanation: 'Valid explanation',
            difficulty: 'easy',
            category: 'Geography'
          },
          {
            question: 'Invalid question',
            // Missing required fields
            incorrectAnswers: ['Wrong1', 'Wrong2', 'Wrong3']
          }
        ]
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/import`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jsonData: JSON.stringify(mixedData) })
        .expect(207); // Partial success

      expect(response.body).toHaveProperty('message', 'Partial import completed');
      expect(response.body).toHaveProperty('importedCount', 1);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });

  describe('AI Question Generation', () => {
    let questionSetId: string;

    beforeEach(async () => {
      // Create a question set for testing
      const questionSetData = {
        name: 'AI Generated Set',
        description: 'Questions generated by AI',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      questionSetId = createResponse.body.id;
    });

    it('should generate questions using AI with valid prompt', async () => {
      const generationData = {
        prompt: 'Generate 3 questions about basic chemistry concepts',
        questionCount: 3,
        difficulty: 'medium',
        category: 'Chemistry'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generationData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Questions generated successfully');
      expect(response.body).toHaveProperty('generatedCount');
      expect(response.body.generatedCount).toBeGreaterThan(0);

      // Verify questions were added to the set
      const questionsResponse = await request(app)
        .get(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(questionsResponse.body.questions.length).toBeGreaterThan(0);
    });

    it('should reject AI generation with invalid prompt', async () => {
      const generationData = {
        prompt: '', // Empty prompt
        questionCount: 3,
        difficulty: 'medium',
        category: 'Chemistry'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generationData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Prompt is required');
    });

    it('should reject AI generation with invalid question count', async () => {
      const generationData = {
        prompt: 'Generate questions about chemistry',
        questionCount: 0, // Invalid count
        difficulty: 'medium',
        category: 'Chemistry'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('question count');
    });

    it('should reject AI generation with invalid difficulty', async () => {
      const generationData = {
        prompt: 'Generate questions about chemistry',
        questionCount: 3,
        difficulty: 'invalid', // Invalid difficulty
        category: 'Chemistry'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('difficulty');
    });

    it('should handle AI generation errors gracefully', async () => {
      // Mock AI service to return error
      jest.spyOn(geminiService, 'generateQuestions').mockRejectedValue(new Error('AI service unavailable'));

      const generationData = {
        prompt: 'Generate questions about chemistry',
        questionCount: 3,
        difficulty: 'medium',
        category: 'Chemistry'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/generate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(generationData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to generate questions');

      // Restore mock
      jest.restoreAllMocks();
    });
  });

  describe('Question Set Validation and Security', () => {
    it('should validate question set ownership before operations', async () => {
      // Create another user
      const otherUserData = {
        username: 'otheruser',
        email: 'other@example.com',
        password: 'TestPass123!',
        characterId: 1
      };

      await request(app)
        .post('/api/auth/register')
        .send(otherUserData)
        .expect(201);

      // Verify email for other user
      const tokenResult = await dbService.query(
        'SELECT email_verification_token FROM users WHERE email = $1',
        [otherUserData.email]
      );
      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: tokenResult.rows[0]!.email_verification_token })
        .expect(200);

      // Login as other user
      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'otheruser', password: 'TestPass123!' })
        .expect(200);

      const otherAuthToken = otherLoginResponse.body?.tokens?.accessToken;

      // Create question set as other user
      const questionSetData = {
        name: 'Other User Set',
        description: 'A question set owned by another user',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send(questionSetData)
        .expect(201);

      const questionSetId = createResponse.body.id;

      // Try to access as original user
      const response = await request(app)
        .get(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Access denied');
    });

    it('should sanitize user input to prevent XSS', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Test Set',
        description: 'A test set with <img src="x" onerror="alert(\'xss\')">',
        category: 'Science',
        isPublic: false
      };

      const response = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(201);

      // Verify input was sanitized
      expect(response.body.name).not.toContain('<script>');
      expect(response.body.description).not.toContain('<img');
    });

    it('should validate question difficulty levels', async () => {
      const questionSetData = {
        name: 'Test Set',
        description: 'A test set',
        category: 'Science',
        isPublic: false
      };

      const createResponse = await request(app)
        .post('/api/question-management/sets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionSetData)
        .expect(201);

      const questionSetId = createResponse.body.id;

      const invalidQuestionData = {
        question: 'Test question?',
        correctAnswer: 'Test answer',
        incorrectAnswers: ['Wrong1', 'Wrong2', 'Wrong3'],
        explanation: 'Test explanation',
        difficulty: 'invalid_difficulty', // Invalid difficulty
        category: 'Geography'
      };

      const response = await request(app)
        .post(`/api/question-management/sets/${questionSetId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidQuestionData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('difficulty');
    });
  });
}); 
