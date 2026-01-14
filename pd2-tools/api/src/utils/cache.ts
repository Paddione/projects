import { createClient, RedisClientType } from "redis";
import { logger as mainLogger } from "../config";
import { config } from "../config";

const logger = mainLogger.createNamedLogger("Cache");

// Redis client
let redis: RedisClientType;
let isRedisReady = false;

/**
 * Initialize Redis client
 */
export async function initializeRedis(): Promise<void> {
  try {
    redis = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error("Redis reconnection failed after 10 attempts");
            return new Error("Max reconnection attempts reached");
          }
          return Math.min(retries * 50, 500);
        },
        connectTimeout: 5000,
      },
      password: config.redis.password,
    });

    redis.on("error", (err) => {
      logger.error("Redis error", { error: err.message });
      isRedisReady = false;
    });

    redis.on("connect", () => {
      logger.info("Redis connecting...");
    });

    redis.on("ready", () => {
      logger.info("Redis connected and ready");
      isRedisReady = true;
    });

    redis.on("reconnecting", () => {
      logger.warn("Redis reconnecting...");
      isRedisReady = false;
    });

    redis.on("end", () => {
      logger.warn("Redis connection closed");
      isRedisReady = false;
    });

    await redis.connect();
  } catch (err) {
    logger.error("Failed to initialize Redis", {
      error: err instanceof Error ? err.message : String(err),
    });
    isRedisReady = false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis && redis.isOpen) {
    await redis.quit();
    logger.info("Redis connection closed");
  }
}

/**
 * Get a value from cache
 */
export async function getCacheValue<T>(key: string): Promise<T | undefined> {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      logger.debug("Redis not available, skipping cache GET", { key });
      return undefined;
    }

    const value = await redis.get(key);
    if (!value) {
      return undefined;
    }

    logger.debug(`Cache HIT: ${key}`);
    return JSON.parse(value) as T;
  } catch (err) {
    logger.error("Redis GET error, falling back to DB", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Set a value in cache
 */
export async function setCacheValue<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<boolean> {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      logger.debug("Redis not available, skipping cache SET", { key });
      return false;
    }

    await redis.setEx(key, ttl || 900, JSON.stringify(value));
    logger.debug(`Cache SET: ${key} (TTL: ${ttl || 900}s)`);
    return true;
  } catch (err) {
    logger.error("Redis SET error, continuing without cache", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Delete a value from cache
 */
export async function deleteCacheValue(key: string): Promise<number> {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      return 0;
    }

    return await redis.del(key);
  } catch (err) {
    logger.error("Redis DELETE error", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Delete multiple values by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      return 0;
    }

    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    return await redis.del(keys);
  } catch (err) {
    logger.error("Redis DELETE pattern error", {
      pattern,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      logger.warn("Redis not available, cannot clear cache");
      return;
    }

    await redis.flushDb();
    logger.info("Cache cleared");
  } catch (err) {
    logger.error("Redis FLUSH error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    if (!isRedisReady || !redis?.isOpen) {
      return {
        available: false,
        message: "Redis not available",
      };
    }

    const info = await redis.info("stats");
    const memory = await redis.info("memory");
    const dbSize = await redis.dbSize();

    return {
      available: true,
      dbSize,
      info,
      memory,
    };
  } catch (err) {
    logger.error("Redis INFO error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      available: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if Redis is ready
 */
export function isRedisAvailable(): boolean {
  return isRedisReady && redis?.isOpen === true;
}
