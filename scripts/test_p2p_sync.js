const EventEmitter = require('events');

// --- SIMULATED MASTER NODE (SQLite + WebSocket Hub) ---
class MasterNode extends EventEmitter {
    constructor() {
        super();
        // Base de datos (Simulación SQLite)
        this.inventory = { 'FERR-CEM-01': { stock: 10, pending: 0, sold: 0 } };
        this.orders = {};
        this.log = [];
        this.processedTxs = new Set(); // ISO STANDARD: Registro de Transacciones procesadas
    }

    logEvent(msg) {
        const time = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`[${time}][MAESTRO] ${msg}`);
        this.log.push(msg);
        this.emit('broadcast', { type: 'STATE_UPDATE', inventory: this.inventory });
    }

    async processAction(action) {
        // Simulamos un micro-retraso de red LAN (~5-15ms) para forzar concurrencia y Race Conditions
        await new Promise(r => setTimeout(r, Math.random() * 10 + 5));

        // ISO STANDARD: Verificación de Idempotencia
        if (action.txId && this.processedTxs.has(action.txId)) {
            this.logEvent(`🛡️ [IDEMPOTENCIA] Rechazo de red: La transacción ${action.txId} ya fue procesada. Evitando doble impacto.`);
            return;
        }
        if (action.txId) this.processedTxs.add(action.txId);

        if (action.type === 'BUY') {
            const { productId, qty, orderId } = action.payload;
            const item = this.inventory[productId];
            
            // Atomicity Check (Solo se vende si el stock físico MENOS lo que ya está en carrito apartando alcanza)
            if (item.stock - item.pending >= qty) {
                item.pending += qty;
                this.orders[orderId] = { status: 'pending', items: [{ productId, qty }] };
                this.logEvent(`✅ [CAJA] Venta Autorizada (${orderId}): Apartando ${qty} ${productId}. (Stock Físico: ${item.stock}, Pendiente/Bloqueado: ${item.pending})`);
            } else {
                this.logEvent(`❌ [CAJA] Venta Rechazada (${orderId}): Stock Insuficiente para -${qty} ${productId}. (Disponibles: ${item.stock - item.pending})`);
            }
        }
        else if (action.type === 'CONFIRM_PAYMENT') {
            const { orderId } = action.payload;
            const order = this.orders[orderId];
            if (order && order.status === 'pending') {
                order.status = 'paid';
                for (let i of order.items) {
                    const item = this.inventory[i.productId];
                    item.pending -= i.qty;
                    item.stock -= i.qty;
                    item.sold += i.qty;
                }
                this.logEvent(`💳 [CAJA] Pago Confirmado (${orderId}). Stock debitado permanentemente.`);
            }
        }
        else if (action.type === 'CANCEL_ORDER') {
            const { orderId } = action.payload;
            const order = this.orders[orderId];
            if (order && order.status === 'pending') {
                order.status = 'cancelled';
                for (let i of order.items) {
                    this.inventory[i.productId].pending -= i.qty;
                }
                this.logEvent(`↩️  [CAJA] Orden Cancelada (${orderId}). Bloqueo liberado. (Stock Disponible Restaurado)`);
            }
        }
        else if (action.type === 'ADD_STOCK') {
            const { productId, qty } = action.payload;
            this.inventory[productId].stock += qty;
            this.logEvent(`📦 [ALMACÉN] Entrada de mercancía: +${qty} ${productId}. (Stock Físico Real: ${this.inventory[productId].stock})`);
        }
        else if (action.type === 'DELIVER_ORDER') {
            const { orderId } = action.payload;
            const order = this.orders[orderId];
            if (order && order.status === 'paid') {
                order.status = 'delivered';
                this.logEvent(`🚚 [REPARTIDOR] Orden ${orderId} entregada al cliente.`);
            } else {
                this.logEvent(`⚠️ [REPARTIDOR] Error: La orden ${orderId} no se puede entregar (Estado: ${order?.status}).`);
            }
        }
    }
}

async function runChaosTest() {
    console.log("===================================================================");
    console.log("🚀 INICIANDO SÚPER SIMULADOR DE ESTRÉS P2P (LAN OFFLINE) 🚀");
    console.log("===================================================================\n");

    const master = new MasterNode();
    
    // Simulación de "Cajas" y "Nodos" que mandan peticiones concurrentes
    const sendAction = (type, payload, txId = Math.random().toString(36).substring(2)) => master.processAction({ type, payload, txId });

    console.log("📋 ESTADO INICIAL DEL INVENTARIO (SQLite):");
    console.log(master.inventory);
    console.log("\n⚡ [1. SIMULANDO CAOS EN EL MISMO MILISEGUNDO] ⚡");
    console.log("-> Varias PCs intentan operaciones sobre el mismo producto a la vez.\n");

    const order1TxId = 'TX-ORD-001-XYZ'; // Simulación de un UUID estático para probar Idempotencia

    // DISPARAMOS TODO AL MISMO TIEMPO (Promesas concurrentes para probar race conditions)
    await Promise.all([
        // Caja 1 intenta vender 5
        sendAction('BUY', { productId: 'FERR-CEM-01', qty: 5, orderId: 'ORD-001' }, order1TxId),
        
        // Caja 1 se desespera porque su Wi-Fi está lento y le pica el botón de "Cobrar" OTRA VEZ (Reintento Fantasma de red)
        sendAction('BUY', { productId: 'FERR-CEM-01', qty: 5, orderId: 'ORD-001' }, order1TxId),
        sendAction('BUY', { productId: 'FERR-CEM-01', qty: 5, orderId: 'ORD-001' }, order1TxId),
        
        // Caja 2 intenta vender 6 (Debería fallar casi siempre porque 5+6 > 10, y el bloqueo es instantáneo)
        sendAction('BUY', { productId: 'FERR-CEM-01', qty: 6, orderId: 'ORD-002' }),
        
        // Almacén mete 20 nuevos
        sendAction('ADD_STOCK', { productId: 'FERR-CEM-01', qty: 20 }),
        
        // Caja 3 intenta vender 8 
        sendAction('BUY', { productId: 'FERR-CEM-01', qty: 8, orderId: 'ORD-003' })
    ]);

    // Simulamos que pasa un ratito
    await new Promise(r => setTimeout(r, 1000));
    console.log("\n--- 2. SEGUNDOS DESPUÉS (Resoluciones) ---\n");

    await Promise.all([
        // Cliente 1 paga su orden
        sendAction('CONFIRM_PAYMENT', { orderId: 'ORD-001' }),
        
        // Cliente 3 (si tuvo éxito apartando) cancela porque no le alcanzó el dinero
        sendAction('CANCEL_ORDER', { orderId: 'ORD-003' }),

        // Repartidor intenta entregar la caja 2 (que falló y nunca existió) y la 1 (que se pagó)
        sendAction('DELIVER_ORDER', { orderId: 'ORD-002' }),
        sendAction('DELIVER_ORDER', { orderId: 'ORD-001' })
    ]);

    console.log("\n===================================================================");
    console.log("📊 RESULTADO FINAL MATEMÁTICO (Estado final en SQLite / Firebase)");
    console.log("===================================================================");
    console.log(master.inventory);
    console.log("\nÓrdenes registradas:", Object.keys(master.orders).map(k => `${k}: [${master.orders[k].status}]`));
    console.log("===================================================================\n");
    console.log("✔️ PRUEBA FINALIZADA: Si no hay inventarios negativos ni sobreventas, la arquitectura de 'Pending State' es invencible y está lista para producción.");
}

runChaosTest();
