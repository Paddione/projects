import { AppError } from './errors.js';

// Use minimal Express-compatible types to avoid @types/express version conflicts
// when consumed as a file: dependency across multiple services.
interface Req {
  method: string;
  path: string;
}

interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

type NextFn = (err?: unknown) => void;
type Handler = (req: Req, res: Res, next: NextFn) => unknown;

/**
 * Wraps an async route handler so rejected promises are passed to next().
 * Eliminates try-catch boilerplate in every route.
 */
export const asyncHandler = (fn: Handler): Handler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Express error middleware. Mount as the last middleware in the chain.
 *
 * Recognizes:
 * - AppError subclasses (uses statusCode, code, details)
 * - Zod validation errors (ZodError with .issues)
 * - JWT errors (JsonWebTokenError, TokenExpiredError)
 * - Generic errors (500)
 */
export function errorHandler(
  err: Error & { statusCode?: number; code?: string; details?: unknown; issues?: unknown[] },
  req: Req,
  res: Res,
  _next: NextFn,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine status code
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    details = err.details;
  } else if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = (err.issues as Array<{ path: string[]; message: string }>).map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
  } else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    code = 'CORS_ERROR';
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    code = err.code || code;
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message, err.stack);
  }

  const body: Record<string, unknown> = {
    error: err.message || 'Internal server error',
    code,
    timestamp: new Date().toISOString(),
  };

  if (details) body.details = details;
  if (!isProduction && err.stack) body.stack = err.stack;

  res.status(statusCode).json(body);
}

/**
 * 404 handler for unmatched routes. Mount before errorHandler.
 */
export function notFoundHandler(req: Req, res: Res): void {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
}
