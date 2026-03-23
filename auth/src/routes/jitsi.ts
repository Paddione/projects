import express, { type Request, type Response } from 'express';
import { TokenService } from '../services/TokenService.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();
const tokenService = new TokenService();

// In-memory conference store (ephemeral — restarts clear it, which is fine)
interface Conference {
  id: string;
  room: string;
  name: string;
  createdBy: { userId: number; username: string; name: string | null };
  createdAt: string;
  guestUrl: string;
}
const conferences = new Map<string, Conference>();

// Cleanup conferences older than 24h every hour
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, conf] of conferences) {
    if (new Date(conf.createdAt).getTime() < cutoff) conferences.delete(id);
  }
}, 60 * 60 * 1000);

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

/**
 * GET /api/jitsi/conferences
 *
 * List all active conferences. Any authenticated user can see them.
 */
router.get('/conferences', authenticate, (_req: Request, res: Response) => {
  res.json({ conferences: Array.from(conferences.values()) });
});

/**
 * POST /api/jitsi/conferences
 *
 * Create a new conference. Generates a room, guest invite URL, and
 * makes it visible to all authenticated users.
 */
router.post('/conferences', authenticate, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Conference name is required' });
      return;
    }

    // Generate a room slug from the name
    const room = name.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'meeting';

    // Check for duplicate room
    for (const conf of conferences.values()) {
      if (conf.room === room) {
        res.status(409).json({ error: 'A conference with this room name already exists', conference: conf });
        return;
      }
    }

    // Fetch creator info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate guest invite URL (2h expiry)
    const guestToken = tokenService.generateGuestInvite(room, '4h');
    const guestUrl = `https://meet.korczewski.de/${room}?jwt=${guestToken}`;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const conference: Conference = {
      id,
      room,
      name: name.trim(),
      createdBy: { userId: user.id, username: user.username, name: user.name },
      createdAt: new Date().toISOString(),
      guestUrl,
    };

    conferences.set(id, conference);
    res.status(201).json({ conference });
  } catch (error) {
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Failed to create conference' });
  }
});

/**
 * DELETE /api/jitsi/conferences/:id
 *
 * End/remove a conference. Only the creator or admins can do this.
 */
router.delete('/conferences/:id', authenticate, (req: Request, res: Response) => {
  const conf = conferences.get(req.params.id);
  if (!conf) {
    res.status(404).json({ error: 'Conference not found' });
    return;
  }

  if (conf.createdBy.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only the creator or admin can end this conference' });
    return;
  }

  conferences.delete(req.params.id);
  res.json({ message: 'Conference ended' });
});

export default router;
