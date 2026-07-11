import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

import { exec } from 'child_process'

// Travesía dinámica hacia arriba para encontrar la raíz del proyecto y resolver prisma/dev.db
let projectRoot = process.cwd();
// Primero buscar por la presencia de playwright.config.ts (para desarrollo y tests locales)
while (projectRoot && !fs.existsSync(path.join(projectRoot, 'playwright.config.ts'))) {
  const parent = path.dirname(projectRoot);
  if (parent === projectRoot) break;
  projectRoot = parent;
}
// Si no se encontró (ej. en producción sin tests), usar fallback standard de package.json
if (!fs.existsSync(path.join(projectRoot, 'playwright.config.ts'))) {
  projectRoot = process.cwd();
  while (projectRoot && !fs.existsSync(path.join(projectRoot, 'package.json'))) {
    const parent = path.dirname(projectRoot);
    if (parent === projectRoot) break;
    projectRoot = parent;
  }
}

// Protege el archivo local SQLite restringiendo sus permisos en disco
try {
  let dbPath = path.join(projectRoot, 'prisma', 'dev.db');
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    const rawPath = process.env.DATABASE_URL.substring(5);
    dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(projectRoot, rawPath);
  }
  if (fs.existsSync(dbPath)) {
    if (process.platform === 'win32') {
      // En Windows, eliminamos herencia de permisos y damos acceso exclusivo al usuario actual
      exec(`icacls "${dbPath}" /inheritance:r /grant:r "%USERNAME%":(R,W)`, (err) => {
        if (err) {
          if (err.message.includes('Acceso denegado') || err.message.includes('denegado')) {
            console.log('[SECURITY] Archivo dev.db ya protegido o bloqueado en uso.');
          } else {
            console.warn('[SECURITY] No se pudo restringir permisos de dev.db en Windows:', err.message);
          }
        } else {
          console.log('[SECURITY] Archivo dev.db protegido con ACLs de Windows (propietario exclusivo).');
        }
      });
    } else {
      // 0o600: solo lectura y escritura para el propietario en UNIX/POSIX
      fs.chmodSync(dbPath, 0o600);
      console.log('[SECURITY] Archivo dev.db local protegido con permisos 0600.');
    }
  }
} catch (e) {
  console.warn('[SECURITY] No se pudo restringir permisos de dev.db local:', e);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const fallbackDbPath = path.resolve(projectRoot, 'prisma/dev.db');
const dbUrl = process.env.DATABASE_URL || `file:${fallbackDbPath}`;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
})

// [OPTIMIZACIÓN MODO COLMENA]
// Inyectamos configuraciones nativas de SQLite para evitar bloqueos en el Enjambre P2P
if (!globalForPrisma.prisma) {
  prisma.$connect().then(async () => {
    try {
      await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await prisma.$executeRawUnsafe(`PRAGMA temp_store = MEMORY;`);
      await prisma.$executeRawUnsafe(`PRAGMA cache_size = -20000;`); // 20MB cache
      console.log('🐝 [Edge Database] Pragmas SQLite activados: WAL Mode & Memory Cache.');
    } catch (err) {
      console.warn('⚠️ [Edge Database] Error activando Pragmas SQLite:', err);
    }
  }).catch(console.error);
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

