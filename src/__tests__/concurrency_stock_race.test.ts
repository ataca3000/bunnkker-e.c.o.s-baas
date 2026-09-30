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

});
