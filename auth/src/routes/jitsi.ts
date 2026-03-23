import express, { type Request, type Response } from 'express';
import { TokenService } from '../services/TokenService.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();
const tokenService = new TokenService();

/**
 * GET /api/jitsi/authorize
 *
 * Validates user session, mints a Jitsi JWT, and redirects back to Jitsi
 * with the token in the URL. If not authenticated, returns 401.
 */
router.get('/authorize', authenticate, async (req: Request, res: Response) => {
  try {
    const redirectUri = req.query.redirect_uri as string;
    if (!redirectUri) {
      res.status(400).json({ error: 'redirect_uri is required' });
      return;
    }

    // Validate redirect_uri points to our Jitsi instance
    if (!redirectUri.startsWith('https://meet.korczewski.de')) {
      res.status(400).json({ error: 'Invalid redirect_uri' });
      return;
    }

    // Fetch full user from DB (req.user from JWT only has subset of fields)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Extract room name from redirect URI
    const url = new URL(redirectUri);
    const room = url.pathname.replace(/^\//, '') || '*';

    const jitsiToken = tokenService.generateJitsiToken(user, room);

    // Redirect back to Jitsi with JWT
    const separator = redirectUri.includes('?') ? '&' : '?';
    res.redirect(`${redirectUri}${separator}jwt=${jitsiToken}`);
  } catch (error) {
    console.error('Jitsi authorize error:', error);
    res.status(500).json({ error: 'Failed to generate Jitsi token' });
  }
});

/**
 * POST /api/jitsi/invite
 *
 * Creates a guest invite link for a specific Jitsi room.
 * Requires authentication — only logged-in users can create invites.
 */
router.post('/invite', csrfProtection, authenticate, async (req: Request, res: Response) => {
  try {
    const { room, expires_in } = req.body;

    if (!room || typeof room !== 'string') {
      res.status(400).json({ error: 'room is required' });
      return;
    }

    // Sanitize room name (Jitsi room names are lowercase, allow hyphens and underscores)
    const sanitizedRoom = room.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!sanitizedRoom) {
      res.status(400).json({ error: 'Invalid room name' });
      return;
    }

    const expiresIn = expires_in || '2h';

    // Validate expires_in format (e.g., "1h", "2h", "30m")
    if (!/^\d+[hm]$/.test(expiresIn)) {
      res.status(400).json({ error: 'expires_in must be like "2h" or "30m"' });
      return;
    }

    const guestToken = tokenService.generateGuestInvite(sanitizedRoom, expiresIn);

    res.json({
      url: `https://meet.korczewski.de/${sanitizedRoom}?jwt=${guestToken}`,
      room: sanitizedRoom,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error('Jitsi invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite' });
  }
});

export default router;
