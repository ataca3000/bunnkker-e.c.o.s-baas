/**
 * migrate-pins.js
 * ────────────────────────────────────────────────────────────────────────────
 * Script ONE-TIME de migración para hashear los PINs en texto plano.
 * 
 * ⚠️  EJECUTAR UNA SOLA VEZ después de hacer `prisma migrate dev`.
 * 
 * Uso:
 *   node scripts/migrate-pins.js
 * 
 * Qué hace:
 *   1. Lee todos los User con pinHash = null (PINs sin hashear).
 *   2. Hashea cada PIN con bcrypt (cost factor 10).
 *   3. Guarda el hash en el campo pinHash.
 *   4. El campo 'pin' queda intacto hasta validar que todo funciona.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🔒 Iniciando migración de PINs a hashes bcrypt...\n');

    const users = await prisma.user.findMany({
        where: { pinHash: null }
    });

    console.log(`   Encontrados ${users.length} usuarios con PIN sin hashear.\n`);

    if (users.length === 0) {
        console.log('✅ No hay PINs que migrar. Todo está actualizado.');
        return;
    }

    let migrated = 0;
    const SALT_ROUNDS = 10;

    for (const user of users) {
        try {
            const pinHash = await bcrypt.hash(user.pin, SALT_ROUNDS);
            await prisma.user.update({
                where: { id: user.id },
                data: { pinHash }
            });
            migrated++;
            console.log(`   ✅ ${user.name} (${user.role}) → PIN hasheado correctamente`);
        } catch (err) {
            console.error(`   ❌ Error con usuario ${user.name}:`, err.message);
        }
    }

    console.log(`\n🎉 Migración completa: ${migrated}/${users.length} usuarios actualizados.`);
    console.log('   Los PINs originales se conservan en el campo legacy "pin".');
    console.log('   Puedes eliminarlos manualmente una vez verificado el login.\n');
}

main()
    .catch(err => {
        console.error('❌ Error fatal en migración:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
