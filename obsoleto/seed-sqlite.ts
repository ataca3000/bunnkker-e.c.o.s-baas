import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
    console.log("Seeding SQLite with P001 and fallback products...")
    await prisma.product.upsert({
        where: { id: "P001" },
        update: { stock: 10000 },
        create: {
            id: "P001",
            name: "Producto Test P001",
            price: 100,
            stock: 10000
        }
    })
    console.log("Seeded P001")
    process.exit(0)
}

seed()
