import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation ID middleware.
 * Reads X-Request-Id or X-Correlation-Id from incoming headers if present,
 * otherwise generates a UUIDv4. Attaches to req.correlationId and sets
 * response headers for cross-service tracing.
 */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incomingId = (req.header(REQUEST_ID_HEADER) || req.header(CORRELATION_ID_HEADER) || '').trim();
  const id = incomingId || randomUUID();

  (req as any).correlationId = id;

  res.setHeader(REQUEST_ID_HEADER, id);
  res.setHeader(CORRELATION_ID_HEADER, id);

  next();
}
