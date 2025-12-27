import express, { type Express } from 'express';
import session from 'express-session';
import connectPgSimpleInit from 'connect-pg-simple';
import { registerRoutes } from '../../server/routes';
import { globalErrorHandler } from '../../server/middleware/errorHandler';
import type { Server } from 'http';

export function createTestServer(setupRoutes?: (app: Express) => void) {
  const app = express();
  app.set('env', 'test');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // minimal session setup (memory store in tests)
  const SESSION_SECRET = 'testsecret';
  const PgStore = connectPgSimpleInit(session);
  // Do not supply a store (so express-session will use MemoryStore) during tests
  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 },
    }),
  );

  // In tests, return the Express app directly to Supertest to avoid binding to a port
  const httpServer = registerRoutes(app);

  // Add request ID middleware mock
  app.use((req, _res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || 'test-req-id';
    next();
  });

  if (setupRoutes) {
    setupRoutes(app);
  }

  app.use(globalErrorHandler);

  return { app, httpServer };
}
