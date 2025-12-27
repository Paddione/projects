import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Header names we support
export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation ID middleware.
 * - Reads X-Request-Id or X-Correlation-Id from incoming headers if present
 * - Otherwise generates a UUIDv4
 * - Attaches id to req.correlationId and sets response headers
 */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incomingId = (req.header(REQUEST_ID_HEADER) || req.header(CORRELATION_ID_HEADER) || '').trim();
  const id = incomingId || randomUUID();

  // Attach to request for downstream logging
  (req as any).correlationId = id;

  // Echo back headers for tracing across services
  res.setHeader(REQUEST_ID_HEADER, id);
  res.setHeader(CORRELATION_ID_HEADER, id);

  next();
}

export type RequestWithCorrelation = Request & { correlationId?: string };
