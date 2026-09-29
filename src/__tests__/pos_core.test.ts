import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests de lógica de POS — BUNKKER E.C.O.S ERP
 *
 * Cubre los cálculos críticos del punto de venta:
 * - Totales de carrito con múltiples productos y cantidades
 * - Aplicación de propinas (repartidor)
 * - Validación de stock flotante (reservas en tiempo real)
 * - Lógica de venta rápida para mostrador
 * - Cálculo de descuentos
 */

// ── Helpers de lógica pura (extraídos del contexto para testeabilidad) ──────────

interface CartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    stock: number;
    category?: string;
}

/** Suma el total del carrito considerando precio × cantidad de cada ítem. */
function calculateCartTotal(cart: CartItem[]): number {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/** Calcula el total final incluyendo propina del repartidor. */
function calculateFinalTotal(cartTotal: number, tip: number): number {
    return cartTotal + tip;
}

/** Valida si hay stock disponible para agregar la cantidad solicitada. */
function canAddToCart(
    product: { stock: number; id: string },
    quantityRequested: number,
    floatingStock: Record<string, number> = {}
): boolean {
    const held = floatingStock[product.id] || 0;
    const available = product.stock - held;
    return quantityRequested > 0 && quantityRequested <= available;
}

/** Disponibilidad real = stock físico − stock flotante reservado. */
function getAvailableStock(productId: string, stock: number, floatingStock: Record<string, number>): number {
    return Math.max(0, stock - (floatingStock[productId] || 0));
}

/** Determina si una venta de mostrador puede saltar la validación de datos del cliente. */
function isStaffSale(role?: string): boolean {
    return role === 'sales' || role === 'admin' || role === 'superadmin';
}

/** Aplica un descuento porcentual al total del carrito. */
function applyDiscount(total: number, discountPercent: number): number {
    if (discountPercent < 0 || discountPercent > 100) return total;
    return total * (1 - discountPercent / 100);
}

/** Calcula el peso de carga de la orden para el simulador de capacidad de entrega. */
function calculateLoadWeight(cart: CartItem[], categoryWeights: Record<string, number> = {}): number {
    return cart.reduce((sum, item) => {
        const weight = categoryWeights[item.category || ''] ?? 5;
        return sum + weight * item.quantity;
    }, 0);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POS — Cálculo de totales del carrito', () => {
    it('suma correctamente un carrito con un solo producto', () => {
        const cart: CartItem[] = [{ id: 'p1', name: 'Módulo POS', price: 500, quantity: 1, stock: 10 }];
        expect(calculateCartTotal(cart)).toBe(500);
    });

    it('suma precio × cantidad para múltiples ítems', () => {
        const cart: CartItem[] = [
            { id: 'p1', name: 'Módulo POS',        price: 500,  quantity: 2, stock: 10 },
            { id: 'p2', name: 'Módulo Inventario', price: 300,  quantity: 3, stock: 5  },
            { id: 'p3', name: 'Módulo Reportes',   price: 150,  quantity: 1, stock: 8  },
        ];
        // 500×2 + 300×3 + 150×1 = 1000 + 900 + 150 = 2050
        expect(calculateCartTotal(cart)).toBe(2050);
    });

    it('devuelve 0 para carrito vacío', () => {
        expect(calculateCartTotal([])).toBe(0);
    });

    it('maneja cantidades de 0 correctamente', () => {
        const cart: CartItem[] = [{ id: 'p1', name: 'Test', price: 100, quantity: 0, stock: 5 }];
        expect(calculateCartTotal(cart)).toBe(0);
    });
});

describe('POS — Total final con propina', () => {
    it('agrega la propina al total del carrito', () => {
        expect(calculateFinalTotal(1000, 30)).toBe(1030);
    });

    it('total sin propina (0) es igual al total del carrito', () => {
        expect(calculateFinalTotal(750, 0)).toBe(750);
    });

    it('soporta propinas de valores estándar: 10, 20, 30 MXN', () => {
        [10, 20, 30].forEach(tip => {
            expect(calculateFinalTotal(500, tip)).toBe(500 + tip);
        });
    });
});

