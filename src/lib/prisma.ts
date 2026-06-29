import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

import { exec } from 'child_process'

// Protege el archivo local SQLite restringiendo sus permisos en disco
try {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
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

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
