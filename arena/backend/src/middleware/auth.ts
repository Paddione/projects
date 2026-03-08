import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
    userId: number;
    username: string;
    email: string;
    role: string;
}

/**
 * Extract user from Traefik ForwardAuth headers.
 */
export function extractAuthUser(req: Request): AuthUser | null {
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
 * Middleware that attaches auth headers to req.user.
 * Traefik ForwardAuth already rejects unauthenticated requests at the ingress layer.
 */
export function attachAuthUser(req: Request, _res: Response, next: NextFunction): void {
    (req as any).user = extractAuthUser(req);
    next();
}