describe('POS — Stock flotante (reservas en tiempo real)', () => {
    it('permite agregar si hay stock disponible sin reservas', () => {
        const product = { id: 'p1', stock: 10 };
        expect(canAddToCart(product, 3, {})).toBe(true);
    });

    it('bloquea agregar si el stock flotante agota el disponible', () => {
        const product = { id: 'p1', stock: 5 };
        const floatingStock = { p1: 5 }; // 5 en reserva = 0 disponibles
        expect(canAddToCart(product, 1, floatingStock)).toBe(false);
    });

    it('permite agregar exactamente el stock disponible descontando reservas', () => {
        const product = { id: 'p1', stock: 8 };
        const floatingStock = { p1: 3 }; // 5 disponibles
        expect(canAddToCart(product, 5, floatingStock)).toBe(true);
        expect(canAddToCart(product, 6, floatingStock)).toBe(false);
    });

    it('calcula el stock disponible visible correctamente', () => {
        expect(getAvailableStock('p1', 10, { p1: 3 })).toBe(7);
        expect(getAvailableStock('p2', 5, {})).toBe(5);
        expect(getAvailableStock('p3', 2, { p3: 5 })).toBe(0); // no puede ser negativo
    });

    it('no permite cantidad 0', () => {
        const product = { id: 'p1', stock: 10 };
        expect(canAddToCart(product, 0, {})).toBe(false);
    });
});

describe('POS — Venta rápida de mostrador (Staff)', () => {
    it('identifica roles de staff correctamente', () => {
        expect(isStaffSale('sales')).toBe(true);
        expect(isStaffSale('admin')).toBe(true);
        expect(isStaffSale('superadmin')).toBe(true);
    });

    it('rechaza roles que no son staff', () => {
        expect(isStaffSale('customer')).toBe(false);
        expect(isStaffSale('delivery')).toBe(false);
        expect(isStaffSale(undefined)).toBe(false);
    });
});

describe('POS — Descuentos', () => {
    it('aplica descuento del 10% correctamente', () => {
        expect(applyDiscount(1000, 10)).toBe(900);
    });

    it('aplica descuento del 50%', () => {
        expect(applyDiscount(500, 50)).toBe(250);
    });

    it('descuento 0 no modifica el total', () => {
        expect(applyDiscount(800, 0)).toBe(800);
    });

    it('descuento 100 devuelve 0', () => {
        expect(applyDiscount(1000, 100)).toBe(0);
    });

    it('descuento negativo (inválido) no aplica descuento', () => {
        expect(applyDiscount(1000, -10)).toBe(1000);
    });

    it('descuento mayor a 100 (inválido) no aplica descuento', () => {
        expect(applyDiscount(1000, 150)).toBe(1000);
    });
});

describe('POS — Simulador de carga de entrega', () => {
    it('calcula peso con categoría de servicio = 0 unidades', () => {
        const cart: CartItem[] = [
            { id: 's1', name: 'Servicio', price: 100, quantity: 1, stock: 99, category: 'Servicios' }
        ];
        const weights = { 'Servicios': 0 };
        expect(calculateLoadWeight(cart, weights)).toBe(0);
    });

    it('usa peso por defecto de 5 para categorías sin configurar', () => {
        const cart: CartItem[] = [
            { id: 'p1', name: 'Producto', price: 100, quantity: 3, stock: 10, category: 'Ferreteria' }
        ];
        expect(calculateLoadWeight(cart)).toBe(15); // 5 × 3
    });

    it('carrito mixto: servicios + productos físicos', () => {
        const cart: CartItem[] = [
            { id: 'p1', name: 'Tornillo',  price: 10,  quantity: 4, stock: 100, category: 'Material' },
            { id: 's1', name: 'Consulta', price: 200,  quantity: 1, stock: 99,  category: 'Servicios' },
        ];
        const weights = { 'Material': 5, 'Servicios': 0 };
        expect(calculateLoadWeight(cart, weights)).toBe(20); // 5×4 + 0×1
    });
});
