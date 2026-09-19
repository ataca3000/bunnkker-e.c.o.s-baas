/**
 * seed-sucursal.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Seed de usuarios base para nuevas sucursales BUNKKER E.C.O.S.
 *
 * Se ejecuta automáticamente en:
 *   - npm run setup:sucursal   → instalación inicial de una sucursal nueva
 *   - npm run dev              → si la tabla User está vacía al arrancar
 *
 * PINs por defecto (cambiar después del primer login):
 *   0000 → Super Admin      (superadmin)
 *   1111 → Cajero Principal (caja)
 *   2222 → Cajero / Ventas  (sales)
 *   3333 → Bodeguero        (inventory)
 *   4444 → Diseñador        (marketing)
 *   5555 → Chofer           (driver)
 *   6666 → Patio / Carga    (carga_descarga)
 *   7777 → Mostrador/PickUp (pickup)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: [] });

const USUARIOS_BASE = [
  { id: 'usr-superadmin-default', pin: 'A0000', role: 'superadmin',    name: 'Super Admin',              active: true },
  { id: 'usr-caja-default',       pin: 'A1111', role: 'caja',          name: 'Cajero Principal',          active: true },
  { id: 'usr-ventas-default',     pin: 'A2222', role: 'sales',         name: 'Cajero / Ventas',           active: true },
  { id: 'usr-bodega-default',     pin: 'A3333', role: 'inventory',     name: 'Bodeguero / Inventario',    active: true },
  { id: 'usr-mkt-default',        pin: 'A4444', role: 'marketing',     name: 'Diseñador / Marketing',     active: true },
  { id: 'usr-chofer-default',     pin: 'A5555', role: 'driver',        name: 'Chofer / Repartidor',       active: true },
  { id: 'usr-patio-default',      pin: 'A6666', role: 'carga_descarga',name: 'Patio / Carga y Descarga',  active: true },
  { id: 'usr-pickup-default',     pin: 'A7777', role: 'pickup',        name: 'Mostrador / Pick Up',       active: true },
];

export async function seedUsuariosSucursal(force = false) {
  try {
    await db.$connect();

    const existing = await db.user.count();

    if (existing > 0 && !force) {
      console.log(`ℹ️  [seed-sucursal] Ya existen ${existing} usuarios. Omitiendo seed.`);
      console.log(`   Usa force=true o npm run seed:usuarios para forzar.`);
      return { seeded: 0, skipped: existing };
    }

    if (force && existing > 0) {
      // En modo force: limpiar usuarios con PIN largo (hashes) y dejar solo numéricos
      const conHashLargo = await db.user.findMany({
        where: { NOT: { pin: { in: ['A0000', 'A1111', 'A2222', 'A3333', 'A4444', 'A5555', 'A6666', 'A7777', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777'] } } },
        select: { id: true, name: true, pin: true },
      });
      if (conHashLargo.length > 0) {
        await db.user.deleteMany({ where: { id: { in: conHashLargo.map(u => u.id) } } });
        console.log(`🧹 [seed-sucursal] Limpiados ${conHashLargo.length} usuarios con PIN hash`);
      }
    }

    let seeded = 0;
    let skipped = 0;

    for (const usuario of USUARIOS_BASE) {
      const existe = await db.user.findUnique({ where: { id: usuario.id } });
      const existePin = await db.user.findUnique({ where: { pin: usuario.pin } });

      if (existe) {
        skipped++;
        continue;
      }

      if (existePin) {
        // PIN ya usado por otro usuario — actualizar el existente con el ID canónico
        await db.user.update({
          where: { pin: usuario.pin },
          data: { id: usuario.id, name: usuario.name, role: usuario.role, active: usuario.active, pinHash: null },
        });
        console.log(`  🔄 Normalizado: ${usuario.name} (PIN ${usuario.pin})`);
        seeded++;
        continue;
      }

      await db.user.create({
        data: {
          id:       usuario.id,
          name:     usuario.name,
          pin:      usuario.pin,
          pinHash:  null,
          role:     usuario.role,
          active:   usuario.active,
          synced:   false,
        },
      });
      console.log(`  ✅ Creado: [${usuario.role.padEnd(14)}] ${usuario.name} → PIN ${usuario.pin}`);
      seeded++;
    }

    console.log(`\n🏪 [seed-sucursal] Listo: ${seeded} usuarios creados/normalizados, ${skipped} ya existían.`);
    return { seeded, skipped };

  } catch (err) {
    console.error('❌ [seed-sucursal] Error:', err.message);
    throw err;
  } finally {
    await db.$disconnect();
  }
}

// ── Ejecución directa: node scripts/seed-sucursal.mjs [--force] ──────────────
const esEjecucionDirecta = process.argv[1]?.endsWith('seed-sucursal.mjs');
if (esEjecucionDirecta) {
  const force = process.argv.includes('--force');
  console.log(`\n🏪 BUNKKER E.C.O.S. — Seed de Sucursal ${force ? '(FORZADO)' : ''}`);
  console.log('─'.repeat(50));
  await seedUsuariosSucursal(force);
}
