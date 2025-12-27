import { appCacheHits, appCacheMisses, appCacheStaleHits, appCacheSets, appCacheEvictions, appCacheRefreshDuration } from '../middleware/metrics.js';

export interface CacheEntry<V> {
  value: V;
  expiresAt: number;
  staleAt?: number;
  refreshing?: boolean;
}

export interface CacheOptions {
  ttlMs: number; // time to live for freshness
  staleWhileRevalidateMs?: number; // additional time window to serve stale while refreshing
}

export class TtlCache<K, V> {
  private store: Map<string, CacheEntry<V>> = new Map();
  private readonly namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  private keyToString(key: K): string {
    try {
      return typeof key === 'string' ? key : JSON.stringify(key);
    } catch {
      return String(key);
    }
  }

  get(key: K): CacheEntry<V> | undefined {
    const k = this.keyToString(key);
    const entry = this.store.get(k);
    if (!entry) {
      appCacheMisses.labels({ cache: this.namespace }).inc();
      return undefined;
    }
    const now = Date.now();
    if (entry.expiresAt > now) {
      appCacheHits.labels({ cache: this.namespace }).inc();
      return entry;
    }
    if (entry.staleAt && entry.staleAt > now) {
      appCacheStaleHits.labels({ cache: this.namespace }).inc();
      return entry;
    }
    // expired fully
    this.store.delete(k);
    appCacheMisses.labels({ cache: this.namespace }).inc();
    return undefined;
  }

  set(key: K, value: V, options: CacheOptions): void {
    const now = Date.now();
    const entry: CacheEntry<V> = {
      value,
      expiresAt: now + options.ttlMs,
      ...(options.staleWhileRevalidateMs ? { staleAt: now + options.ttlMs + options.staleWhileRevalidateMs } : {})
    };
    this.store.set(this.keyToString(key), entry);
    appCacheSets.labels({ cache: this.namespace }).inc();
  }

  async getOrRefresh(key: K, options: CacheOptions, refresher: () => Promise<V>): Promise<V> {
    const k = this.keyToString(key);
    const existing = this.store.get(k);
    const now = Date.now();

    if (existing) {
      if (existing.expiresAt > now) {
        appCacheHits.labels({ cache: this.namespace }).inc();
        return existing.value;
      }
      if (existing.staleAt && existing.staleAt > now) {
        // Kick off background refresh if not already
        if (!existing.refreshing) {
          existing.refreshing = true;
          const endTimer = appCacheRefreshDuration.startTimer();
          refresher().then((val) => {
            this.store.set(k, {
              value: val,
              expiresAt: Date.now() + options.ttlMs,
              ...(options.staleWhileRevalidateMs ? { staleAt: Date.now() + options.ttlMs + options.staleWhileRevalidateMs } : {}),
              refreshing: false
            });
          }).catch(() => {
            // Keep stale entry
          }).finally(() => {
            endTimer({ cache: this.namespace } as any);
            const updated = this.store.get(k);
            if (updated) updated.refreshing = false;
          });
        }
        appCacheStaleHits.labels({ cache: this.namespace }).inc();
        return existing.value;
      }
      // Fully expired; refresh synchronously
    }

    // Miss: refresh
    appCacheMisses.labels({ cache: this.namespace }).inc();
    const endTimer = appCacheRefreshDuration.startTimer();
    const val = await refresher();
    endTimer({ cache: this.namespace } as any);
    this.set(key, val, options);
    return val;
  }

  invalidate(key: K): void {
    const k = this.keyToString(key);
    if (this.store.delete(k)) {
      appCacheEvictions.labels({ cache: this.namespace }).inc();
    }
  }

  clear(): void {
    if (this.store.size > 0) {
      appCacheEvictions.labels({ cache: this.namespace }).inc(this.store.size);
    }
    this.store.clear();
  }
}
