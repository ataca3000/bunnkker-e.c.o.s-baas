import { PrismaClient } from '@prisma/client';

// Prisma Client inicializado de forma segura y compatible con SQLite local y PostgreSQL cloud

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
