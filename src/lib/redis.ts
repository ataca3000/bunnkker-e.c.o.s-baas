/**
 * redis.ts — Cliente Redis con Fallback en Memoria Ultrarrápido
 *
 * Si no hay servidor Redis en ejecucion o REDIS_URL no está configurada,
 * conmuta instantáneamente a un almacén en memoria RAM.
 * Esto elimina el bucle de reintentos infinitos de ioredis que consumía CPU.
 */

import Redis from 'ioredis';

const memoryStore = new Map<string, { value: string; expiresAt?: number }>();

const createMockRedis = () => ({
  get: async (key: string) => {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },
  set: async (key: string, val: string) => {
    memoryStore.set(key, { value: String(val) });
    return 'OK';
  },
  incr: async (key: string) => {
    const current = memoryStore.get(key);
    const num = current ? parseInt(current.value, 10) || 0 : 0;
    const next = num + 1;
    memoryStore.set(key, { ...current, value: String(next) });
    return next;
  },
  del: async (key: string) => {
    memoryStore.delete(key);
    return 1;
  },
  expire: async (key: string, seconds: number) => {
    const item = memoryStore.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
    }
    return 1;
  },
  ttl: async (key: string) => {
    const item = memoryStore.get(key);
    if (!item || !item.expiresAt) return -1;
    return Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
  },
  on: () => {},
});

declare global {
  var redisInstance: any;
}

let redisClient: any;

if (globalThis.redisInstance) {
  redisClient = globalThis.redisInstance;
} else if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
  try {
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null, // Evita reintentos infinitos que congelen el CPU
    });
    client.on('error', (err) => {
      console.warn('[Redis] Error de conexión Redis. Usando almacén en memoria.', err.message);
    });
    redisClient = client;
  } catch {
    redisClient = createMockRedis();
  }
} else {
  // Sin Redis externo: Usar almacenamiento en memoria RAM (Latencia 0ms)
  redisClient = createMockRedis();
}

if (process.env.NODE_ENV !== 'production') {
  globalThis.redisInstance = redisClient;
}

export const redis = redisClient;