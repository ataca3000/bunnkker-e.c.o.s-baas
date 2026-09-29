/**
 * migrate-pins.js
 * ────────────────────────────────────────────────────────────────────────────
 * S4.1 FIX — Script idempotente de migración de PINs legacy → bcrypt hash
 *
 * ⚠️  EJECUTAR UNA SOLA VEZ después de hacer `prisma migrate dev`.
 *
 * Uso:
 *   node scripts/migrate-pins.js
 *
 * Qué hace:
 *   1. Lee todos los User con pinHash = null (PINs sin hashear).
 *   2. Detecta si el pin es texto plano o SHA-256 hex (64 chars).
 *   3. Hashea con bcrypt (cost factor 10) y guarda en pinHash.
 *   4. Si pin es null, asigna un PIN temporal de 4 dígitos.
 *   5. Informa el PRÓXIMO PASO para deprecar el campo legacy.
 *
 * IDEMPOTENTE: usuarios con pinHash existente se saltan automáticamente.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
    console.log('🔒 [migrate-pins] Iniciando migración de PINs a bcrypt...\n');

    const users = await prisma.user.findMany({
        where: { pinHash: null }
    });

    console.log(`   Encontrados ${users.length} usuarios con PIN sin hashear.\n`);

    if (users.length === 0) {
        console.log('✅ No hay PINs que migrar. Todo está actualizado.');
        return;
    }

    let migrated = 0;
    let errors   = 0;

    for (const user of users) {
        try {
            let pinToHash = user.pin;

            if (!pinToHash) {
                // pin es null — generar temporal de 4 dígitos
                pinToHash = String(Math.floor(1000 + Math.random() * 9000));
                console.warn(`   ⚠️  ${user.name}: sin PIN. Se asignó temporal: ${pinToHash}. Resetear manualmente.`);
            } else {
                // Detectar formato: SHA-256 hex (64 chars) o texto plano
                const isSha256 = /^[a-f0-9]{64}$/.test(pinToHash);
                if (isSha256) {
                    console.log(`   🔎 ${user.name}: PIN detectado como SHA-256 legacy.`);
                }
            }

            const pinHash = await bcrypt.hash(pinToHash, SALT_ROUNDS);
            await prisma.user.update({
                where: { id: user.id },
                data: { pinHash }
            });
            migrated++;
            console.log(`   ✅ ${user.name} (${user.role}) → PIN hasheado correctamente`);
        } catch (err) {
            console.error(`   ❌ Error con usuario ${user.name}:`, err.message);
            errors++;
        }
    }

    console.log(`\n🎉 Migración: ${migrated}/${users.length} usuarios actualizados. Errores: ${errors}`);
    console.log('   Los PINs originales se conservan en el campo legacy "pin".');
    console.log('\n   PRÓXIMO PASO — una vez verificado que todos los usuarios pueden logear:');
    console.log('   1. Edita prisma/schema.prisma: cambia `pin String @unique` → `pin String? @unique`');
    console.log('   2. Ejecuta: npx prisma migrate dev --name make_pin_nullable');
    console.log('   3. En la siguiente release: DROP COLUMN pin\n');
}

main()
    .catch(err => {
        console.error('❌ Error fatal en migración:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
