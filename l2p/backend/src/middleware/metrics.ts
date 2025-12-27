import { Request, Response, NextFunction } from 'express';
import { collectDefaultMetrics, Histogram, Registry, Counter, Gauge } from 'prom-client';

// Create a dedicated registry to avoid polluting global when running tests
export const metricsRegistry = new Registry();

// Collect default Node.js process metrics
collectDefaultMetrics({ register: metricsRegistry });

// Histogram for request duration
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  registers: [metricsRegistry],
  labelNames: ['method', 'route', 'status_code', 'success'] as const,
  buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 10]
});

// Counter for total HTTP requests (throughput)
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  registers: [metricsRegistry],
  labelNames: ['method', 'route', 'status_code'] as const
});

// Counter for total HTTP errors (4xx and 5xx) to enable error rate panels
const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP error responses (status >= 400)',
  registers: [metricsRegistry],
  labelNames: ['method', 'route', 'status_code'] as const
});

// Gauge for in-flight requests (saturation)
const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  registers: [metricsRegistry],
  labelNames: ['route'] as const
});

function getRouteLabel(req: Request): string {
  // Prefer Express route path if available, fall back to baseUrl or url
  // This avoids high-cardinality metrics from full URLs with IDs.
  const route = (req as any).route?.path || (req.baseUrl ? req.baseUrl : req.path || req.url);
  if (!route) return 'unknown';
  // Normalize trailing slashes
  return typeof route === 'string' ? route.replace(/\/$/, '') || '/' : String(route);
}

export function httpRequestTimer(req: Request, res: Response, next: NextFunction) {
  // Increment saturation gauge at start
  const routeLabelStart = getRouteLabel(req);
  httpRequestsInFlight.labels({ route: routeLabelStart }).inc();

  const end = httpRequestDuration.startTimer();
  const method = req.method;
  const routeLabel = getRouteLabel(req);

  res.on('finish', () => {
    const status = res.statusCode;
    const success = status < 500; // consider 5xx as failures
    end({
      method,
      route: routeLabel,
      status_code: String(status),
      success: String(success)
    } as any);

    // Record throughput
    httpRequestsTotal.labels({
      method,
      route: routeLabel,
      status_code: String(status)
    } as any).inc();

    // Record errors (both 4xx and 5xx)
    if (status >= 400) {
      httpErrorsTotal.labels({
        method,
        route: routeLabel,
        status_code: String(status)
      } as any).inc();
    }

    // Decrement saturation gauge when finished
    httpRequestsInFlight.labels({ route: routeLabelStart }).dec();
  });

  next();
}

// App-level cache metrics
export const appCacheHits = new Counter({
  name: 'app_cache_hits_total',
  help: 'Total number of app-level cache hits',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const
});

export const appCacheMisses = new Counter({
  name: 'app_cache_misses_total',
  help: 'Total number of app-level cache misses',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const
});

export const appCacheStaleHits = new Counter({
  name: 'app_cache_stale_hits_total',
  help: 'Total number of app-level stale-while-revalidate cache hits',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const
});

export const appCacheSets = new Counter({
  name: 'app_cache_sets_total',
  help: 'Total number of app-level cache set operations',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const
});

export const appCacheEvictions = new Counter({
  name: 'app_cache_evictions_total',
  help: 'Total number of app-level cache evictions/invalidations',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const
});

export const appCacheRefreshDuration = new Histogram({
  name: 'app_cache_refresh_duration_seconds',
  help: 'Duration of app-level cache refresh operations in seconds',
  registers: [metricsRegistry],
  labelNames: ['cache'] as const,
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});

// Export the main middleware function with the expected name
export const metricsMiddleware = httpRequestTimer;
