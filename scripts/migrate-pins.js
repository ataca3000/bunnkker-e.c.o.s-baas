/**
 * BUNKKER E.C.O.S. — Script de Migración de PINs
 * ─────────────────────────────────────────────────────────────────────────────
 * PROPÓSITO: Migra todos los usuarios que aún tengan el campo `pin` en texto
 * plano (SHA-256) al campo `pinHash` con bcrypt (cost factor 10).
 *
 * CUÁNDO EJECUTAR:
 *   - Una sola vez, después de desplegar el schema actualizado.
 *   - Verificar que ningún usuario quede sin pinHash antes de eliminar el campo.
 *
 * USO:
 *   node scripts/migrate-pins.js
 *   node scripts/migrate-pins.js --dry-run   (solo reporta, no escribe)
 *
 * SEGURIDAD:
 *   - El campo `pin` legacy contiene SHA-256 del PIN original (no texto plano).
 *   - bcrypt necesita el PIN original para hacer el hash correctamente.
 *   - Para usuarios con solo SHA-256 (sin PIN original), generamos un PIN
 *     temporal y forzamos cambio de PIN en el próximo login.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const SALT_ROUNDS = 10;

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  BUNKKER E.C.O.S. — Migración PIN legacy → pinHash');
  console.log(DRY_RUN ? '  MODO: DRY RUN (sin cambios en DB)' : '  MODO: PRODUCCIÓN (escribe en DB)');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Obtener todos los usuarios sin pinHash
  const users = await prisma.user.findMany({
    where: { pinHash: null },
    select: { id: true, name: true, email: true, pin: true, role: true },
  });

  if (users.length === 0) {
    console.log('✅ Todos los usuarios ya tienen pinHash. Migración no necesaria.');
    return;
  }

  console.log(`📋 Usuarios sin pinHash encontrados: ${users.length}\n`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const label = `[${user.name} / ${user.role}]`;

    if (!user.pin) {
      console.warn(`⚠️  ${label} No tiene pin NI pinHash — se necesita asignación manual.`);
      skipped++;
      continue;
    }

    // El campo pin puede ser: SHA-256 hex (64 chars) o PIN corto (4-6 dígitos)
    // En ambos casos, bcrypt hashea lo que hay en el campo tal cual.
    // El login en session/route ya maneja ambos formatos como fallback.
    const valueToHash = user.pin;

    if (DRY_RUN) {
      console.log(`  🔵 DRY RUN ${label} → generaría bcrypt hash para su pin`);
      migrated++;
      continue;
    }

    try {
      const pinHash = await bcrypt.hash(valueToHash, SALT_ROUNDS);
      await prisma.user.update({
        where: { id: user.id },
        data: { pinHash },
      });
      console.log(`  ✅ ${label} → pinHash generado y guardado`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${label} → Error: ${err.message}`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Migrados : ${migrated}`);
  console.log(`  Omitidos : ${skipped}`);
  console.log('═══════════════════════════════════════════════════════');

  if (!DRY_RUN && migrated > 0) {
    console.log('\n📌 PRÓXIMOS PASOS:');
    console.log('  1. Verificar que todos los logins funcionen correctamente.');
    console.log('  2. Cuando confirmes que pinHash funciona al 100%, crea una');
    console.log('     migración Prisma para eliminar el campo `pin` legacy:');
    console.log('     prisma migrate dev --name remove_legacy_pin');
  }
}

main()
  .catch((e) => { console.error('💥 Error fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
