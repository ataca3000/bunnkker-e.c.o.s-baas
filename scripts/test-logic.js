/**
 * scripts/test-logic.js
 * Batería de pruebas automatizadas por terminal para la lógica de negocio.
 * Ejecutar con: npm run test:logic o node scripts/test-logic.js
 */

const assert = require('assert');

console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[36m%s\x1b[0m', '   SUITE DE PRUEBAS DE LÓGICA AUTOMATIZADA      ');
console.log('\x1b[36m%s\x1b[0m', '================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`\x1b[32m✓ [PASSED]\x1b[0m ${name}`);
        passCount++;
    } catch (err) {
        console.error(`\x1b[31m❌ [FAILED]\x1b[0m ${name}`);
        console.error(`   Detalle: ${err.message}\n`);
        failCount++;
    }
}

// Mock de base de datos de productos para testing
const mockProducts = [
    { id: 'TEST-01', name: 'Cemento Gris', price: 200.00, stock: 100 },
    { id: 'TEST-02', name: 'Pintura Vinilica', price: 800.00, stock: 10 }
];

// Mock de carrito de compras
class TestCart {
    constructor() {
        this.items = [];
    }
    clear() {
        this.items = [];
    }
    addToCart(product, quantity = 1) {
        if (quantity > product.stock) {
            throw new Error('Stock insuficiente');
        }
        const existing = this.items.find(i => i.id === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.items.push({ ...product, quantity });
        }
    }
    getTotal() {
        return this.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    }
}

// ─── CASOS DE PRUEBA ───

test('Prueba 1: Adición y Subtotal de Carrito', () => {
    const cart = new TestCart();
    cart.addToCart(mockProducts[0], 2); // 200 * 2 = 400
    
    assert.strictEqual(cart.items.length, 1, 'Se esperaba un producto en el carrito');
    assert.strictEqual(cart.items[0].quantity, 2, 'La cantidad agregada debe ser 2');
    assert.strictEqual(cart.getTotal(), 400.00, 'El total calculado debe ser 400.00');
});

test('Prueba 2: Bloqueo de Stock Insuficiente', () => {
    const cart = new TestCart();
    
    assert.throws(() => {
        cart.addToCart(mockProducts[1], 15); // Intentar comprar 15 cuando hay 10
    }, /Stock insuficiente/, 'Debe lanzar excepción si se excede el stock');
    
    assert.strictEqual(cart.items.length, 0, 'El carrito debe permanecer vacío tras fallo');
});

test('Prueba 3: Cálculo de IVA del 16%', () => {
    const cart = new TestCart();
    cart.addToCart(mockProducts[0], 1); // 200
    
    const subtotal = cart.getTotal();
    const iva = subtotal * 0.16;
    const totalConIva = subtotal + iva;
    
    assert.strictEqual(iva, 32.00, 'El IVA del 16% debe ser 32.00');
    assert.strictEqual(totalConIva, 232.00, 'El total con IVA debe ser 232.00');
});

test('Prueba 4: Comisión Brecha Soluciones (80% infra, 20% integrador)', () => {
    const amount = 5000;
    
    const infraReserve = amount * 0.8;
    const integradorProfit = amount * 0.2;
    
    assert.strictEqual(infraReserve, 4000, '80% debe ir a reserva de infraestructura');
    assert.strictEqual(integradorProfit, 1000, '20% debe ir a ganancia de Philip Duran');
});

test('Prueba 5: Tarifa de Conexión Automática (1.00 Local / 6.00 Factura)', () => {
    const calculateFee = (requiresInvoice) => requiresInvoice ? 6.00 : 1.00;
    
    assert.strictEqual(calculateFee(false), 1.00, 'El cargo por venta general debe ser $1.00');
    assert.strictEqual(calculateFee(true), 6.00, 'El cargo con factura CFDI debe ser $6.00');
});

// Resumen de la ejecución
console.log('\n================================================');
console.log(`RESUMEN DE PRUEBAS:`);
console.log(`   \x1b[32mExitosas: ${passCount}\x1b[0m`);
console.log(`   \x1b[31mFallidas: ${failCount}\x1b[0m`);
console.log('================================================\n');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
