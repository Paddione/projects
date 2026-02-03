import type { Request, Response, NextFunction } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defense-in-depth middleware.
 * Requires a custom X-Requested-With header on state-changing API requests.
 * Browsers prevent cross-origin requests from setting custom headers without
 * a CORS preflight, so this blocks simple CSRF attacks even when SameSite
 * cookies are not enforced (e.g. older browsers).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    next();
    return;
  }

  const xRequestedWith = req.headers['x-requested-with'];
  if (!xRequestedWith) {
    res.status(403).json({ error: 'Missing X-Requested-With header' });
    return;
  }

  next();
}
