import request from 'supertest';
import { app } from '../../../server.js';
import { DatabaseService } from '../../../services/DatabaseService.js';
import { AuthService } from '../../../services/AuthService.js';

describe('Perks Routes Integration', () => {
  let db: DatabaseService;
  let authService: AuthService;
  let testUserId: number;
  let testUserToken: string;
  let testPerkId: number;

  beforeAll(async () => {
    db = DatabaseService.getInstance();
    authService = new AuthService();

    // Create a test user
    const testUser = await authService.register({
      email: 'perktest@example.com',
      password: 'testpass123',
      username: 'perkuser',
      selectedCharacter: 'student'
    });
    testUserId = testUser.user.id;

    // Login to get token
    const loginResult = await authService.login({
      email: 'perktest@example.com',
      password: 'testpass123'
    });
    testUserToken = loginResult.token;

    // Set user to level 10 to access perks
    await db.query(
      'UPDATE users SET character_level = 10, experience_points = 500 WHERE id = $1',
      [testUserId]
    );

    // Get a test perk ID
    const perkResult = await db.query(
      'SELECT id FROM perks WHERE is_active = true ORDER BY level_required ASC LIMIT 1'
    );
    if (perkResult.rows.length > 0) {
      testPerkId = perkResult.rows[0]!['id'];
    }
  });

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await db.query('DELETE FROM user_perks WHERE user_id = $1', [testUserId]);
      await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
  });

  describe('GET /api/perks/test', () => {
    it('should return success response for test endpoint', async () => {
      const response = await request(app)
        .get('/api/perks/test')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Perks route is working!',
        timestamp: expect.any(String)
      });
    });
  });

  describe('GET /api/perks/all', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/perks/all')
        .expect(401);
    });

    it('should return all available perks for authenticated user', async () => {
      const response = await request(app)
        .get('/api/perks/all')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      // Should have perks data
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Each perk should have required fields
      response.body.data.forEach((perk: any) => {
        expect(perk).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          category: expect.any(String),
          type: expect.any(String),
          level_required: expect.any(Number),
          title: expect.any(String),
          description: expect.any(String),
          is_active: true
        });
      });
    });
  });

  describe('GET /api/perks/user', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/perks/user')
        .expect(401);
    });

    it('should return user perks data', async () => {
      const response = await request(app)
        .get('/api/perks/user')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          perks: expect.any(Array),
          activePerks: expect.any(Array),
          loadout: expect.objectContaining({
            user_id: testUserId,
            active_avatar: expect.any(String),
            active_theme: expect.any(String),
            perks_config: expect.any(Object),
            active_perks: expect.any(Array)
          })
        }
      });
    });
  });

  describe('POST /api/perks/unlock/:perkId', () => {
    beforeEach(async () => {
      // Ensure test perk is not already unlocked
      await db.query('DELETE FROM user_perks WHERE user_id = $1 AND perk_id = $2', [testUserId, testPerkId]);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/perks/unlock/${testPerkId}`)
        .expect(401);
    });

    it('should return error for invalid perk ID', async () => {
      const response = await request(app)
        .post('/api/perks/unlock/invalid')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid perk ID'
      });
    });

    it('should unlock perk when requirements are met', async () => {
      const response = await request(app)
        .post(`/api/perks/unlock/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Perk unlocked successfully'
      });

      // Verify perk was unlocked in database
      const unlockResult = await db.query(
        'SELECT * FROM user_perks WHERE user_id = $1 AND perk_id = $2 AND is_unlocked = true',
        [testUserId, testPerkId]
      );
      expect(unlockResult.rows.length).toBe(1);
    });

    it('should return error when trying to unlock already unlocked perk', async () => {
      // First unlock
      await request(app)
        .post(`/api/perks/unlock/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      // Try to unlock again
      const response = await request(app)
        .post(`/api/perks/unlock/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Cannot unlock this perk. Check level requirements or if already unlocked.'
      });
    });
  });

  describe('POST /api/perks/activate/:perkId', () => {
    beforeEach(async () => {
      // Ensure test perk is unlocked
      await db.query(`
        INSERT INTO user_perks (user_id, perk_id, is_unlocked, is_active, updated_at) 
        VALUES ($1, $2, true, false, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, perk_id) DO UPDATE SET is_unlocked = true, is_active = false
      `, [testUserId, testPerkId]);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/perks/activate/${testPerkId}`)
        .expect(401);
    });

    it('should return error for invalid perk ID', async () => {
      const response = await request(app)
        .post('/api/perks/activate/invalid')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ configuration: {} })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid perk ID'
      });
    });

    it('should activate unlocked perk with configuration', async () => {
      const configuration = { selected_avatar: 'scientist' };

      const response = await request(app)
        .post(`/api/perks/activate/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ configuration })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Perk activated successfully'
      });

      // Verify perk was activated in database
      const activateResult = await db.query(
        'SELECT * FROM user_perks WHERE user_id = $1 AND perk_id = $2 AND is_active = true',
        [testUserId, testPerkId]
      );
      expect(activateResult.rows.length).toBe(1);
      expect(JSON.parse(activateResult.rows[0]!['configuration'])).toEqual(configuration);
    });

    it('should return error when trying to activate locked perk', async () => {
      // Get a high-level perk that user cannot access
      const highLevelPerkResult = await db.query(
        'SELECT id FROM perks WHERE is_active = true AND level_required > 10 LIMIT 1'
      );
      
      if (highLevelPerkResult.rows.length > 0) {
        const highLevelPerkId = highLevelPerkResult.rows[0]!['id'];
        
        const response = await request(app)
          .post(`/api/perks/activate/${highLevelPerkId}`)
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ configuration: {} })
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          message: 'Cannot activate perk. Make sure it is unlocked.'
        });
      }
    });
  });

  describe('POST /api/perks/deactivate/:perkId', () => {
    beforeEach(async () => {
      // Ensure test perk is unlocked and active
      await db.query(`
        INSERT INTO user_perks (user_id, perk_id, is_unlocked, is_active, updated_at) 
        VALUES ($1, $2, true, true, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, perk_id) DO UPDATE SET is_unlocked = true, is_active = true
      `, [testUserId, testPerkId]);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/perks/deactivate/${testPerkId}`)
        .expect(401);
    });

    it('should deactivate active perk', async () => {
      const response = await request(app)
        .post(`/api/perks/deactivate/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Perk deactivated successfully'
      });

      // Verify perk was deactivated in database
      const deactivateResult = await db.query(
        'SELECT * FROM user_perks WHERE user_id = $1 AND perk_id = $2',
        [testUserId, testPerkId]
      );
      expect(deactivateResult.rows.length).toBe(1);
      expect(deactivateResult.rows[0]!['is_active']).toBe(false);
    });

    it('should return error when trying to deactivate non-existent perk', async () => {
      const response = await request(app)
        .post('/api/perks/deactivate/999999')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Perk not found or not active'
      });
    });
  });

  describe('GET /api/perks/loadout', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/perks/loadout')
        .expect(401);
    });

    it('should return user loadout', async () => {
      const response = await request(app)
        .get('/api/perks/loadout')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user_id: testUserId,
          active_avatar: expect.any(String),
          active_theme: expect.any(String),
          perks_config: expect.any(Object),
          active_perks: expect.any(Array)
        }
      });
    });
  });

  describe('GET /api/perks/category/:category', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/perks/category/cosmetic')
        .expect(401);
    });

    it('should return perks filtered by category', async () => {
      const response = await request(app)
        .get('/api/perks/category/cosmetic')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      // All returned perks should be in the cosmetic category
      response.body.data.forEach((perk: any) => {
        expect(perk.category).toBe('cosmetic');
      });
    });
  });

  describe('POST /api/perks/check-unlocks', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/perks/check-unlocks')
        .expect(401);
    });

    it('should check and unlock perks for user level', async () => {
      // Set user to higher level to trigger unlocks
      await db.query(
        'UPDATE users SET character_level = 20, experience_points = 1000 WHERE id = $1',
        [testUserId]
      );

      const response = await request(app)
        .post('/api/perks/check-unlocks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          newlyUnlocked: expect.any(Array),
          totalUnlocked: expect.any(Number)
        },
        message: expect.stringContaining('new perks unlocked!')
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database failure
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/perks/all')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to fetch perks'
      });

      // Restore original method
      db.query = originalQuery;
    });
  });
});