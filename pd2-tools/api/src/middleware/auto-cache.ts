import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { getCacheValue, setCacheValue } from "../utils/cache";
import { logger as mainLogger } from "../config";

const logger = mainLogger.createNamedLogger("AutoCache");

/**
 * Normalize a query parameter value for consistent cache keys
 */
function normalizeQueryValue(key: string, value: any): any {
  if (typeof value !== "string") {
    return value;
  }

  // Handle skills parameter (URL-encoded JSON array)
  if (key === "skills") {
    try {
      const decoded = decodeURIComponent(value);
      const parsed = JSON.parse(decoded);

      if (Array.isArray(parsed)) {
        // Sort array by skill name for consistent ordering
        const sorted = parsed.sort((a, b) => {
          if (a.name < b.name) return -1;
          if (a.name > b.name) return 1;
          return 0;
        });
        return JSON.stringify(sorted);
      }
    } catch {
      // Invalid JSON, return as-is
      return value;
    }
  }

  // Handle comma-separated values (classes, items, etc.)
  if (value.includes(",")) {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .sort()
      .join(",");
  }

  return value;
}

/**
 * Generate a consistent cache key from request path and query params
 */
function generateCacheKey(path: string, query: any): string {
  // Sort query param keys
  const sortedKeys = Object.keys(query).sort();

  // Normalize each value
  const normalized: Record<string, any> = {};
  for (const key of sortedKeys) {
    normalized[key] = normalizeQueryValue(key, query[key]);
  }

  // Create deterministic string representation
  const normalizedStr = JSON.stringify(normalized);

  // Hash for short, collision-resistant keys (full SHA256 - 32 chars)
  const hash = createHash("sha256").update(normalizedStr).digest("hex");

  return `auto:${path}:${hash}`;
}

/**
 * Auto-cache middleware - caches all GET requests
 */
export function autoCache(ttl: number = 900) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const cacheKey = generateCacheKey(req.path, req.query);

    try {
      // Check cache
      const cached = await getCacheValue(cacheKey);
      if (cached) {
        logger.debug(`Cache HIT: ${req.path}`, {
          key: cacheKey,
          query: req.query,
        });
        return res.json(cached);
      }

      logger.debug(`Cache MISS: ${req.path}`, {
        key: cacheKey,
        query: req.query,
      });

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        // Fire and forget - don't block response on cache write
        setCacheValue(cacheKey, data, ttl).catch((err) => {
          logger.error("Failed to cache response", {
            key: cacheKey,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        return originalJson(data);
      };

      next();
    } catch (err) {
      logger.error("Auto-cache middleware error, continuing without cache", {
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
      });
      next();
    }
  };
}
