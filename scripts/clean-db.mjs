import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function resetDbToCleanProductionState() {
  console.log('🧹 Limpiando datos simulados y de prueba en SQLite (dev.db)...');

  try {
    // 1. Borrar órdenes y ventas simuladas
    const deletedOrderItems = await db.orderItem.deleteMany({});
    const deletedOrders     = await db.order.deleteMany({});
    console.log(`✅ Eliminadas ${deletedOrders.count} ventas y ${deletedOrderItems.count} ítems de venta simulados.`);

    // 2. Borrar logs de merma y cortes de caja simulados
    const deletedShrinkage = await db.shrinkageLog.deleteMany({});
    const deletedCashLogs  = await db.cashRegisterLog.deleteMany({});
    const deletedAudit     = await db.auditLog.deleteMany({});
    console.log(`✅ Limpiados ${deletedShrinkage.count} mermas, ${deletedCashLogs.count} cortes de caja y ${deletedAudit.count} logs de auditoría.`);

    // 3. Borrar productos de test ("torture-", "test-", "Pintura Test")
    const deletedTestProducts = await db.product.deleteMany({
      where: {
        OR: [
          { id: { startsWith: 'torture-' } },
          { id: { startsWith: 'test-' } },
          { name: { contains: 'Test' } },
          { name: { contains: 'Prueba' } }
        ]
      }
    });
    console.log(`✅ Eliminados ${deletedTestProducts.count} productos de prueba/test.`);

    // 4. Reiniciar reservedStock a 0 en todos los productos reales
    await db.product.updateMany({
      data: { reservedStock: 0 }
    });
    console.log('✅ Reiniciado reservedStock = 0 en todos los productos activos.');

    console.log('\n✨ BASE DE DATOS LOCAL LISTA Y PURGADA PARA EMPEZAR DESDE CERO EN PRODUCCIÓN. ✨');
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error);
  } finally {
    await db.$disconnect();
  }
}

resetDbToCleanProductionState();
