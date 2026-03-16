import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to authenticate internal service-to-service requests
 * using a shared API key via the x-internal-api-key header.
 *
 * The key is read from INTERNAL_API_KEY at request time so that
 * environment variables set after module load are respected (e.g. in tests).
 */
export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.INTERNAL_API_KEY || '';
  const key = req.headers['x-internal-api-key'] as string | undefined;
  if (!configuredKey || key !== configuredKey) {
    res.status(401).json({ error: 'Invalid or missing internal API key' });
    return;
  }
  next();
}
