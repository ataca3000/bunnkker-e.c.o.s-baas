const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando base de datos de clientes y órdenes...');
  
  // Limpieza total de clientes y transacciones para empezar en limpio
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.cashRegisterLog.deleteMany({});
  await prisma.syncQueue.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  
  console.log('👥 Seeding local users to SQLite...');

  // Eliminar usuarios previos para evitar conflictos de restricciones
  await prisma.user.deleteMany({});

  // 1. Superadmin (Dueño/Master) -> PIN 0000
  await prisma.user.create({
    data: {
      id: 'local_master',
      name: 'Dueño (Superadmin)',
      pin: '0000',
      role: 'superadmin',
      active: true,
    },
  });

  // 2. Admin (Gerente) -> PIN 1111
  await prisma.user.create({
    data: {
      name: 'Gerente (Admin)',
      pin: '1111',
      role: 'admin',
      active: true,
    },
  });

  // 3. Sales (Cajero/Ventas) -> PIN 2222
  await prisma.user.create({
    data: {
      name: 'Cajero / Ventas',
      pin: '2222',
      role: 'sales',
      active: true,
    },
  });

  // 4. Inventory (Bodeguero) -> PIN 3333
  await prisma.user.create({
    data: {
      name: 'Bodeguero / Inventario',
      pin: '3333',
      role: 'inventory',
      active: true,
    },
  });

  // 5. Marketing -> PIN 4444
  await prisma.user.create({
    data: {
      name: 'Diseñador / Marketing',
      pin: '4444',
      role: 'marketing',
      active: true,
    },
  });

  // 6. Driver (Chofer/Reparto) -> PIN 5555
  await prisma.user.create({
    data: {
      name: 'Chofer / Repartidor',
      pin: '5555',
      role: 'driver',
      active: true,
    },
  });

  console.log('🎉 Seed de usuarios completado exitosamente.');
  console.log('📌 PINs asignados:');
  console.log('   - 0000: Superadmin');
  console.log('   - 1111: Admin');
  console.log('   - 2222: Sales');
  console.log('   - 3333: Inventory');
  console.log('   - 4444: Marketing');
  console.log('   - 5555: Driver');
  console.log('📌 Clientes y ventas vaciados al 100% (Base de datos en limpio).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

