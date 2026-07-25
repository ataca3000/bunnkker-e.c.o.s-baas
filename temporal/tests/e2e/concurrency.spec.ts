import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const path = require('path');
const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || `file:${dbPath}`
    }
  }
});

test.describe('BUNKKER E.C.O.S - Simulador de Estrés y Flotante', () => {

  test.beforeAll(async () => {
    // 0. Limpiar todas las reservas flotantes en el servidor Socket.io
    try {
      const clientIo = require('socket.io-client');
      const socket = clientIo('http://localhost:3001');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          resolve(); // Continuar si el servidor de sockets no responde
        }, 3000);
        socket.on('connect', () => {
          socket.emit('clear_all_reservations');
          setTimeout(() => {
            socket.disconnect();
            clearTimeout(timeout);
            resolve();
          }, 300);
        });
      });
    } catch (e) {
      console.warn('No se pudo conectar al servidor de sincronización para limpiar reservas:', e.message);
    }

    // 1. Limpiar órdenes y productos anteriores de prueba de forma encadenada
    try {
      await prisma.orderItem.deleteMany({
        where: { productId: 'CONCURRENT_TEST' }
      });
      await prisma.order.deleteMany({
        where: { items: { some: { productId: 'CONCURRENT_TEST' } } }
      });
      await prisma.product.deleteMany({
        where: { id: 'CONCURRENT_TEST' }
      });
    } catch (e) {
      console.warn('Advertencia en limpieza inicial:', e.message);
    }

    // 2. Crear producto de prueba con exactamente STOCK = 1
    await prisma.product.create({
      data: {
        id: 'CONCURRENT_TEST',
        name: 'Producto de Prueba Concurrente',
        price: 150.0,
        stock: 1,
        category: 'Pruebas',
        description: 'Producto para validar la sobreventa y el inventario flotante',
      }
    });

    // 3. Asegurar que existan los trabajadores en la base de datos local limpiamente
    const workers = [
      { id: 'usr-admin', name: 'Super Admin', pin: '0000', role: 'superadmin' },
      { id: 'usr-cajero', name: 'Cajero Principal', pin: '1111', role: 'caja' },
      { id: 'usr-almacen', name: 'Jefe Almacén', pin: '2222', role: 'almacen' },
      { id: 'usr-chofer', name: 'Repartidor Ruta 1', pin: '3333', role: 'repartidor' },
    ];

    const crypto = require('crypto');
    for (const w of workers) {
      const sha256Pin = crypto.createHash('sha256').update(w.pin).digest('hex');
      try {
        await prisma.user.deleteMany({
          where: {
            OR: [
              { id: w.id },
              { pin: w.pin },
              { pin: sha256Pin }
            ]
          }
        });
      } catch (e) {
        console.warn(`Error limpiando usuario ${w.id}:`, e.message);
      }
    }

    for (const w of workers) {
      const pinHash = require('bcryptjs').hashSync(w.pin, 10);
      try {
        await prisma.user.create({
          data: { id: w.id, pin: w.pin, name: w.name, role: w.role, active: true, pinHash }
        });
      } catch (e) {
        console.error(`Error creando usuario ${w.id}:`, e.message);
        throw e;
      }
    }
  });

  test('Guerra de Compras: Evitar sobreventas en concurrencia', async ({ browser }) => {
    test.setTimeout(90000);
    // --- 1. REGISTRO Y PREPARACIÓN DE DOS CLIENTES SIMULTÁNEOS ---
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Registrar Cliente A
    pageA.on('console', msg => console.log(`[Browser Console A]: ${msg.text()}`));
    pageA.on('pageerror', err => console.error(`[Browser PageError A]: ${err.stack}`));
    
    await pageA.goto('/cuenta');
    await pageA.locator('button:has-text("Regístrate")').click();
    await pageA.getByPlaceholder('Ej. Juan Pérez').fill('Cliente A');
    await pageA.getByPlaceholder('5551234567').fill('5512345670');
    await pageA.getByPlaceholder('••••').fill('1111');
    await pageA.locator('button:has-text("Crear mi cuenta")').click();
    await pageA.waitForTimeout(1000); // Dar tiempo a que guarde la cookie

    // Registrar Cliente B
    await pageB.goto('/cuenta');
    await pageB.locator('button:has-text("Regístrate")').click();
    await pageB.getByPlaceholder('Ej. Juan Pérez').fill('Cliente B');
    await pageB.getByPlaceholder('5551234567').fill('5512345671');
    await pageB.getByPlaceholder('••••').fill('1111');
    await pageB.locator('button:has-text("Crear mi cuenta")').click();
    await pageB.waitForTimeout(1000);

    // Ambos van al catálogo y añaden el producto
    await pageA.goto('/catalogo');
    await pageB.goto('/catalogo');

    // Esperar a que el producto cargue en el catálogo en ambos
    await pageA.waitForSelector('text=Producto de Prueba Concurrente');
    await pageB.waitForSelector('text=Producto de Prueba Concurrente');

    // Agregar al carrito en ambos (específico del producto creado usando contenedor de tarjeta)
    await pageA.locator('div.p-5').filter({ hasText: 'Producto de Prueba Concurrente' }).locator('button:has-text("AGREGAR")').click();
    await pageB.locator('div.p-5').filter({ hasText: 'Producto de Prueba Concurrente' }).locator('button:has-text("AGREGAR")').click();

    // Ir a la pantalla de pago (checkout)
    await pageA.goto('/carrito/checkout');
    await pageB.goto('/carrito/checkout');

    // Seleccionar método de entrega (A domicilio)
    await pageA.locator('text=A DOMICILIO / OBRA').click();
    await pageA.getByPlaceholder('Dirección de Obra *').fill('Calle Falsa 123');
    await pageA.getByPlaceholder('Código Postal').fill('03000');

    await pageB.locator('text=A DOMICILIO / OBRA').click();
    await pageB.getByPlaceholder('Dirección de Obra *').fill('Calle Falsa 123');
    await pageB.getByPlaceholder('Código Postal').fill('03000');

    // Datos del cliente
    await pageA.getByPlaceholder('Nombre Completo *').fill('Cliente A');
    await pageA.getByPlaceholder('Teléfono Celular *').fill('5512345670');
    await pageB.getByPlaceholder('Nombre Completo *').fill('Cliente B');
    await pageB.getByPlaceholder('Teléfono Celular *').fill('5512345671');

    // --- 2. EL CHOQUE CONCURRENTE (RACE CONDITION) ---
    // Ambos clientes hacen clic en comprar al mismo microsegundo
    const submitA = pageA.locator('button:has-text("CONFIRMAR Y LEVANTAR PEDIDO")').click();
    const submitB = pageB.locator('button:has-text("CONFIRMAR Y LEVANTAR PEDIDO")').click();

    await Promise.all([submitA, submitB]);

    // Esperar resultados de la batalla
    await pageA.waitForTimeout(2000);
    await pageB.waitForTimeout(2000);

    // Uno debió ganar y el otro debió ser rebotado por falta de stock
    const titleA = await pageA.locator('h1, h2').first().innerText();
    const titleB = await pageB.locator('h1, h2').first().innerText();

    const orderSuccessA = titleA.toUpperCase().includes('REGISTRADO') || titleA.toUpperCase().includes('CONFIRMADO') || titleA.toUpperCase().includes('GRACIAS');
    const orderSuccessB = titleB.toUpperCase().includes('REGISTRADO') || titleB.toUpperCase().includes('CONFIRMADO') || titleB.toUpperCase().includes('GRACIAS');

    // Validación lógica del inventario flotante: Uno de los dos debió triunfar, nunca ambos
    expect(orderSuccessA !== orderSuccessB).toBe(true);

    console.log(`🏆 El ganador de la batalla de stock fue: ${orderSuccessA ? 'Cliente A' : 'Cliente B'}`);

    // --- 2.5 SIMULAR PAGO DE LA ORDEN GANADORA ---
    const winnerOrder = await prisma.order.findFirst({
      where: { status: 'PENDING_PAYMENT' },
      orderBy: { date: 'desc' }
    });

    expect(winnerOrder).toBeDefined();
    await prisma.order.update({
      where: { id: winnerOrder!.id },
      data: { status: 'paid' }
    });
    console.log(`💰 Pago registrado en base de datos para la orden ${winnerOrder!.id}.`);

    // --- 3. LOGÍSTICA DE PISO DE CARGA (ALMACÉN) ---
    const contextWorker = await browser.newContext();
    const pageWorker = await contextWorker.newPage();

    // Loguear Almacén (PIN: 2222)
    await pageWorker.goto('/login');
    const pinModeBtn = pageWorker.getByRole('button', { name: /PIN Acceso/i });
    if (await pinModeBtn.isVisible()) await pinModeBtn.click();
    await pageWorker.getByPlaceholder('••••••').fill('2222');
    await pageWorker.getByRole('button', { name: /Desbloquear/i }).click();
    await pageWorker.waitForURL(url => !url.pathname.includes('/login'));
    await pageWorker.waitForTimeout(1000);

    // Ir al panel de Cargas / Almacén y verificar que la orden cargó
    await pageWorker.goto('/dashboard/patio');
    await expect(pageWorker).toHaveURL(/\/dashboard\/patio/);

    // Simular que el cargador completa la carga (evitando el scanner físico)
    await prisma.order.update({
      where: { id: winnerOrder!.id },
      data: {
        status: 'OUT_FOR_DELIVERY'
      }
    });
    console.log(`📦 Almacén: Carga despachada (simulado OUT_FOR_DELIVERY) para orden ${winnerOrder!.id}.`);

    // --- 4. ENTREGA DE CHOFER (REPARTIDOR) ---
    // Limpiar cookies para cerrar sesión de Almacén y evitar redirecciones automáticas
    await contextWorker.clearCookies();

    // Cambiar sesión a Repartidor (PIN: 3333)
    await pageWorker.goto('/login');
    await pageWorker.getByPlaceholder('••••••').fill('3333');
    await pageWorker.getByRole('button', { name: /Desbloquear/i }).click();
    await pageWorker.waitForURL(url => !url.pathname.includes('/login'));
    await pageWorker.waitForTimeout(1000);

    // Ir al panel de Delivery
    await pageWorker.goto('/dashboard/delivery');
    await expect(pageWorker).toHaveURL(/\/dashboard\/delivery/);

    // Cerrar la entrega (flujo completo del repartidor)
    // 1. Reclamar la orden disponible en la bolsa de pedidos
    const tomarBtn = pageWorker.locator('button:has-text("Tomar")').first();
    await expect(tomarBtn).toBeVisible({ timeout: 5000 });
    await tomarBtn.click();
    console.log('🚚 Repartidor: Orden reclamada/tomada de la bolsa.');

    // 2. Cambiar a la pestaña "MI RUTA"
    const routeTab = pageWorker.locator('span:has-text("MI RUTA"), :text("MI RUTA")').first();
    await expect(routeTab).toBeVisible({ timeout: 5000 });
    await routeTab.click();
    await pageWorker.waitForTimeout(1000);

    // 3. Abrir el mapa / control de la entrega (Iniciar/Entregar)
    const startBtn = pageWorker.locator('button[aria-label="Ir a entrega"]').first();
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();
    await pageWorker.waitForTimeout(1000);

    // 4. Cambiar al modo de confirmación ("Entregar")
    const preDeliverBtn = pageWorker.locator('button:has-text("Entregar")').first();
    await expect(preDeliverBtn).toBeVisible({ timeout: 5000 });
    await preDeliverBtn.evaluate(el => (el as HTMLElement).click());
    await pageWorker.waitForTimeout(1000);

    // 5. Confirmar entrega definitiva (el PIN es opcional y no se requiere si no está en la base de datos)
    const doneBtn = pageWorker.locator('button:has-text("CONFIRMAR ENTREGA")').first();
    await expect(doneBtn).toBeVisible({ timeout: 5000 });
    await doneBtn.evaluate(el => (el as HTMLElement).click());
    console.log('🚚 Repartidor: Entrega confirmada y cerrada.');

    // --- 5. AUDITORÍA FINAL ---
    const finalStock = await prisma.product.findUnique({
      where: { id: 'CONCURRENT_TEST' },
      select: { stock: true }
    });

    console.log(`📉 Stock final en base de datos: ${finalStock?.stock}`);
    expect(finalStock?.stock).toBe(0); // El stock se redujo limpiamente a 0, evitando sobreventas.
  });
});
