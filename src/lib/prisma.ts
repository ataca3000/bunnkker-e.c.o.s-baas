let PrismaClientClass: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prismaPkg = require('@prisma/client');
  PrismaClientClass = prismaPkg.PrismaClient;
} catch {
  // Graceful fallback if @prisma/client is not generated
}

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(url && (url.startsWith('postgresql://') || url.startsWith('postgres://')) && PrismaClientClass);
}

export function getPrisma(): any {
  if (!isDatabaseConfigured() || !PrismaClientClass) {
    return null;
  }
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  try {
    const client = new PrismaClientClass();
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = client;
    }
    return client;
  } catch (err) {
    console.warn('[Prisma] Error inicializando cliente Prisma:', err);
    return null;
  }
}

// Proxy transparente para que las importaciones de `prisma` funcionen sin romper la aplicación si no hay BD configurada
export const prisma = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    const client = getPrisma();
    if (!client) {
      if (prop === '$transaction') {
        return async (cb: any) => {
          if (typeof cb === 'function') {
            try {
              return await cb(prisma);
            } catch {
              return null;
            }
          }
          return null;
        };
      }
      return new Proxy({}, {
        get(_mTarget, mProp: string | symbol) {
          return async (..._args: any[]) => {
            const name = String(mProp);
            if (name === 'findMany' || name === 'deleteMany') return [];
            if (name === 'count') return 0;
            return null;
          };
        }
      });
    }
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

