import express, { Application } from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import { config, logger as mainLogger } from "./config";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { rateLimiter } from "./middleware/rate-limit";
import routes from "./routes";

const logger = mainLogger.createNamedLogger("API");

export function createServer(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));

  // Body parsing middleware
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Compression middleware
  app.use(compression());

  // Rate limiting
  app.use(rateLimiter);

  // Proxy (cf + nginx, don't need to modify for dev as can just increase rate limit for testing)
  app.set("trust proxy", 2);

  // API routes
  app.use(`/api/${config.apiVersion}`, routes);

  // Root route
  app.get("/", (_req, res) => {
    res.json({
      name: "PD2 Tools API",
      version: config.apiVersion,
      status: "running",
    });
  });

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startServer(app: Application): void {
  const port = config.port;

  app.listen(port, () => {
    logger.info(`Server started on port ${port}`, {
      environment: config.nodeEnv,
      apiVersion: config.apiVersion,
    });
  });
}
