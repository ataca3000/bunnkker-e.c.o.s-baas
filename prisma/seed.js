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
  const products = [
    {
      id: "PROD-101",
      name: "Kit de Herramientas Básico",
      price: 499.99,
      stock: 50,
      category: "Herramientas",
      image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800",
      description: "Kit básico de herramientas para hogar y taller."
    },
    {
      id: "PROD-102",
      name: "Taladro Inalámbrico 20V",
      price: 1299.50,
      stock: 15,
      category: "Eléctricas",
      image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800",
      description: "Taladro inalámbrico con batería de larga duración."
    },
    {
      id: "PROD-103",
      name: "Set de Llaves Combinadas",
      price: 850.00,
      stock: 30,
      category: "Herramientas",
      image: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=800",
      description: "Llaves métricas e imperiales de alta resistencia."
    },
    {
      id: "PROD-104",
      name: "Cinta Métrica 8m",
      price: 120.00,
      stock: 100,
      category: "Medición",
      image: "https://images.unsplash.com/photo-1580870059865-fb18e8093db4?w=800",
      description: "Cinta métrica resistente a impactos."
    },
    {
      id: "PROD-105",
      name: "Cemento Portland 50kg",
      price: 210.00,
      stock: 200,
      category: "Materiales",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
      description: "Saco de cemento Portland tipo compuesto."
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('Production detected: demo users were not seeded.');
  } else {
    for (const [name, role, plainPin] of demoUsers) {
      const pinHash = await bcrypt.hash(plainPin, 10);
      const pin = crypto.createHash('sha256').update(plainPin).digest('hex');
      await prisma.user.upsert({
        where: { pin },
        update: { name, role, pinHash, active: true },
        create: { name, role, pin, pinHash, active: true },
      });
    }
    console.log('6 demo users seeded with PINs 0000–5555. Change them before production.');
  }

  console.log("5 demo products seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
