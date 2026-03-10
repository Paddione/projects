import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';

export interface AuthUser {
    userId: number;
    username: string;
    email: string;
    role: string;
}

/**
 * Extract user from Traefik ForwardAuth headers (if present).
 */
function extractFromHeaders(req: Request): AuthUser | null {
    const userId = req.headers['x-auth-user-id'];
    const username = req.headers['x-auth-user'];
    const email = req.headers['x-auth-email'];
    const role = req.headers['x-auth-role'];

    const userIdStr = Array.isArray(userId) ? userId[0] : userId;
    const usernameStr = Array.isArray(username) ? username[0] : username;
    const emailStr = Array.isArray(email) ? email[0] : email;
    const roleStr = Array.isArray(role) ? role[0] : role;

    if (userIdStr) {
        return {
            userId: parseInt(userIdStr, 10),
            username: usernameStr || emailStr?.split('@')[0] || 'player',
            email: emailStr || '',
            role: roleStr || 'USER',
        };
    }
    return null;
}

/**
 * Verify session cookie against auth service (same pattern as SocketService).
 */
async function verifyViaCookie(req: Request): Promise<AuthUser | null> {
    const cookie = req.headers.cookie;
    if (!cookie) return null;

    try {
        const res = await fetch(`${config.auth.authServiceUrl}/api/auth/verify`, {
            headers: { cookie },
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) return null;

        const userId = res.headers.get('x-auth-user-id');
        const username = res.headers.get('x-auth-user');
        const email = res.headers.get('x-auth-email');
        const role = res.headers.get('x-auth-role');

        const parsedUserId = parseInt(userId ?? '', 10);
        if (!userId || isNaN(parsedUserId)) return null;

        return {
            userId: parsedUserId,
            username: username || email?.split('@')[0] || 'player',
            email: email || '',
            role: role || 'USER',
        };
    } catch {
        return null;
    }
}

/**
 * Middleware that resolves auth from Traefik headers or session cookie.
 * Public routes check req.user themselves; this never rejects.
 */
export async function attachAuthUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
    (req as any).user = extractFromHeaders(req) ?? await verifyViaCookie(req);
    next();
}
