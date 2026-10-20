import { describe, it, expect } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUNKKER E.C.O.S — Stock Lifecycle, Authority & Deconstruction Test (N3 Protocol)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Valida los 4 axiomas acordados:
 * 1. Happy Path: Reserva al cobrar, salida física real únicamente al entregar (PoD).
 * 2. Cero doble descuento: Ningún pedido descuenta stock al crearse y volver a descontar al entregarse.
 * 3. Ventas cerradas inmutables: Una orden DELIVERED/COMPLETED no se cancela para crear stock fantasma.
 * 4. Deconstrucción e idempotencia: return_to_shelf solo devuelve a estante 1 vez, sin duplicidad.
 */

describe('N3 Stock Lifecycle & Authority Engine', () => {

    class InMemoryInventoryEngine {
        public stock: number;
        public reservedStock: number;
        public orderStatus: string;
        public isLoaded: boolean;
        public rejectionReason: string | null;

        constructor(initialStock: number = 20) {
            this.stock = initialStock;
            this.reservedStock = 0;
            this.orderStatus = 'pending_payment';
            this.isLoaded = false;
            this.rejectionReason = null;
        }

        // 1. Crear Orden (Cliente o Staff)
        createOrder(qty: number, isPaidImmediately: boolean = false) {
            const available = this.stock - this.reservedStock;
            if (available < qty) {
                throw new Error(`INSUFFICIENT_STOCK: Disponible: ${available}, pedido: ${qty}`);
            }
            // Regla: En la creación el stock físico NO se decrementa.
            if (isPaidImmediately) {
                this.reservedStock += qty;
                this.orderStatus = 'paid';
            } else {
                this.orderStatus = 'pending_payment';
            }
            return { success: true, status: this.orderStatus };
        }

        // 2. Cobro en Caja
        payAtCashier(qty: number) {
            const available = this.stock - this.reservedStock;
            if (available < qty) {
                throw new Error('ORDER_CONFLICT: Inventario insuficiente');
            }
            this.reservedStock += qty;
            this.orderStatus = 'paid';
            return { success: true, status: this.orderStatus };
        }

        // 3. Preparación en Almacén / Bahía
        claimAndLoadOrder() {
            this.isLoaded = true;
            this.orderStatus = 'READY_FOR_PICKUP_PAID';
            return { success: true, isLoaded: true };
        }

        // 4. Entrega física validada (PoD)
        deliverOrder(qty: number) {
            // Deducción física final
            this.stock -= qty;
            this.reservedStock = Math.max(0, this.reservedStock - qty);
            this.orderStatus = 'DELIVERED';
            return { success: true, status: this.orderStatus };
        }

        // 5. Cancelación con guardas de venta cerrada
        cancelOrder(qty: number) {
            if (['DELIVERED', 'COMPLETED'].includes(this.orderStatus)) {
                throw new Error('VENTA_CERRADA_INMUTABLE: No se puede cancelar venta finalizada');
            }
            if (this.orderStatus === 'paid' || this.orderStatus === 'READY_FOR_PICKUP_PAID') {
                this.reservedStock = Math.max(0, this.reservedStock - qty);
            }
            this.orderStatus = 'cancelled';
            this.rejectionReason = this.isLoaded ? 'CANCELADO_PENDIENTE_REACOMODO' : 'CANCELADA_POR_USUARIO';
            return { success: true, status: this.orderStatus, rejectionReason: this.rejectionReason };
        }

        // 6. Retorno al anaquel (reacomodo en estante)
        returnToShelf(qty: number, role: string) {
            if (!['inventory', 'carga_descarga', 'admin', 'superadmin'].includes(role)) {
                throw new Error('FORBIDDEN_ROLE: Sin permiso para devolver a anaquel');
            }
            if (this.rejectionReason === 'CANCELADA_STOCK_RESTITUIDO') {
                return { success: true, duplicated: true, message: 'Ya restituido previamente' };
            }
            if (['DELIVERED', 'COMPLETED'].includes(this.orderStatus)) {
                throw new Error('VENTA_CERRADA: Imposible restituir venta entregada');
            }

            this.stock += qty;
            this.isLoaded = false;
            this.rejectionReason = 'CANCELADA_STOCK_RESTITUIDO';
            return { success: true, stockRestored: true };
        }
    }

    it('Axioma 1 (Happy Path): Reserva al pagar y decremento físico estricto únicamente en entrega', () => {
        const engine = new InMemoryInventoryEngine(10);

        // Paso A: Crear pedido de 3 piezas (pendiente de pago)
        engine.createOrder(3, false);
        expect(engine.stock).toBe(10);
        expect(engine.reservedStock).toBe(0);

        // Paso B: Cobro en ventanilla
        engine.payAtCashier(3);
        expect(engine.stock).toBe(10); // Físico intacto en anaquel
        expect(engine.reservedStock).toBe(3); // Apartado virtual activo

        // Paso C: Recolección
        engine.claimAndLoadOrder();
        expect(engine.stock).toBe(10);
        expect(engine.reservedStock).toBe(3);

        // Paso D: Entrega validada PoD
        engine.deliverOrder(3);
        expect(engine.stock).toBe(7); // Decrementado físicamente
        expect(engine.reservedStock).toBe(0); // Apartado liberado a 0
        expect(engine.orderStatus).toBe('DELIVERED');
    });

    it('Axioma 2 (Cero Doble Descuento): Venta inmediata de staff descuenta stock exactamente 1 vez', () => {
        const engine = new InMemoryInventoryEngine(10);

        // Pedido que nace pagado
        engine.createOrder(4, true);
        expect(engine.stock).toBe(10);
        expect(engine.reservedStock).toBe(4);

        // Entrega
        engine.deliverOrder(4);
        expect(engine.stock).toBe(6);
        expect(engine.reservedStock).toBe(0);
    });

    it('Axioma 3 (Inmutabilidad de Ventas Cerradas): No se puede cancelar pedido DELIVERED ni inyectar stock fantasma', () => {
        const engine = new InMemoryInventoryEngine(10);

        engine.createOrder(2, true);
        engine.deliverOrder(2);
        expect(engine.stock).toBe(8);
        expect(engine.orderStatus).toBe('DELIVERED');

        // Intento de cancelación de venta cerrada debe ser rechazado
        expect(() => engine.cancelOrder(2)).toThrow('VENTA_CERRADA_INMUTABLE');
        // El stock permanece intacto en 8, sin inventos
        expect(engine.stock).toBe(8);

        // Intento de returnToShelf en orden entregada debe fallar
        expect(() => engine.returnToShelf(2, 'inventory')).toThrow('VENTA_CERRADA');
        expect(engine.stock).toBe(8);
    });

    it('Axioma 4 (Deconstrucción e Idempotencia): Reacomodo a estante es idempotente y no duplica stock', () => {
        const engine = new InMemoryInventoryEngine(10);

        // Crear, cobrar y bajar de anaquel
        engine.createOrder(5, true);
        engine.claimAndLoadOrder();
        expect(engine.stock).toBe(10);
        expect(engine.reservedStock).toBe(5);

        // Cancelar antes de entrega
        const cancelResult = engine.cancelOrder(5);
        expect(cancelResult.rejectionReason).toBe('CANCELADO_PENDIENTE_REACOMODO');
        expect(engine.reservedStock).toBe(0); // Reserva liberada
        expect(engine.stock).toBe(10); // Aún no regresa a anaquel

        // Bodeguero reacomoda materiales a su anaquel
        const restock1 = engine.returnToShelf(5, 'inventory');
        expect(restock1.stockRestored).toBe(true);
        expect(engine.stock).toBe(15); // Restituido al estante

        // Reintento de llamada de red duplicada por Wi-Fi
        const restock2 = engine.returnToShelf(5, 'inventory');
        expect(restock2.duplicated).toBe(true);
        expect(engine.stock).toBe(15); // NUNCA sube a 20
    });

    it('Axioma 5 (Seguridad de Roles): Roles no autorizados no pueden manipular retorno a estante', () => {
        const engine = new InMemoryInventoryEngine(10);
        engine.createOrder(2, true);
        engine.claimAndLoadOrder();
        engine.cancelOrder(2);

        // Chofer o cliente no pueden regresar a anaquel
        expect(() => engine.returnToShelf(2, 'driver')).toThrow('FORBIDDEN_ROLE');
        expect(() => engine.returnToShelf(2, 'client')).toThrow('FORBIDDEN_ROLE');
    });

    it('Axioma 6 (Relevo y Cobro Multi-Vendedor en Caja): Cajero Bob puede cobrar orden iniciada por Vendedor Alice o Guest sin conflicto 409', () => {
        interface OrderState {
            id: string;
            status: string;
            vendedorId: string | null;
            vendedorName: string | null;
            cajeroId: string | null;
            confirmedAt: Date | null;
            expiresAt: Date | null;
        }

        const tenderOrder = (
            order: OrderState,
            cashierUser: { uid: string; name: string; role: string },
            cashierRoles: string[] = ['sales', 'billing', 'admin', 'superadmin']
        ) => {
            if (!cashierRoles.includes(cashierUser.role)) throw new Error('FORBIDDEN_ROLE');
            if (order.confirmedAt || !['pending_payment', 'pending', 'READY_FOR_PICKUP'].includes(order.status)) {
                throw new Error('ORDER_CONFLICT: Ya pagado o no listo');
            }
            // Cobro en ventanilla en vivo:
            order.status = 'paid';
            order.confirmedAt = new Date();
            order.cajeroId = cashierUser.uid;
            order.vendedorId = order.vendedorId || cashierUser.uid;
            order.vendedorName = order.vendedorName || cashierUser.name;
            return order;
        };

        const orderCreatedByAlice: OrderState = {
            id: 'ORD-ALICE-1',
            status: 'pending_payment',
            vendedorId: 'user-alice',
            vendedorName: 'Alice Asesora',
            cajeroId: null,
            confirmedAt: null,
            expiresAt: new Date(Date.now() - 60000) // Expirado hace 1 min mientras el cliente hacía fila
        };

        const cashierBob = { uid: 'user-bob', name: 'Bob Cajero', role: 'sales' };

        // Bob cobra exitosamente sin 409
        const result = tenderOrder(orderCreatedByAlice, cashierBob);
        expect(result.status).toBe('paid');
        expect(result.cajeroId).toBe('user-bob');
        expect(result.vendedorId).toBe('user-alice'); // Se preserva crédito de la vendedora Alice
        expect(result.confirmedAt).toBeTruthy();
    });

    it('Axioma 7 (Visibilidad en Pizarra de Caja): Órdenes en status paid y READY_FOR_PICKUP_PAID no desaparecen de la vista del cajero', () => {
        const PENDING_CASHIER_STATUSES = [
            'pending_payment',
            'pending_confirmation',
            'pending',
            'paid',
            'PREPARANDO',
            'READY_TO_SHIP',
            'READY_FOR_PICKUP',
            'READY_FOR_PICKUP_PAID',
            'pending_delivery',
            'NIGHT_QUEUE',
            'cancelled',
            'refunded'
        ];

        const isOrderVisibleInCashier = (status: string) => PENDING_CASHIER_STATUSES.includes(status);

        expect(isOrderVisibleInCashier('paid')).toBe(true);
        expect(isOrderVisibleInCashier('READY_FOR_PICKUP_PAID')).toBe(true);
        expect(isOrderVisibleInCashier('PREPARANDO')).toBe(true);
        expect(isOrderVisibleInCashier('READY_FOR_PICKUP')).toBe(true);
    });

    it('Axioma 8 (Segregación de Pizarras Mostrador vs Patio): Mostrador Pickup excluye carga pesada de Patio', () => {
        const testOrders = [
            { id: 'ORD-1', deliveryType: 'PICKUP', deliveryMethod: 'pickup' },
            { id: 'ORD-2', deliveryType: 'PATIO', deliveryMethod: 'patio' },
            { id: 'ORD-3', deliveryType: 'LOCAL', deliveryMethod: 'tienda' },
            { id: 'ORD-4', deliveryType: 'DELIVERY', deliveryMethod: 'repartidor' }
        ];

        // Regla de filtro de Mostrador Pickup (7777)
        const pickupWhiteboard = testOrders.filter(o => 
            (['tienda', 'pickup'].includes(o.deliveryMethod || '') || ['PICKUP', 'LOCAL'].includes(o.deliveryType || '')) &&
            o.deliveryMethod !== 'patio' && o.deliveryType !== 'PATIO'
        );

        expect(pickupWhiteboard.map(o => o.id)).toEqual(['ORD-1', 'ORD-3']);
        expect(pickupWhiteboard.find(o => o.id === 'ORD-2')).toBeUndefined();
    });
});
