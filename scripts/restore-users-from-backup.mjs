/**
 * restore-users-from-backup.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Restaura usuarios y PINs desde un archivo backup.db (SQLite) al dev.db activo.
 *
 * Uso:
 *   node scripts/restore-users-from-backup.mjs [ruta-al-backup.db]
 *
 * Si no se pasa argumento, busca en estos paths por defecto:
 *   - prisma/dev.db.bak
 *   - prisma/dev.db.backup.20260711-135533
 *   - backup.db
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, copyFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ─── 1. Localizar el backup ──────────────────────────────────────────────────
const defaultBackupPaths = [
  join(ROOT, 'backup.db'),
  join(ROOT, 'prisma', 'dev.db.bak'),
  join(ROOT, 'prisma', 'dev.db.backup.20260711-135533'),
];

let backupPath = process.argv[2] ? resolve(process.argv[2]) : null;

if (!backupPath) {
  backupPath = defaultBackupPaths.find(p => existsSync(p)) ?? null;
}

if (!backupPath || !existsSync(backupPath)) {
  console.error('❌  No se encontró backup.db.');
  console.error('   Pasa la ruta como argumento:');
  console.error('   node scripts/restore-users-from-backup.mjs C:\\ruta\\backup.db');
  process.exit(1);
}

console.log(`\n📦  Backup localizado: ${backupPath}`);

// ─── 2. Copiar backup a ubicación temporal para que Prisma lo lea ─────────────
const TEMP_BACKUP = join(ROOT, 'prisma', '_temp_restore_backup.db');
copyFileSync(backupPath, TEMP_BACKUP);
console.log(`📋  Copia temporal creada en: ${TEMP_BACKUP}`);

// ─── 3. Leer usuarios del backup ─────────────────────────────────────────────
const backupClient = new PrismaClient({
  datasources: { db: { url: `file:${TEMP_BACKUP}` } },
  log: [],
});

let backupUsers = [];
try {
  await backupClient.$connect();
  backupUsers = await backupClient.user.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\n👥  Usuarios encontrados en el backup: ${backupUsers.length}`);
  backupUsers.forEach(u =>
    console.log(`    • [${u.role.toUpperCase()}] ${u.name} (${u.email ?? 'sin email'}) — PIN: ${u.pin ? '✓' : '—'}  pinHash: ${u.pinHash ? '✓' : '—'}`)
  );
} finally {
  await backupClient.$disconnect();
  // Limpiar temp
  import('fs').then(({ unlinkSync }) => {
    try { unlinkSync(TEMP_BACKUP); } catch {}
  });
}

if (backupUsers.length === 0) {
  console.log('\n⚠️  El backup no contiene usuarios. Nada que restaurar.');
  process.exit(0);
}

// ─── 4. Hacer upsert en la DB activa ─────────────────────────────────────────
const activeClient = new PrismaClient({
  log: ['warn', 'error'],
});

try {
  await activeClient.$connect();

  const existingUsers = await activeClient.user.findMany({ select: { id: true, email: true, pin: true } });
  console.log(`\n🗄️  Usuarios actualmente en dev.db: ${existingUsers.length}`);

  let restored = 0;
  let skipped = 0;
  let updated = 0;

  for (const user of backupUsers) {
    // Verificar si ya existe por id o por email
    const existsById = existingUsers.find(e => e.id === user.id);
    const existsByEmail = user.email ? existingUsers.find(e => e.email === user.email) : null;
    const existsByPin = existingUsers.find(e => e.pin === user.pin);

    if (existsById) {
      // Actualizar pin y pinHash si el actual está vacío o distinto
      const needsUpdate =
        (user.pinHash && !existsById.pinHash) ||
        (user.pin && existsById.pin !== user.pin);

      if (needsUpdate) {
        await activeClient.user.update({
          where: { id: user.id },
          data: {
            pin: user.pin,
            pinHash: user.pinHash ?? undefined,
          },
        });
        console.log(`    🔄 Actualizado PIN de: ${user.name}`);
        updated++;
      } else {
        console.log(`    ⏭️  Sin cambios para: ${user.name}`);
        skipped++;
      }
    } else {
      // Insertar como nuevo — verificar que el PIN sea único
      if (existsByPin) {
        console.log(`    ⚠️  PIN duplicado para ${user.name}, asignando PIN temporal '${user.pin}_R'`);
        user.pin = user.pin + '_R';
      }

      try {
        await activeClient.user.create({
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            pin: user.pin,
            pinHash: user.pinHash,
            deviceId: user.deviceId,
            role: user.role,
            active: user.active,
            createdAt: user.createdAt,
            synced: user.synced,
          },
        });
        console.log(`    ✅ Restaurado: ${user.name} (${user.role})`);
        restored++;
      } catch (err) {
        console.error(`    ❌ Error al restaurar ${user.name}: ${err.message}`);
      }
    }
  }

  console.log(`
╔══════════════════════════════════════╗
║        RESTAURACIÓN COMPLETA         ║
╠══════════════════════════════════════╣
║  ✅ Restaurados (nuevos): ${String(restored).padStart(10)} ║
║  🔄 Actualizados (PIN):   ${String(updated).padStart(10)} ║
║  ⏭️  Sin cambios:          ${String(skipped).padStart(10)} ║
║  👥 Total procesados:     ${String(backupUsers.length).padStart(10)} ║
╚══════════════════════════════════════╝
`);
} finally {
  await activeClient.$disconnect();
}
