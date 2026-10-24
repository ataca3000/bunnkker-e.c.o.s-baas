if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

const demoUsers = [
  ['SUPERADMIN', 'superadmin', '0000'],
  ['Administrador', 'admin', '1111'],
  ['Ventas', 'sales', '2222'],
  ['Inventario', 'inventory', '3333'],
  ['Marketing', 'marketing', '4444'],
  ['Repartidor', 'driver', '5555'],
];

async function main() {
  console.log('🌱 [Seed] Iniciando inserción de datos de prueba en la base de datos...');

  // 1. Catálogo de productos iniciales
  const products = [
    {
      id: "PROD-101",
      tenantId: "default",
      name: "Kit de Herramientas Básico",
      price: 499.99,
      stock: 50,
      reservedStock: 0,
      category: "Herramientas",
      image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800",
      description: "Kit básico de herramientas para hogar y taller.",
      barcode: "7501000000101",
      estante: "A1",
      fila: "1",
      orderIndex: 0
    },
    {
      id: "PROD-102",
      tenantId: "default",
      name: "Taladro Inalámbrico 20V",
      price: 1299.50,
      stock: 15,
      reservedStock: 0,
      category: "Eléctricas",
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
      description: "Taladro inalámbrico con batería de larga duración.",
      barcode: "7501000000102",
      estante: "A1",
      fila: "2",
      orderIndex: 1
    },
    {
      id: "PROD-103",
      tenantId: "default",
      name: "Set de Llaves Combinadas",
      price: 850.00,
      stock: 30,
      reservedStock: 0,
      category: "Herramientas",
      image: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=800",
      description: "Llaves métricas e imperiales de alta resistencia.",
      barcode: "7501000000103",
      estante: "B1",
      fila: "1",
      orderIndex: 2
    },
    {
      id: "PROD-104",
      tenantId: "default",
      name: "Cinta Métrica 8m",
      price: 120.00,
      stock: 100,
      reservedStock: 0,
      category: "Medición",
      image: "https://images.unsplash.com/photo-1580870059865-fb18e8093db4?w=800",
      description: "Cinta métrica resistente a impactos.",
      barcode: "7501000000104",
      estante: "B1",
      fila: "2",
      orderIndex: 3
    },
    {
      id: "PROD-105",
      tenantId: "default",
      name: "Cemento Portland 50kg",
      price: 210.00,
      stock: 200,
      reservedStock: 0,
      category: "Materiales",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
      description: "Saco de cemento Portland tipo compuesto.",
      barcode: "7501000000105",
      estante: "PATIO",
      fila: "1",
      orderIndex: 4
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }
  console.log(`✅ ${products.length} productos de prueba sembrados exitosamente.`);

  // 2. Licencia y configuración inicial
  await prisma.appConfig.upsert({
    where: { id: 'global' },
    update: { licenseType: 'TRIAL', tenantId: 'default' },
    create: { id: 'global', licenseType: 'TRIAL', tenantId: 'default' },
  });
  console.log('✅ Configuración AppConfig sembrada (Licencia TRIAL activa).');

  // 3. Usuarios de prueba (PINs 0000–5555)
  if (process.env.ALLOW_DEMO_SEED === 'false') {
    console.log('ℹ️ ALLOW_DEMO_SEED=false detectado: se omitió la creación de usuarios demo.');
  } else {
    for (const [name, role, plainPin] of demoUsers) {
      const pinHash = await bcrypt.hash(plainPin, 10);
      const pin = crypto.createHash('sha256').update(plainPin).digest('hex');
      const email = `${role}@bunnkker.local`;
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
    console.log('✅ 6 usuarios demo sembrados con PINs 0000–5555 (superadmin: 0000, admin: 1111, sales: 2222, etc.).');
  }

  console.log('🎉 Seeding completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
