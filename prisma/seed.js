if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

const initialStaffUsers = [
  ['Dueño (Superadmin)', 'superadmin', '0000', 'superadmin@bunnkker.local'],
  ['Gerente (Admin)', 'admin', '1111', 'admin@bunnkker.local'],
  ['Cajero / Ventas', 'sales', '2222', 'sales@bunnkker.local'],
  ['Bodeguero / Inventario', 'inventory', '3333', 'inventory@bunnkker.local'],
  ['Diseñador / Marketing', 'marketing', '4444', 'marketing@bunnkker.local'],
  ['Chofer / Repartidor', 'driver', '5555', 'driver@bunnkker.local'],
  ['Patio / Carga y Descarga', 'carga_descarga', '6666', 'patio@bunnkker.local'],
  ['Mostrador / Pick Up', 'pickup', '7777', 'pickup@bunnkker.local'],
];

async function main() {
  console.log('🌱 [Seed] Inicializando sistema limpio (tablas en blanco + PINs iniciales)...');

  // 1. Limpiar productos demo heredados si existieran para garantizar catálogo en blanco al iniciar como nuevo
  await prisma.product.deleteMany({
    where: {
      id: { in: ['PROD-101', 'PROD-102', 'PROD-103', 'PROD-104', 'PROD-105'] },
    },
  }).catch(() => {});

  // 2. Licencia y configuración inicial
  await prisma.appConfig.upsert({
    where: { id: 'global' },
    update: { licenseType: 'TRIAL', tenantId: 'default' },
    create: { id: 'global', licenseType: 'TRIAL', tenantId: 'default' },
  });
  console.log('✅ Configuración AppConfig lista (Licencia TRIAL activa).');

  // 3. Usuarios iniciales por rol (PINs 0000–7777)
  if (process.env.ALLOW_DEMO_SEED === 'false') {
    console.log('ℹ️ ALLOW_DEMO_SEED=false detectado: se omitió la creación de PINs iniciales.');
  } else {
    for (const [name, role, plainPin, email] of initialStaffUsers) {
      const pinHash = await bcrypt.hash(plainPin, 10);
      const pin = crypto.createHash('sha256').update(plainPin).digest('hex');
      await prisma.user.upsert({
        where: {
          tenantId_email: {
            tenantId: 'default',
            email,
          },
        },
        update: { name, role, pin, pinHash, active: true },
        create: { tenantId: 'default', name, role, email, pin, pinHash, active: true },
      });
    }
    console.log('✅ 8 usuarios iniciales configurados con PINs 0000–7777 (tablas operativas en blanco).');
  }

  console.log('🎉 Inicialización completada con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
