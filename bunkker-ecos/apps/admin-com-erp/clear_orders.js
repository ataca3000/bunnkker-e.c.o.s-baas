const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    console.log('Orders and OrderItems cleared successfully.');
}

clean()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
