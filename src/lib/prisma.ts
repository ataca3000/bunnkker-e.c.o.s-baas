import { PrismaClient } from '@prisma/client';
import path from 'path';

const projectRoot = process.cwd();
const defaultDbPath = path.resolve(projectRoot, 'prisma/dev.db');
const envUrl = process.env.DATABASE_URL || `file:${defaultDbPath}`;

// Resolver ruta relativa file:./prisma/dev.db a ruta absoluta dinamica en tiempo de ejecucion
const dbUrl = envUrl.startsWith('file:') && !path.isAbsolute(envUrl.substring(5))
  ? `file:${path.resolve(projectRoot, envUrl.substring(5))}`
  : envUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

if (!globalForPrisma.prisma) {
  prisma.$connect().then(async () => {
    try {
      await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA temp_store = MEMORY;`);
      await prisma.$executeRawUnsafe(`PRAGMA cache_size = -20000;`); // 20MB cache RAM
    } catch (err) {
      console.warn('⚠️ [Edge Database] Error en pragmas SQLite:', err);
    }
  }).catch(() => {});
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
