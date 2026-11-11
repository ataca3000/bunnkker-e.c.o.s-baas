import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWritablePath, resolveReadablePath, isServerlessEnvironment } from '../lib/atomicFs';

describe('Vercel and Cloud Serverless Persistence', () => {
    it('should detect serverless environment flags or fallback safely', () => {
        const isServerless = isServerlessEnvironment();
        assert.equal(typeof isServerless, 'boolean');
    });

    it('should resolve writable path into os.tmpdir when VERCEL is active', () => {
        const originalVercel = process.env.VERCEL;
        try {
            process.env.VERCEL = '1';
            const target = '/var/task/.prisma_memory_store.json';
            const resolved = resolveWritablePath(target);
            assert.ok(resolved.includes('bunnkker-ecos'), 'Should contain bunnkker-ecos in tmp fallback');
            assert.ok(!resolved.startsWith('/var/task'), 'Should not try to write into read-only /var/task');
        } finally {
            if (originalVercel === undefined) {
                delete process.env.VERCEL;
            } else {
                process.env.VERCEL = originalVercel;
            }
        }
    });

    it('should resolve readable path prioritizing existing fallback or original', () => {
        const target = '.prisma_memory_store.json';
        const readable = resolveReadablePath(target);
        assert.ok(typeof readable === 'string' && readable.length > 0);
    });
});

describe('Sales Stock Flow, Stock Deduction, and Buyer/Seller Traceability', () => {
    // Pure logic simulation of the direct counter sale vs online pickup sale
    interface MockProduct {
        id: string;
        name: string;
        stock: number;
        reservedStock: number;
        price: number;
    }

    interface MockOrderItem {
        productId: string;
        quantity: number;
        price: number;
    }

    function processDirectLocalSale(
        products: Map<string, MockProduct>,
        items: MockOrderItem[],
        seller: { uid: string; name: string },
        buyer: { customerId: string; name: string; phone: string }
    ) {
        // 1. Validar disponibilidad
        for (const it of items) {
            const p = products.get(it.productId);
            if (!p) throw new Error(`Producto ${it.productId} no encontrado`);
            const available = p.stock - p.reservedStock;
            if (available < it.quantity) {
                throw new Error(`INSUFFICIENT_STOCK: Disponible ${available}, solicitado ${it.quantity}`);
            }
        }

        // 2. Descuento físico inmediato en mostrador (venta directa)
        for (const it of items) {
            const p = products.get(it.productId)!;
            p.stock -= it.quantity;
        }

        // 3. Crear registro inmutable de orden
        const orderId = `TCK-LOCAL-${Date.now()}`;
        const total = items.reduce((acc, it) => acc + (it.quantity * it.price), 0);

        return {
            id: orderId,
            status: 'COMPLETED',
            total,
            deliveryType: 'LOCAL',
            vendedorId: seller.uid,
            vendedorName: seller.name,
            customerId: buyer.customerId,
            customerName: buyer.name,
            customerPhone: buyer.phone,
            items,
            completedAt: new Date().toISOString()
        };
    }

    function processOnlineOrderHold(
        products: Map<string, MockProduct>,
        items: MockOrderItem[]
    ) {
        // Validar y apartar reserva
        for (const it of items) {
            const p = products.get(it.productId);
            if (!p) throw new Error(`Producto ${it.productId} no encontrado`);
            const available = p.stock - p.reservedStock;
            if (available < it.quantity) {
                throw new Error(`INSUFFICIENT_STOCK: Disponible ${available}, solicitado ${it.quantity}`);
            }
        }

        for (const it of items) {
            const p = products.get(it.productId)!;
            p.reservedStock += it.quantity;
        }

        return { status: 'pending_payment' };
    }

    function processCashierPaymentAndDelivery(
        products: Map<string, MockProduct>,
        items: MockOrderItem[],
        seller: { uid: string; name: string }
    ) {
        for (const it of items) {
            const p = products.get(it.productId)!;
            p.stock -= it.quantity;
            p.reservedStock = Math.max(0, p.reservedStock - it.quantity);
        }

        return { status: 'DELIVERED', cashier: seller.name };
    }

    it('should physically deduct stock on direct counter sale and keep buyer/seller trace', () => {
        const inventory = new Map<string, MockProduct>([
            ['prod-1', { id: 'prod-1', name: 'Taladro 20V', stock: 10, reservedStock: 0, price: 1850 }]
        ]);

        const sale = processDirectLocalSale(
            inventory,
            [{ productId: 'prod-1', quantity: 2, price: 1850 }],
            { uid: 'demo-sales', name: 'Cajero Juan' },
            { customerId: 'cust-10', name: 'María Gómez', phone: '5511223344' }
        );

        assert.equal(sale.status, 'COMPLETED');
        assert.equal(sale.vendedorName, 'Cajero Juan');
        assert.equal(sale.customerName, 'María Gómez');
        assert.equal(sale.total, 3700);

        const updatedProd = inventory.get('prod-1')!;
        assert.equal(updatedProd.stock, 8, 'Physical stock must be decremented by 2');
        assert.equal(updatedProd.reservedStock, 0, 'Reserved stock should remain 0');
    });

    it('should hold reserved stock for online order and deduct physical stock on payment', () => {
        const inventory = new Map<string, MockProduct>([
            ['prod-2', { id: 'prod-2', name: 'Caja Herramientas', stock: 5, reservedStock: 0, price: 1450 }]
        ]);

        // Cliente aparta 2 por internet
        const online = processOnlineOrderHold(inventory, [{ productId: 'prod-2', quantity: 2, price: 1450 }]);
        assert.equal(online.status, 'pending_payment');

        const prodAfterHold = inventory.get('prod-2')!;
        assert.equal(prodAfterHold.stock, 5);
        assert.equal(prodAfterHold.reservedStock, 2);

        // Cajero cobra y entrega
        const payment = processCashierPaymentAndDelivery(
            inventory,
            [{ productId: 'prod-2', quantity: 2, price: 1450 }],
            { uid: 'demo-sales', name: 'Cajero Juan' }
        );

        assert.equal(payment.status, 'DELIVERED');
        const finalProd = inventory.get('prod-2')!;
        assert.equal(finalProd.stock, 3, 'Stock physical must now be 3');
        assert.equal(finalProd.reservedStock, 0, 'Reserved stock must be released');
    });

    it('should strictly reject overselling if stock is insufficient', () => {
        const inventory = new Map<string, MockProduct>([
            ['prod-3', { id: 'prod-3', name: 'Generador 3500W', stock: 1, reservedStock: 1, price: 8900 }]
        ]);

        assert.throws(() => {
            processDirectLocalSale(
                inventory,
                [{ productId: 'prod-3', quantity: 1, price: 8900 }],
                { uid: 'demo-sales', name: 'Cajero' },
                { customerId: 'cust-99', name: 'Pedro', phone: '0000000000' }
            );
        }, /INSUFFICIENT_STOCK/);
    });
});
