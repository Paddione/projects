import { Request, Response, NextFunction } from 'express';

/**
 * Adds X-RateLimit-Warning header when remaining requests drop below 20% of limit.
 * Must be mounted AFTER express-rate-limit (which sets RateLimit-* headers).
 *
 * express-rate-limit with standardHeaders:true already sends:
 *   RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
 * This middleware reads those and adds a warning signal.
 */
export function rateLimitWarning(req: Request, res: Response, next: NextFunction) {
  const originalWriteHead = res.writeHead;

  res.writeHead = function (this: Response, ...args: Parameters<typeof res.writeHead>) {
    const limit = parseInt(res.getHeader('RateLimit-Limit') as string, 10);
    const remaining = parseInt(res.getHeader('RateLimit-Remaining') as string, 10);

    if (!isNaN(limit) && !isNaN(remaining) && limit > 0) {
      const threshold = Math.ceil(limit * 0.2);
      if (remaining <= threshold && remaining > 0) {
        res.setHeader('X-RateLimit-Warning', 'true');
      }
    }

    return originalWriteHead.apply(this, args);
  } as typeof res.writeHead;

  next();
}
