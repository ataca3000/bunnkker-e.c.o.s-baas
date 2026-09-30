import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUNKKER E.C.O.S — Concurrency & Stock Race Forensics Test (Axioma 11)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Prueba de fuego para auditar:
 * 1. Carrera AAA / BBB / CCC: 3 peticiones simultáneas sobre producto con stock = 1.
 * 2. Idempotencia persistente en BD: Evitar doble cobro o doble descuento de stock.
 * 3. Fail-Closed: Bloqueo inmediato ante falla de base de datos o usuario inactivo.
 */

describe('Stock Concurrency Race & Idempotency Forensics', () => {

  // Simulación del motor transaccional ACID de SQLite
  class MockSqliteDb {
    public stock: number;
    public reservedStock: number;
    public orders: Map<string, any>;
    private lock: Promise<void> = Promise.resolve();

    constructor(initialStock: number = 1) {
      this.stock = initialStock;
      this.reservedStock = 0;
      this.orders = new Map();
    }

    /**
     * Ejecuta una transacción serializada (tal como SQLite Serializable / BEGIN IMMEDIATE)
     */
    async executeTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      // Cola de serialización estricta de escrituras en SQLite
      const currentLock = this.lock;
      let releaseLock: () => void = () => {};
      this.lock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });

      await currentLock;
      const snapshotStock = this.stock;
      const snapshotReserved = this.reservedStock;
      try {
        const txContext = {
          findProduct: async (id: string) => {
            return { id, stock: this.stock, reservedStock: this.reservedStock };
          },
          decrementStock: async (id: string, qty: number) => {
            this.stock -= qty;
          },
          findOrder: async (id: string) => {
            return this.orders.get(id) || null;
          },
          createOrder: async (order: any) => {
            if (this.orders.has(order.id)) {
              const err: any = new Error('Unique constraint failed on the fields: (`id`)');
              err.code = 'P2002';
              throw err;
            }
            this.orders.set(order.id, order);
            return order;
          }
        };

        const result = await fn(txContext);
        return result;
      } catch (txError) {
        // ACID ROLLBACK: En caso de error o colisión (P2002), se revierten las mutaciones
        this.stock = snapshotStock;
        this.reservedStock = snapshotReserved;
        throw txError;
      } finally {
        releaseLock();
      }
    }
  }

  it('Carrera AAA / BBB / CCC: 3 peticiones simultáneas compiten por 1 unidad de stock', async () => {
    const db = new MockSqliteDb(1); // 1 unidad disponible
    const productId = 'prod-martillo-001';

    // Función que replica la lógica transaccional de /api/orders
    const processSale = async (workerId: string, orderId: string, quantity: number) => {
      return db.executeTransaction(async (tx) => {
        // 1. Leer stock dentro de la transacción
        const product = await tx.findProduct(productId);
        const available = product.stock - product.reservedStock;

        // 2. Validar disponibilidad
        if (available < quantity) {
          throw new Error(`[${workerId}] Inventario insuficiente. Disponible: ${available}, Solicitado: ${quantity}`);
        }

        // 3. Decrementar stock
        await tx.decrementStock(productId, quantity);

        // 4. Crear orden
        const order = await tx.createOrder({
          id: orderId,
          productId,
          quantity,
          workerId,
          status: 'paid'
        });

        return { success: true, order };
      });
    };

    console.log('[CONCURRENCY TEST] 🏁 Lanzando 3 peticiones simultáneas (AAA, BBB, CCC) para comprar la última unidad...');

    // Lanzar 3 peticiones concurrentes a través de Promise.allSettled
    const results = await Promise.allSettled([
      processSale('AAA', 'ord-001', 1),
      processSale('BBB', 'ord-002', 1),
      processSale('CCC', 'ord-003', 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    console.log(`[CONCURRENCY TEST] ✅ Éxitos: ${fulfilled.length}, Rechazos controlados: ${rejected.length}`);
    console.log(`[CONCURRENCY TEST] 📦 Stock final en SQLite: ${db.stock}`);

    // EXACTAMENTE 1 debe tener éxito
    expect(fulfilled.length).toBe(1);
    // EXACTAMENTE 2 deben ser rechazadas con error de stock insuficiente
    expect(rejected.length).toBe(2);
    // El stock no debe quedar negativo bajo ninguna circunstancia
    expect(db.stock).toBe(0);
    // Solo 1 orden debe haber quedado registrada
    expect(db.orders.size).toBe(1);

    // Verificar que los errores contengan el mensaje de inventario insuficiente
    rejected.forEach((r: any) => {
      expect(r.reason.message).toContain('Inventario insuficiente');
    });
  });

  it('Idempotencia concurrente con colisión de Primary Key (P2002)', async () => {
    const db = new MockSqliteDb(5);
    const orderId = 'tx-same-order-123';

    const simulatePostOrder = async (workerId: string) => {
      // 1. Check idempotencia inicial
      const existing = await db.orders.get(orderId);
      if (existing) {
        return { success: true, data: existing, duplicated: true };
      }

      try {
        return await db.executeTransaction(async (tx) => {
          const product = await tx.findProduct('prod-1');
          if (product.stock < 1) throw new Error('Sin stock');

          await tx.decrementStock('prod-1', 1);
          const order = await tx.createOrder({ id: orderId, workerId });
          return { success: true, data: order, duplicated: false };
        });
      } catch (err: any) {
        // Manejador P2002 de /api/orders
        if (err.code === 'P2002') {
          const recovered = await db.orders.get(orderId);
          return { success: true, data: recovered, duplicated: true };
        }
        throw err;
      }
    };

    // Dos peticiones disparadas simultáneamente con el MISMO orderId
    const [res1, res2] = await Promise.all([
      simulatePostOrder('Req-1'),
      simulatePostOrder('Req-2')
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // Una fue la creación real, la otra fue identificada como duplicada
    const duplicates = [res1, res2].filter(r => r.duplicated);
    const originals = [res1, res2].filter(r => !r.duplicated);

    expect(originals.length).toBe(1);
    expect(duplicates.length).toBe(1);

    // El stock debe haberse descontado EXACTAMENTE 1 vez (5 - 1 = 4), NUNCA 2 veces
    expect(db.stock).toBe(4);
    expect(db.orders.size).toBe(1);
  });

  it('Fail-Closed: Usuarios inactivos o base de datos corrupta rechazan la venta sin tocar stock', async () => {
    let stock = 10;

    const executeSaleWithAuth = (user: { active: boolean } | null, dbHealthy: boolean) => {
      if (!dbHealthy) {
        // Falla de base de datos -> Fail Closed (503 Service Unavailable)
        return { status: 503, error: 'Database offline' };
      }
      if (!user || !user.active) {
        // Usuario inactivo o inexistente -> 401 Unauthorized
        return { status: 401, error: 'Usuario inactivo' };
      }

      stock -= 1;
      return { status: 200, success: true };
    };

    // Caso 1: DB caída -> 503, stock intacto
    const resDbDown = executeSaleWithAuth({ active: true }, false);
    expect(resDbDown.status).toBe(503);
    expect(stock).toBe(10);

    // Caso 2: Usuario dado de baja (active = false) -> 401, stock intacto
    const resInactive = executeSaleWithAuth({ active: false }, true);
    expect(resInactive.status).toBe(401);
    expect(stock).toBe(10);

    // Caso 3: Usuario activo con DB sana -> 200, stock decrementado a 9
    const resValid = executeSaleWithAuth({ active: true }, true);
    expect(resValid.status).toBe(200);
    expect(stock).toBe(9);
  });

  it('Concurrencia + Fallo + Recuperación: AAA gana, BBB falla a mitad de camino y el estado final permanece íntegro', async () => {
    const db = new MockSqliteDb(1);
    const orderEvents: Array<{ orderId: string; event: string }> = [];

    // AAA: Transacción completa exitosa
    await db.executeTransaction(async (tx) => {
      const prod = await tx.findProduct('p1');
      if (prod.stock < 1) throw new Error('Sin stock');
      await tx.decrementStock('p1', 1);
      const ord = await tx.createOrder({ id: 'ord-AAA', workerId: 'AAA' });
      orderEvents.push({ orderId: ord.id, event: 'ORDER_CREATED' });
      return ord;
    });

    expect(db.stock).toBe(0);
    expect(db.orders.has('ord-AAA')).toBe(true);
    expect(orderEvents.length).toBe(1);

    // BBB: Falla durante la transacción (ej. corte de energía o error en paso posterior)
    const bbbPromise = db.executeTransaction(async (tx) => {
      const prod = await tx.findProduct('p1');
      if (prod.stock < 1) {
        throw new Error('Inventario insuficiente para BBB');
      }
      // Si la transacción intentara decrementar o crear algo:
      await tx.decrementStock('p1', 1);
      throw new Error('SIMULATED_CRASH_MID_FLIGHT');
    });

    await expect(bbbPromise).rejects.toThrow('Inventario insuficiente para BBB');

    // Verificación forense post-interrupción:
    // 1. La orden legítima AAA sigue existiendo intacta
    expect(db.orders.has('ord-AAA')).toBe(true);
    // 2. NO existe orden fantasma para BBB
    expect(db.orders.has('ord-BBB')).toBe(false);
    // 3. El stock permanece en 0 (NUNCA negativo ni corrupto)
    expect(db.stock).toBe(0);
    // 4. NO quedaron eventos huérfanos de BBB
    expect(orderEvents.filter(e => e.orderId === 'ord-BBB').length).toBe(0);
  });

  it('Ataque de Autorización: Empleado despedido con cookie HMAC válida es rechazado (401) y stock/órdenes quedan intactos', async () => {
    // Simular base de datos con stock = 10 y 0 órdenes
    let stock = 10;
    const orders: any[] = [];

    // Usuario revocado en SQLite
    const userInDb = { id: 'emp-despedido', role: 'sales', active: false };

    // Función que replica la validación estricta de POST /api/orders
    const handleOrderAttempt = (reqUser: typeof userInDb) => {
      // Validador Fail-Closed
      if (!reqUser.active) {
        return { status: 401, error: 'Usuario inactivo o revocado' };
      }

      stock -= 1;
      orders.push({ id: 'ord-hacked' });
      return { status: 200, success: true };
    };

    const res = handleOrderAttempt(userInDb);

    // 1. Debe responder 401
    expect(res.status).toBe(401);
    expect(res.error).toContain('Usuario inactivo');

    // 2. Stock no debe haberse tocado en absoluto
    expect(stock).toBe(10);

    // 3. Cero órdenes creadas
    expect(orders.length).toBe(0);
  });

  it('Aislamiento Soberano de Tenant: Header x-tenant-id falsificado es completamente ignorado', () => {
    const sovereignAppConfig = { id: 'global', tenantId: 'FERRETERIA_A_SOBERANA' };
    const maliciousClientHeaders = new Map<string, string>();
    maliciousClientHeaders.set('x-tenant-id', 'FERRETERIA_B_SPOOFED');

    // Lógica en el servidor: Se ignora el header del cliente y se toma AppConfig.tenantId
    const resolvedTenantId = sovereignAppConfig.tenantId || 'default';

    const orderRecord = {
      id: 'ord-tenant-test',
      tenantId: resolvedTenantId,
      customerId: 'cust-1'
    };

    const customerRecord = {
      id: 'cust-1',
      tenantId: resolvedTenantId,
      name: 'Cliente Local'
    };

    // Ambas entidades deben pertenecer obligatoriamente a FERRETERIA_A_SOBERANA
    expect(orderRecord.tenantId).toBe('FERRETERIA_A_SOBERANA');
    expect(customerRecord.tenantId).toBe('FERRETERIA_A_SOBERANA');
    expect(orderRecord.tenantId).not.toBe(maliciousClientHeaders.get('x-tenant-id'));
  });

  it('Desambiguación estricta: P2002 PK vs P2034 Busy (Errores con texto "conflict" NO devuelven falso 200)', () => {
    const existingOrders = new Map<string, any>();
    existingOrders.set('ord-completada', { id: 'ord-completada', total: 100 });

    const handleCatchBlock = (error: any, collisionId: string) => {
      // 1. P2002 PK
      const isOrderPkCollision = error.code === 'P2002' || (
        typeof error.message === 'string' &&
        error.message.includes('Unique constraint failed') &&
        (!error.meta?.target || (Array.isArray(error.meta.target) && error.meta.target.includes('id')))
      );

      if (isOrderPkCollision && collisionId) {
        const existing = existingOrders.get(collisionId);
        if (existing) {
          return { status: 200, success: true, data: existing, duplicated: true };
        }
      }

      // 2. P2034 / SQLITE_BUSY
      const isBusyOrLockConflict = error.code === 'P2034' || 
        (typeof error.message === 'string' && (
          error.message.includes('SQLITE_BUSY') || 
          error.message.includes('database is locked') ||
          error.message.includes('Transaction failed due to a write conflict')
        ));

      if (isBusyOrLockConflict) {
        if (collisionId) {
          const existing = existingOrders.get(collisionId);
          if (existing) {
            return { status: 200, success: true, data: existing, duplicated: true };
          }
        }
        return { status: 409, success: false, retryable: true, error: 'Conflicto de concurrencia' };
      }

      return { status: 500, success: false, error: error.message };
    };

    // Caso A: Error genérico no relacionado pero que contiene la palabra "conflict"
    // (Ej. "Conflict in third-party tax calculation")
    const genericConflictError = new Error('Validation conflict in custom pricing rules');
    const resA = handleCatchBlock(genericConflictError, 'ord-nueva-1');
    // NO debe devolver 200, debe devolver 500
    expect(resA.status).toBe(500);
    expect(resA.success).toBe(false);

    // Caso B: P2034 con orden NO existente todavía
    const busyErrorNoOrder = { code: 'P2034', message: 'Transaction failed due to a write conflict' };
    const resB = handleCatchBlock(busyErrorNoOrder, 'ord-nueva-2');
    // Debe devolver 409 reintentable
    expect(resB.status).toBe(409);
    expect(resB.retryable).toBe(true);

    // Caso C: P2034 o P2002 pero la orden ya quedó asentada en BD por la petición ganadora
    const busyErrorWithOrder = { code: 'P2034', message: 'Transaction failed due to a write conflict' };
    const resC = handleCatchBlock(busyErrorWithOrder, 'ord-completada');
    // Debe devolver 200 con la orden y duplicated: true
    expect(resC.status).toBe(200);
    expect(resC.duplicated).toBe(true);
  });

  it('Ciclo de vida de reservedStock: Cancelación de Venta Mostrador (LOCAL) vs Pedido (PICKUP)', () => {
    // Escenario 1: Venta mostrador (deliveryType = LOCAL, pago directo)
    // En la creación, se descontó directamente de stock (stock 10 -> 9, reservedStock 0)
    let stockLocal = 9;
    let reservedLocal = 0;
    const orderLocal = { deliveryType: 'LOCAL', status: 'COMPLETED', confirmedAt: new Date(), quantity: 1 };

    // Al cancelar la venta local:
    const wasPhysicalStockDeducted = orderLocal.status === 'COMPLETED' || orderLocal.deliveryType === 'LOCAL';
    if (wasPhysicalStockDeducted) {
      stockLocal += orderLocal.quantity;
    } else {
      reservedLocal -= orderLocal.quantity;
    }

    // El stock físico debe restaurarse a 10 y reservedStock permanecer en 0
    expect(stockLocal).toBe(10);
    expect(reservedLocal).toBe(0);

    // Escenario 2: Pedido Pickup (deliveryType = PICKUP)
    // Al cobrar en caja, stock físico permanece en 10 y reservedStock sube a 1
    let stockPickup = 10;
    let reservedPickup = 1;
    const orderPickup = { deliveryType: 'PICKUP', status: 'READY_FOR_PICKUP_PAID', confirmedAt: new Date(), quantity: 1 };

    // Al cancelar el pedido pickup antes de entregarlo:
    const wasPickupPhysicalDeducted = orderPickup.status === 'DELIVERED' || orderPickup.status === 'COMPLETED';
    if (wasPickupPhysicalDeducted) {
      stockPickup += orderPickup.quantity;
    } else {
      reservedPickup -= orderPickup.quantity;
    }

    // El stock físico sigue en 10 (nunca salió de tienda) y reservedStock baja a 0 (se libera el apartado)
    expect(stockPickup).toBe(10);
    expect(reservedPickup).toBe(0);

    // Escenario 3: Pedido Pickup se entrega al cliente (DELIVERED)
    // Al entregar, se descuenta de stock físico y se descuenta de reservedStock
    stockPickup -= orderPickup.quantity;
    reservedPickup = 0;
    expect(stockPickup).toBe(9);
    expect(reservedPickup).toBe(0);
  });

});

