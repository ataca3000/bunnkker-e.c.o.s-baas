/**
 * LRU CACHE ENGINE (Least Recently Used Cache)
 * Caché de alta velocidad en memoria RAM (<5ms) para consultas de productos e inventario.
 * Sincronizado dinámicamente con las mutaciones de SQLite / Prisma.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private capacity: number;
  private ttlMs: number;
  private cache: Map<K, CacheEntry<V>>;

  constructor(capacity: number = 1000, ttlMs: number = 60000) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  public get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh position for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  public set(key: K, value: V, customTtlMs?: number) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Evict oldest item (first key in map iterator)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    const expiresAt = Date.now() + (customTtlMs || this.ttlMs);
    this.cache.set(key, { value, expiresAt });
  }

  public invalidate(key: K) {
    this.cache.delete(key);
  }

  public clear() {
    this.cache.clear();
  }
}

// Instancia global para productos e inventario
export const productLRUCache = new LRUCache<string, any>(1000, 300000); // 5 min TTL
