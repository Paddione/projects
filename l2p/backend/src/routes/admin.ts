import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { AuthMiddleware } from '../middleware/auth.js';

const router = express.Router();
const authMiddleware = new AuthMiddleware();

// Database connection
const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
});

// Middleware to check if user is admin
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    // Get user from auth middleware
    const user = req.user;
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }
    
    return next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify admin status',
      code: 'ADMIN_VERIFICATION_FAILED',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * GET /api/admin/info
 * Get admin information (test endpoint)
 */
router.get('/info', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      message: 'Admin access granted',
      user: (req as any).user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Admin info error:', error);
    return res.status(500).json({
      error: 'Failed to get admin info',
      message: 'An unexpected error occurred',
      code: 'ADMIN_INFO_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/admin/users
 * Get users with pagination and sorting
 */
router.get('/users', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { q, limit = 25, offset = 0, sort = 'created_at', dir = 'DESC' } = req.query;
    
    // Validate limit
    const limitNum = Math.min(parseInt(limit as string) || 25, 100);
    const offsetNum = parseInt(offset as string) || 0;
    
    // Validate sort field
    const allowedSortFields = ['id', 'username', 'email', 'created_at', 'last_login', 'character_level', 'experience_points', 'is_active', 'is_admin'];
    const sortField = allowedSortFields.includes(sort as string) ? sort as string : 'created_at';
    const sortDir = dir === 'ASC' ? 'ASC' : 'DESC';
    
    // Build query
    let query = `
      SELECT 
        id, username, email, is_admin, is_active, selected_character, 
        character_level, experience_points, created_at, last_login, 
        avatar_url, timezone
      FROM users
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramCount = 0;
    
    // Add search filter
    if (q && typeof q === 'string') {
      paramCount++;
      query += ` AND (username ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      queryParams.push(`%${q}%`);
    }
    
    // Add sorting and pagination
    query += ` ORDER BY ${sortField} ${sortDir}, id ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limitNum, offsetNum);
    
    // Execute query
    const result = await pool.query(query, queryParams);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams: any[] = [];
    
    if (q && typeof q === 'string') {
      countParams.push(`%${q}%`);
      countQuery += ` AND (username ILIKE $1 OR email ILIKE $1)`;
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]['count'] as string);
    
    return res.status(200).json({
      items: result.rows,
      total,
      limit: limitNum,
      offset: offsetNum,
      sort: { by: sortField, dir: sortDir }
    });
    
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({
      error: 'Failed to get users',
      message: 'An unexpected error occurred',
      code: 'GET_USERS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * PUT /api/admin/users/:id/character-level
 * Update user character level
 */
router.put('/users/:id/character-level', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { level } = req.body;
    
    if (!level || typeof level !== 'number' || level < 1) {
      return res.status(400).json({
        error: 'Invalid level',
        message: 'Level must be a positive number',
        code: 'INVALID_LEVEL',
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await pool.query(
      'UPDATE users SET character_level = $1 WHERE id = $2 RETURNING id, character_level',
      [level, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user with specified ID',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      user: result.rows[0]
    });
    
  } catch (error) {
    console.error('Update character level error:', error);
    return res.status(500).json({
      error: 'Failed to update character level',
      message: 'An unexpected error occurred',
      code: 'UPDATE_LEVEL_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/users/:id/password
 * Reset user password
 */
router.post('/users/:id/password', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long',
        code: 'INVALID_PASSWORD',
        timestamp: new Date().toISOString()
      });
    }
    
    // Hash the new password (you'll need to implement this)
    // For now, we'll just update with a placeholder
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [newPassword, id] // In production, this should be hashed
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user with specified ID',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('Update password error:', error);
    return res.status(500).json({
      error: 'Failed to update password',
      message: 'An unexpected error occurred',
      code: 'UPDATE_PASSWORD_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete('/users/:id', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user with specified ID',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      error: 'Failed to delete user',
      message: 'An unexpected error occurred',
      code: 'DELETE_USER_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;

/**
 * PATCH /api/admin/users/:id
 * Update arbitrary user fields (whitelisted)
 */
router.patch('/users/:id', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    // Whitelist of editable columns
    const allowedFields = new Set([
      'username',
      'email',
      'is_admin',
      'is_active',
      'selected_character',
      'character_level',
      'experience_points',
      'avatar_url',
      'timezone',
      'last_login'
    ]);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.has(key)) {
        updates.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields',
        message: 'Provide at least one editable field',
        code: 'NO_VALID_FIELDS',
        timestamp: new Date().toISOString()
      });
    }

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);
    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Could not find user with specified ID',
        code: 'USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Generic user update error:', error);
    return res.status(500).json({
      error: 'Failed to update user',
      message: 'An unexpected error occurred',
      code: 'UPDATE_USER_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/lobbies/clear
 * Clear all lobbies and related sessions
 */
router.post('/lobbies/clear', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Delete dependent rows first if any
    let deletedSessions = 0;
    try {
      const sessionResult = await pool.query('DELETE FROM game_sessions WHERE lobby_id IN (SELECT id FROM lobbies)');
      deletedSessions = sessionResult.rowCount || 0;
    } catch {
      // Table may not exist in some environments; ignore
    }

    const lobbyResult = await pool.query('DELETE FROM lobbies');
    const deletedLobbies = lobbyResult.rowCount || 0;

    return res.status(200).json({
      success: true,
      deleted: { lobbies: deletedLobbies, sessions: deletedSessions }
    });
  } catch (error) {
    console.error('Clear lobbies error:', error);
    return res.status(500).json({
      error: 'Failed to clear lobbies',
      message: 'An unexpected error occurred',
      code: 'CLEAR_LOBBIES_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new user (admin-only)
 */
router.post('/users', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { username, email, password, is_admin, is_active } = req.body as Record<string, unknown>;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({
        error: 'Invalid username',
        message: 'Username must be at least 3 characters',
        code: 'INVALID_USERNAME',
        timestamp: new Date().toISOString()
      });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'A valid email is required',
        code: 'INVALID_EMAIL',
        timestamp: new Date().toISOString()
      });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Password must be at least 8 characters long',
        code: 'INVALID_PASSWORD',
        timestamp: new Date().toISOString()
      });
    }

    // Check for duplicate username/email
    const dupUser = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username.trim(), email.trim()]);
    if (dupUser.rowCount && dupUser.rowCount > 0) {
      return res.status(409).json({
        error: 'User exists',
        message: 'Username or email already in use',
        code: 'USER_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // Hash password
    const bcrypt = await import('bcrypt');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users
        (username, email, password_hash, is_active, is_admin, email_verified, selected_character, character_level, experience_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, email, created_at, last_login, is_active, is_admin, selected_character, character_level, experience_points, avatar_url, timezone`,
      [
        username.trim(),
        email.trim(),
        passwordHash,
        is_active === false ? false : true,
        is_admin === true,
        true, // email_verified default to true for admin-created users
        'student',
        1,
        0
      ]
    );

    return res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      error: 'Failed to create user',
      message: 'An unexpected error occurred',
      code: 'CREATE_USER_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/admin/service/rebuild
 * Rebuild the L2P service containers
 */
router.post('/service/rebuild', authMiddleware.authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Trigger rebuild script in the background
    // The script will run docker-compose build and restart containers
    const rebuildCommand = 'cd /home/patrick/projects/l2p && docker compose --profile production build --no-cache && docker compose --profile production up -d';

    // Execute in background - don't wait for completion
    exec(rebuildCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Rebuild command error:', error);
      }
      if (stdout) {
        console.log('Rebuild stdout:', stdout);
      }
      if (stderr) {
        console.error('Rebuild stderr:', stderr);
      }
    });

    return res.status(202).json({
      success: true,
      message: 'Service rebuild initiated. Containers will be rebuilt and restarted in the background.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Service rebuild error:', error);
    return res.status(500).json({
      error: 'Failed to initiate service rebuild',
      message: 'An unexpected error occurred',
      code: 'SERVICE_REBUILD_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});
