import Redis from 'ioredis';

// Evita múltiples conexiones en desarrollo con hot-reloading
declare global {
  var redis: Redis | undefined;
}

export const redis =
  global.redis ||
  new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // No reintentar en comandos fallidos
  });

if (process.env.NODE_ENV !== 'production') global.redis = redis;