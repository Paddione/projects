import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../server';
import { DatabaseService } from '../../../services/DatabaseService';
import { ScoringService } from '../../../services/ScoringService';
import { HallOfFameService } from '../../../services/HallOfFameService';
import { AuthService } from '../../../services/AuthService';

describe('Game Routes Integration Tests', () => {
  let dbService: DatabaseService;
  let scoringService: ScoringService;
  let hallOfFameService: HallOfFameService;
  let authService: AuthService;
  let authToken: string;
  let testQuestionSetId: number;
  let testGameSessionId: number;
  let testLobbyId: number;
  let testUserId: number;

  beforeAll(async () => {
    dbService = DatabaseService.getInstance();
    
    scoringService = new ScoringService();
    hallOfFameService = new HallOfFameService();
    authService = new AuthService();
  });

  afterAll(async () => {
    await dbService.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await dbService.query('DELETE FROM hall_of_fame');
    await dbService.query('DELETE FROM game_sessions');
    await dbService.query('DELETE FROM questions');
    await dbService.query('DELETE FROM question_sets');
    await dbService.query('DELETE FROM users');

    // Create test user
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPass123!'
    };

    // Register and verify user
    await request(app)
      .post('/api/auth/register')
      .send(userData);

    // Get verification token from users table since it's stored as a column, not a separate table
    const user = await dbService.query(
      'SELECT email_verification_token FROM users WHERE email = $1',
      [userData.email]
    );
    const verificationToken = user.rows[0]?.email_verification_token;
    await request(app)
      .post('/api/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: userData.username,
        password: userData.password
      });

    authToken = loginResponse.body?.tokens?.accessToken;
    testUserId = loginResponse.body.user.id;

    // Create test question set
    const questionSetData = {
      name: 'Test Question Set',
      description: 'A test question set for game testing',
      category: 'Test Category',
      difficulty: 'medium',
      is_active: true
    };

    const questionSetResponse = await request(app)
      .post('/api/questions/sets')
      .set('Authorization', `Bearer ${authToken}`)
      .send(questionSetData);

    testQuestionSetId = questionSetResponse.body.data.id;

    // Create test questions
    for (let i = 0; i < 5; i++) {
      const questionData = {
        question_set_id: testQuestionSetId,
        question_text: {
          en: `Test question ${i + 1}?`,
          de: `Testfrage ${i + 1}?`
        },
        answers: [
          {
            text: { en: 'Answer A', de: 'Antwort A' },
            correct: false
          },
          {
            text: { en: 'Answer B', de: 'Antwort B' },
            correct: true
          },
          {
            text: { en: 'Answer C', de: 'Antwort C' },
            correct: false
          }
        ],
        explanation: {
          en: `Explanation ${i + 1}`,
          de: `Erklärung ${i + 1}`
        },
        difficulty: 1
      };

      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);
    }

    // Create a minimal lobby compatible with current schema
    const lobbyResp = await dbService.query(
      `INSERT INTO lobbies (code, host_id, status, question_count, current_question, settings, players)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['TEST12', testUserId, 'waiting', 10, 0, JSON.stringify({ timeLimit: 60, allowReplay: true }), JSON.stringify([])]
    );
    testLobbyId = lobbyResp.rows[0].id;

    // Create a minimal game session compatible with current schema
    const sessionResp = await dbService.query(
      `INSERT INTO game_sessions (lobby_id, question_set_id, total_questions, session_data, started_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [testLobbyId, testQuestionSetId, 10, JSON.stringify({})]
    );
    testGameSessionId = sessionResp.rows[0].id;
  });

  describe('Scoring Routes Integration', () => {
    describe('GET /api/scoring/leaderboard', () => {
      beforeEach(async () => {
        // Create player results for scoring leaderboard (uses player_results table)
        const results = [
          { username: 'player1', final_score: 1000, correct_answers: 8, total_questions: 10, max_multiplier: 3 },
          { username: 'player2', final_score: 1200, correct_answers: 9, total_questions: 10, max_multiplier: 4 },
          { username: 'player3', final_score: 800,  correct_answers: 7, total_questions: 10, max_multiplier: 2 }
        ];
        for (const r of results) {
          await dbService.query(
            `INSERT INTO player_results (session_id, username, final_score, correct_answers, total_questions, max_multiplier, answer_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [testGameSessionId, r.username, r.final_score, r.correct_answers, r.total_questions, r.max_multiplier, JSON.stringify([])]
          );
        }
      });

      it('should get leaderboard for question set successfully', async () => {
        const response = await request(app)
          .get('/api/scoring/leaderboard')
          .query({
            questionSetId: testQuestionSetId,
            limit: 10
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(3);
        
        // Should be sorted by score in descending order
        // ScoringService.getLeaderboard returns `finalScore` field
        expect(response.body.data[0].finalScore).toBe(1200);
        expect(response.body.data[1].finalScore).toBe(1000);
        expect(response.body.data[2].finalScore).toBe(800);
      });

      it('should limit leaderboard results', async () => {
        const response = await request(app)
          .get('/api/scoring/leaderboard')
          .query({
            questionSetId: testQuestionSetId,
            limit: 2
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(2);
      });

      it('should return 400 for missing questionSetId', async () => {
        const response = await request(app)
          .get('/api/scoring/leaderboard')
          .query({
            limit: 10
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid questionSetId', async () => {
        const response = await request(app)
          .get('/api/scoring/leaderboard')
          .query({
            questionSetId: 'invalid',
            limit: 10
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/scoring/statistics/:userId', () => {
      beforeEach(async () => {
        // Populate player_results for this user to drive stats
        const results = [
          { final_score: 1000, correct_answers: 8, total_questions: 10, max_multiplier: 3 },
          { final_score: 1200, correct_answers: 9, total_questions: 10, max_multiplier: 4 }
        ];
        for (const r of results) {
          await dbService.query(
            `INSERT INTO player_results (session_id, user_id, username, final_score, correct_answers, total_questions, max_multiplier, answer_details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [testGameSessionId, testUserId, 'testuser', r.final_score, r.correct_answers, r.total_questions, r.max_multiplier, JSON.stringify([])]
          );
        }
      });

      it('should get player statistics successfully', async () => {
        const response = await request(app)
          .get(`/api/scoring/statistics/${testUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('totalGames');
        expect(response.body.data).toHaveProperty('totalScore');
        expect(response.body.data).toHaveProperty('averageScore');
        expect(response.body.data).toHaveProperty('bestScore');
        expect(response.body.data).toHaveProperty('averageAccuracy');
      });

      it('should return 401 for unauthenticated request', async () => {
        const response = await request(app)
          .get(`/api/scoring/statistics/${testUserId}`)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should return 400 for invalid userId', async () => {
        const response = await request(app)
          .get('/api/scoring/statistics/invalid')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/scoring/validate-hall-of-fame', () => {
      it('should validate Hall of Fame eligibility successfully', async () => {
        const validationData = {
          gameSessionId: testGameSessionId,
          totalQuestions: 10,
          completedQuestions: 10
        };

        const response = await request(app)
          .post('/api/scoring/validate-hall-of-fame')
          .send(validationData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('isEligible');
        expect(response.body.data).toHaveProperty('completionRate');
        expect(response.body.data.completionRate).toBe(100);
      });

      it('should return false for incomplete game session', async () => {
        const validationData = {
          gameSessionId: testGameSessionId,
          totalQuestions: 10,
          completedQuestions: 5
        };

        const response = await request(app)
          .post('/api/scoring/validate-hall-of-fame')
          .send(validationData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('isEligible');
        expect(response.body.data).toHaveProperty('completionRate');
        expect(response.body.data.completionRate).toBe(50);
      });

      it('should return 400 for invalid request data', async () => {
        const invalidData = {
          gameSessionId: 'invalid',
          totalQuestions: -1,
          completedQuestions: 5
        };

        const response = await request(app)
          .post('/api/scoring/validate-hall-of-fame')
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/scoring/performance-rating', () => {
      it('should calculate performance rating successfully', async () => {
        const response = await request(app)
          .get('/api/scoring/performance-rating')
          .query({
            score: 1000,
            accuracy: 85,
            maxMultiplier: 3
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('rating');
        expect(typeof response.body.data.rating).toBe('string');
      });

      it('should return 400 for invalid parameters', async () => {
        const response = await request(app)
          .get('/api/scoring/performance-rating')
          .query({
            score: -1,
            accuracy: 150,
            maxMultiplier: 10
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Hall of Fame Routes Integration', () => {
    describe('POST /api/hall-of-fame/submit', () => {
      it('should submit score to Hall of Fame successfully', async () => {
        const submissionData = {
          sessionId: testGameSessionId,
          username: 'testuser',
          characterName: 'Warrior',
          score: 1000,
          accuracy: 85.5,
          maxMultiplier: 3,
          questionSetId: testQuestionSetId,
          questionSetName: 'Test Question Set'
        };

        const response = await request(app)
          .post('/api/hall-of-fame/submit')
          .send(submissionData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('successfully submitted');

        // Verify entry was created in database
        const entry = await dbService.query(
          'SELECT * FROM hall_of_fame WHERE session_id = $1 AND username = $2',
          [testGameSessionId, 'testuser']
        );
        expect(entry.rows[0]).toBeDefined();
        expect(entry.rows[0].score).toBe(1000);
        // PostgreSQL NUMERIC columns return string representations
        expect(parseFloat(entry.rows[0].accuracy)).toBe(85.5);
      });

      it('should return 400 for invalid submission data', async () => {
        const invalidData = {
          sessionId: testGameSessionId,
          username: '', // empty username
          score: -1, // negative score
          accuracy: 150, // invalid accuracy
          maxMultiplier: 10, // invalid multiplier
          questionSetId: testQuestionSetId,
          questionSetName: 'Test Question Set'
        };

        const response = await request(app)
          .post('/api/hall-of-fame/submit')
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle duplicate submissions gracefully', async () => {
        const submissionData = {
          sessionId: testGameSessionId,
          username: 'testuser',
          characterName: 'Warrior',
          score: 1000,
          accuracy: 85.5,
          maxMultiplier: 3,
          questionSetId: testQuestionSetId,
          questionSetName: 'Test Question Set'
        };

        // Submit first time
        await request(app)
          .post('/api/hall-of-fame/submit')
          .send(submissionData)
          .expect(200);

        // Submit again — service allows re-submission if still eligible
        const response = await request(app)
          .post('/api/hall-of-fame/submit')
          .send(submissionData);

        // Either succeeds (200) or fails eligibility (400)
        expect([200, 400]).toContain(response.status);
        expect(response.body).toHaveProperty('success');
      });
    });

    describe('GET /api/hall-of-fame/leaderboard/:questionSetId', () => {
      beforeEach(async () => {
        // Create test Hall of Fame entries
        const entries = [
          {
            session_id: testGameSessionId,
            username: 'player1',
            character_name: 'Warrior',
            score: 1000,
            accuracy: 85.5,
            max_multiplier: 3,
            question_set_id: testQuestionSetId,
            question_set_name: 'Test Question Set',
            completed_at: new Date().toISOString()
          },
          {
            session_id: testGameSessionId,
            username: 'player2',
            character_name: 'Mage',
            score: 1200,
            accuracy: 90.0,
            max_multiplier: 4,
            question_set_id: testQuestionSetId,
            question_set_name: 'Test Question Set',
            completed_at: new Date().toISOString()
          }
        ];

        for (const entry of entries) {
          await dbService.query(
            'INSERT INTO hall_of_fame (session_id, username, character_name, score, accuracy, max_multiplier, question_set_id, question_set_name, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
              entry.session_id,
              entry.username,
              entry.character_name,
              entry.score,
              entry.accuracy,
              entry.max_multiplier,
              entry.question_set_id,
              entry.question_set_name,
              entry.completed_at
            ]
          );
        }
      });

      it('should get leaderboard for specific question set', async () => {
        const response = await request(app)
          .get(`/api/hall-of-fame/leaderboard/${testQuestionSetId}`)
          .query({ limit: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        // getQuestionSetLeaderboard returns { questionSetId, questionSetName, entries, totalEntries }
        expect(response.body.data).toHaveProperty('entries');
        expect(Array.isArray(response.body.data.entries)).toBe(true);
        expect(response.body.data.entries.length).toBe(2);

        // Should be sorted by score in descending order
        expect(response.body.data.entries[0].score).toBe(1200);
        expect(response.body.data.entries[1].score).toBe(1000);
      });

      it('should limit leaderboard results', async () => {
        const response = await request(app)
          .get(`/api/hall-of-fame/leaderboard/${testQuestionSetId}`)
          .query({ limit: 1 })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('entries');
        expect(Array.isArray(response.body.data.entries)).toBe(true);
        expect(response.body.data.entries.length).toBe(1);
      });

      it('should return 400 for invalid questionSetId', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/leaderboard/invalid')
          .query({ limit: 10 })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('GET /api/hall-of-fame/leaderboards', () => {
      it('should get all leaderboards successfully', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/leaderboards')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        // getAllLeaderboards returns Record<string, LeaderboardResponse>
        expect(typeof response.body.data).toBe('object');
      });
    });

    describe('GET /api/hall-of-fame/user/:username/best-scores', () => {
      beforeEach(async () => {
        // Submit a score through the public API to populate HOF
        const hallOfFameData = {
          sessionId: testGameSessionId,
          username: 'testuser',
          characterName: 'Warrior',
          score: 1000,
          accuracy: 85.5,
          maxMultiplier: 3,
          questionSetId: testQuestionSetId,
          questionSetName: 'Test Question Set'
        };
        await request(app).post('/api/hall-of-fame/submit').send(hallOfFameData).expect(200);
      });

      it('should get user best scores successfully', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/user/testuser/best-scores')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should return 404 for empty username path', async () => {
        // Express doesn't match route when param segment is empty
        const response = await request(app)
          .get('/api/hall-of-fame/user//best-scores')
          .expect(404);
      });
    });

    describe('GET /api/hall-of-fame/user/:username/rank/:questionSetId', () => {
      beforeEach(async () => {
        // Submit multiple scores for ranking via API
        const submissions = [
          { username: 'player1', characterName: 'Warrior', score: 1000, accuracy: 85.5, maxMultiplier: 3 },
          { username: 'player2', characterName: 'Mage',    score: 1200, accuracy: 90.0, maxMultiplier: 4 },
          { username: 'testuser', characterName: 'Archer', score: 800,  accuracy: 75.0, maxMultiplier: 2 }
        ];
        for (const s of submissions) {
          await request(app)
            .post('/api/hall-of-fame/submit')
            .send({
              sessionId: testGameSessionId,
              username: s.username,
              characterName: s.characterName,
              score: s.score,
              accuracy: s.accuracy,
              maxMultiplier: s.maxMultiplier,
              questionSetId: testQuestionSetId,
              questionSetName: 'Test Question Set'
            })
            .expect(200);
        }
      });

      it('should get user rank in question set successfully', async () => {
        const response = await request(app)
          .get(`/api/hall-of-fame/user/testuser/rank/${testQuestionSetId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('rank');
        expect(typeof response.body.data.rank).toBe('number');
        expect(response.body.data.rank).toBe(3); // Should be 3rd place
      });

      it('should return 404 for empty username path', async () => {
        // Express doesn't match route when param segment is empty
        const response = await request(app)
          .get('/api/hall-of-fame/user//rank/invalid')
          .expect(404);
      });
    });

    describe('GET /api/hall-of-fame/recent', () => {
      beforeEach(async () => {
        // Submit recent entries
        const now = Date.now();
        const submissions = [
          { username: 'player1', characterName: 'Warrior', score: 1000, accuracy: 85.5, maxMultiplier: 3 },
          { username: 'player2', characterName: 'Mage',    score: 1200, accuracy: 90.0, maxMultiplier: 4 }
        ];
        for (const s of submissions) {
          await request(app)
            .post('/api/hall-of-fame/submit')
            .send({
              sessionId: testGameSessionId,
              username: s.username,
              characterName: s.characterName,
              score: s.score,
              accuracy: s.accuracy,
              maxMultiplier: s.maxMultiplier,
              questionSetId: testQuestionSetId,
              questionSetName: 'Test Question Set'
            })
            .expect(200);
        }
      });

      it('should get recent entries successfully', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/recent')
          .query({ limit: 10 })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(2);
      });

      it('should limit recent entries', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/recent')
          .query({ limit: 1 })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBe(1);
      });
    });

    describe('GET /api/hall-of-fame/statistics', () => {
      it('should get Hall of Fame statistics successfully', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/statistics')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('totalEntries');
        expect(response.body.data).toHaveProperty('uniquePlayers');
        expect(response.body.data).toHaveProperty('averageScore');
        expect(response.body.data).toHaveProperty('highestScore');
        expect(response.body.data).toHaveProperty('averageAccuracy');
      });
    });

    describe('GET /api/hall-of-fame/search', () => {
      beforeEach(async () => {
        // Create test entries for search
        const entries = [
          {
            session_id: testGameSessionId,
            username: 'testuser',
            character_name: 'Warrior',
            score: 1000,
            accuracy: 85.5,
            max_multiplier: 3,
            question_set_id: testQuestionSetId,
            question_set_name: 'Test Question Set',
            completed_at: new Date().toISOString()
          }
        ];

        for (const entry of entries) {
          await dbService.query(
            'INSERT INTO hall_of_fame (session_id, username, character_name, score, accuracy, max_multiplier, question_set_id, question_set_name, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [
              entry.session_id,
              entry.username,
              entry.character_name,
              entry.score,
              entry.accuracy,
              entry.max_multiplier,
              entry.question_set_id,
              entry.question_set_name,
              entry.completed_at
            ]
          );
        }
      });

      it('should search Hall of Fame entries successfully', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/search')
          .query({
            q: 'testuser',
            limit: 10
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should return 400 for missing search term', async () => {
        const response = await request(app)
          .get('/api/hall-of-fame/search')
          .query({ limit: 10 })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/hall-of-fame/validate-eligibility', () => {
      it('should validate Hall of Fame eligibility successfully', async () => {
        const validationData = {
          sessionId: testGameSessionId
        };

        const response = await request(app)
          .post('/api/hall-of-fame/validate-eligibility')
          .send(validationData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('isEligible');
        expect(response.body.data).toHaveProperty('completionRate');
      });

      it('should return 400 for invalid sessionId', async () => {
        const validationData = {
          sessionId: 'invalid'
        };

        const response = await request(app)
          .post('/api/hall-of-fame/validate-eligibility')
          .send(validationData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Multiplayer Game Flow Integration', () => {
    it('should handle complete game session flow', async () => {
      // Create a second player (lobby start requires at least 2 players)
      const player2Data = {
        username: 'player2',
        email: 'player2@example.com',
        password: 'TestPass123!'
      };
      await request(app)
        .post('/api/auth/register')
        .send(player2Data);
      const player2Login = await request(app)
        .post('/api/auth/login')
        .send({ username: player2Data.username, password: player2Data.password });
      const player2Token = player2Login.body?.tokens?.accessToken;
      const player2Id = player2Login.body.user.id;

      // Step 1: Create a lobby
      const lobbyData = {
        questionCount: 5,
        questionSetIds: [testQuestionSetId],
        settings: {
          timeLimit: 60,
          allowReplay: true
        }
      };

      const lobbyResponse = await request(app)
        .post('/api/lobbies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(lobbyData)
        .expect(201);

      const lobbyCode = lobbyResponse.body.lobby.code;

      // Step 2: Player 2 joins the lobby
      await request(app)
        .post('/api/lobbies/join')
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ lobbyCode })
        .expect(200);

      // Step 3: Mark both players as ready
      await request(app)
        .put(`/api/lobbies/${lobbyCode}/players/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isReady: true })
        .expect(200);
      await request(app)
        .put(`/api/lobbies/${lobbyCode}/players/${player2Id}`)
        .set('Authorization', `Bearer ${player2Token}`)
        .send({ isReady: true })
        .expect(200);

      // Step 4: Start the game
      const startResponse = await request(app)
        .post(`/api/lobbies/${lobbyCode}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(startResponse.body).toHaveProperty('lobby');

      // Step 5: Submit to Hall of Fame using the pre-existing game session
      const hallOfFameData = {
        sessionId: testGameSessionId,
        username: 'testuser',
        characterName: 'Warrior',
        score: 500,
        accuracy: 100,
        maxMultiplier: 3,
        questionSetId: testQuestionSetId,
        questionSetName: 'Test Question Set'
      };

      const hallOfFameResponse = await request(app)
        .post('/api/hall-of-fame/submit')
        .send(hallOfFameData)
        .expect(200);

      expect(hallOfFameResponse.body).toHaveProperty('success', true);

      // Step 5: Verify leaderboard entry
      const leaderboardResponse = await request(app)
        .get(`/api/hall-of-fame/leaderboard/${testQuestionSetId}`)
        .query({ limit: 10 })
        .expect(200);

      expect(leaderboardResponse.body.data).toHaveProperty('entries');
    });
  });

  describe('Real-time Game State Synchronization', () => {
    it('should handle concurrent score submissions', async () => {
      // Create multiple game sessions
      const sessions: string[] = [];
      for (let i = 0; i < 3; i++) {
        // Create lobby and session for each
        const lobbyRespN = await dbService.query(
          `INSERT INTO lobbies (code, host_id, status, question_count, current_question, settings, players)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [`RTS${i + 1}A`, testUserId, 'waiting', 10, 0, JSON.stringify({}), JSON.stringify([])]
        );
        const lobbyIdN = lobbyRespN.rows[0].id;
        const sessionRespN = await dbService.query(
          `INSERT INTO game_sessions (lobby_id, question_set_id, total_questions, session_data, started_at)
           VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
          [lobbyIdN, testQuestionSetId, 10, JSON.stringify({})]
        );
        sessions.push(sessionRespN.rows[0].id);
      }

      // Submit scores concurrently
      const submissionPromises = sessions.map((sessionId, index) => {
        const submissionData = {
          sessionId: sessionId,
          username: `player${index + 1}`,
          characterName: 'Warrior',
          score: 1000 + (index * 100),
          accuracy: 80 + (index * 5),
          maxMultiplier: 3,
          questionSetId: testQuestionSetId,
          questionSetName: 'Test Question Set'
        };

        return request(app)
          .post('/api/hall-of-fame/submit')
          .send(submissionData);
      });

      const responses = await Promise.all(submissionPromises);

      // All submissions should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      // Verify entries were created (some may not qualify if eligibility check fails)
      const entries = await dbService.query(
        'SELECT COUNT(*) as count FROM hall_of_fame WHERE question_set_id = $1',
        [testQuestionSetId]
      );
      expect(parseInt(entries.rows[0].count)).toBeGreaterThan(0);
    });
  });
}); 
