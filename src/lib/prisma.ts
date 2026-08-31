import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  throw new Error('DATABASE_URL debe apuntar a PostgreSQL/Neon; no se permite una base SQLite local.');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
