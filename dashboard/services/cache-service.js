/**
 * Cache Service for kubectl proxy API responses
 * Provides in-memory caching with TTL support
 */

class CacheService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Get a value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or null if expired/missing
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    /**
     * Set a value in cache with TTL
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttlMs - Time to live in milliseconds
     */
    set(key, value, ttlMs) {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlMs
        });
    }

    /**
     * Delete a specific cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clear expired entries from cache
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Default TTL values in milliseconds
const CACHE_TTL = {
    HEALTH: 5000,        // 5 seconds
    METRICS: 10000,      // 10 seconds
    RESOURCES: 15000,    // 15 seconds
    VERSION: 300000,     // 5 minutes
    TRAEFIK: 15000,      // 15 seconds
    HELM: 30000          // 30 seconds
};

module.exports = { CacheService, CACHE_TTL };
