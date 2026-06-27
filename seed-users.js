const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding local users to SQLite...');

  // Superadmin
  await prisma.user.upsert({
    where: { pin: '123456' },
    update: {},
    create: {
      name: 'Dueño (Superadmin)',
      pin: '123456',
      role: 'superadmin',
    },
  });

  // Admin Sucursal
  await prisma.user.upsert({
    where: { pin: '1111' },
    update: {},
    create: {
      name: 'Gerente Sucursal',
      pin: '1111',
      role: 'admin',
    },
  });

  // Cajero / Ventas
  await prisma.user.upsert({
    where: { pin: '2222' },
    update: {},
    create: {
      name: 'Cajero / Ventas',
      pin: '2222',
      role: 'sales',
    },
  });

  // Almacen
  await prisma.user.upsert({
    where: { pin: '3333' },
    update: {},
    create: {
      name: 'Bodeguero / Inventario',
      pin: '3333',
      role: 'inventory',
    },
  });

  console.log('Seed completed successfully. Users created: 123456 (Dueño), 1111 (Gerente), 2222 (Cajero), 3333 (Bodeguero)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
