import request from 'supertest';
import { app } from '../../../server.js';
import { DatabaseService } from '../../../services/DatabaseService.js';

describe('Perks Routes Integration', () => {
  let db: DatabaseService;
  let testUserId: number;
  let testUserToken: string;
  let testPerkId: number;

  beforeAll(async () => {
    db = DatabaseService.getInstance();

    // Create a test user via HTTP API (consistent with other integration tests)
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'perktest@example.com',
        password: 'TestPass123!',
        username: 'perkuser'
      });

    // Login to get token via HTTP API
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'perkuser',
        password: 'TestPass123!'
      });
    testUserId = loginResponse.body.user.id;
    testUserToken = loginResponse.body.tokens.accessToken;

    // Set user to level 10 to access perks
    await db.query(
      'UPDATE users SET character_level = 10, experience_points = 500 WHERE id = $1',
      [testUserId]
    );

    // Get a test perk ID (draft-based system uses tier instead of level_required)
    const perkResult = await db.query(
      'SELECT id FROM perks WHERE is_active = true ORDER BY tier ASC LIMIT 1'
    );
    if (perkResult.rows.length > 0) {
      testPerkId = perkResult.rows[0]!['id'];
    }
  });

  afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await db.query('DELETE FROM user_perk_drafts WHERE user_id = $1', [testUserId]);
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

      // Each perk should have required fields (draft system uses tier, not level_required)
      response.body.data.forEach((perk: any) => {
        expect(perk).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          category: expect.any(String),
          type: expect.any(String),
          tier: expect.any(Number),
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

    it('should return 403 because perks are acquired through draft system', async () => {
      // In the draft-based system, canUnlockPerk() always returns false
      // Perks are acquired through the draft panel during level-up, not manual unlock
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
      // In the draft system, a perk is "unlocked" when chosen in user_perk_drafts
      await db.query(`
        INSERT INTO user_perk_drafts (user_id, level, offered_perk_ids, chosen_perk_id, drafted_at)
        VALUES ($1, 1, ARRAY[$2::int], $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, level) DO UPDATE SET chosen_perk_id = $2
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

    it('should activate perk that was chosen in draft', async () => {
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
    });

    it('should return error when trying to activate non-drafted perk', async () => {
      // Get a perk that was NOT chosen in any draft
      const unchosen = await db.query(
        `SELECT id FROM perks WHERE is_active = true AND id != $1 LIMIT 1`,
        [testPerkId]
      );

      if (unchosen.rows.length > 0) {
        const unchosenPerkId = unchosen.rows[0]!['id'];

        const response = await request(app)
          .post(`/api/perks/activate/${unchosenPerkId}`)
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
      // Ensure test perk was chosen in the draft system
      await db.query(`
        INSERT INTO user_perk_drafts (user_id, level, offered_perk_ids, chosen_perk_id, drafted_at)
        VALUES ($1, 2, ARRAY[$2::int], $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, level) DO UPDATE SET chosen_perk_id = $2
      `, [testUserId, testPerkId]);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/perks/deactivate/${testPerkId}`)
        .expect(401);
    });

    it('should deactivate drafted perk', async () => {
      const response = await request(app)
        .post(`/api/perks/deactivate/${testPerkId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Perk deactivated successfully'
      });
    });

    it('should return error when trying to deactivate non-drafted perk', async () => {
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
        .get('/api/perks/category/time')
        .expect(401);
    });

    it('should return perks filtered by category', async () => {
      // Draft system categories: time, info, scoring, recovery, xp
      const response = await request(app)
        .get('/api/perks/category/time')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array)
      });

      // All returned perks should be in the time category
      response.body.data.forEach((perk: any) => {
        expect(perk.category).toBe('time');
      });
    });
  });

  describe('POST /api/perks/check-unlocks', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/perks/check-unlocks')
        .expect(401);
    });

    it('should return empty unlocks in draft-based system', async () => {
      // In draft-based system, checkAndUnlockPerksForLevel returns empty array
      // Perks are acquired through the draft panel, not level-based auto-unlock
      const response = await request(app)
        .post('/api/perks/check-unlocks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          newlyUnlocked: [],
          totalUnlocked: 0
        },
        message: '0 new perks unlocked!'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database failure — use /api/perks/user which always queries the DB
      // (unlike /api/perks/all which has an in-memory cache)
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValue(new Error('Database connection failed')) as any;

      const response = await request(app)
        .get('/api/perks/user')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false
      });

      // Restore original method
      db.query = originalQuery;
    });
  });
});
