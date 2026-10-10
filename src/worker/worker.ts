import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, runTransaction, disableNetwork, enableNetwork } from 'firebase/firestore';

const prisma = new PrismaClient();

// Configuración leída de .env.local
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Estado de red y backoff exponencial ───────────────────────────────────────────
let _networkOk = true;
let _reconnectBackoffMs = 2_000;
const MAX_BACKOFF_MS = 120_000; // 2 minutos máximo
let _reconnectPromise: Promise<void> | null = null;
const MAX_TASK_RETRIES = 8;
const BASE_TASK_RETRY_MS = 15_000;
const MAX_TASK_RETRY_MS = 15 * 60_000;

/** Detecta si un error es de red transitoria (TCP abortado, wsarecv, etc.) */
function isNetworkError(err: any): boolean {
  const msg = String(err?.message ?? err ?? '');
  return (
    msg.includes('stream reading error') ||
    msg.includes('wsarecv') ||
    msg.includes('WebChannelConnection') ||
    msg.includes('transport errored') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT')
  );
}

/** Reconecta Firestore con backoff exponencial */
async function reconnectFirestore(): Promise<void> {
  if (_reconnectPromise) return _reconnectPromise;

  _networkOk = false;
  _reconnectPromise = (async () => {
    while (!_networkOk) {
      const delayMs = _reconnectBackoffMs;
      console.warn(`⚠️ [Worker] Firestore no disponible; nuevo intento en ${Math.ceil(delayMs / 1000)}s.`);
      await new Promise(r => setTimeout(r, delayMs));
      try {
        await disableNetwork(db);
        await enableNetwork(db);
        _networkOk = true;
        _reconnectBackoffMs = 2_000;
        console.log('✅ [Worker] Transporte Firestore reactivado; se reanudará la cola.');
      } catch (err) {
        console.error('[Worker] Falló la reconexión de Firestore:', err);
        _reconnectBackoffMs = Math.min(_reconnectBackoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  })().finally(() => {
    _reconnectPromise = null;
  });

  return _reconnectPromise;
}

console.log("🚀 [Worker] Iniciando Background Sync Worker...");

async function processQueue() {
    // Si la red está caida, saltar este ciclo
    if (!_networkOk) return;

    try {
        // 1. Buscar registros pendientes o que fallaron anteriormente
        const now = new Date();
        const pendingTasks = await prisma.syncQueue.findMany({
            where: {
                status: { in: ['PENDING', 'FAILED'] },
                OR: [
                    { processAfter: null },
                    { processAfter: { lte: now } }
                ]
            },
            orderBy: [
                { createdAt: 'asc' },
                { id: 'asc' }
            ],
            take: 10 // Procesar en lotes de 10
        });

        if (pendingTasks.length === 0) {
            return; // Nada que hacer
        }

        console.log(`[Worker] Encontradas ${pendingTasks.length} tareas pendientes.`);

        // 2. Procesar cada tarea
        for (const task of pendingTasks) {
            console.log(`[Worker] Procesando tarea ${task.id} - ${task.action} en ${task.collection}`);
            
            // Reclamo atómico: evita que dos workers procesen la misma tarea a la vez.
            const claim = await prisma.syncQueue.updateMany({
                where: { id: task.id, status: task.status },
                data: { status: 'PROCESSING' }
            });
            if (claim.count === 0) continue;

            try {
                const payload = JSON.parse(task.payload);

                if (task.collection === 'orders' && task.action === 'CREATE') {
                    const docId = task.documentId || payload.localOrderId || task.id;
                    const orderRef = doc(db, 'orders', docId);
                    // El recibo evita descontar inventario dos veces si el worker se cae
                    // después de confirmar la venta en Firestore y antes de borrar la cola local.
                    const receiptRef = doc(db, 'sync_receipts', docId);
                    const items = Array.isArray(payload.items) ? payload.items : [];
                    const normalizedItems = items.map((item: any) => ({
                        id: String(item.id || item.productId || ''),
                        quantity: Number(item.quantity ?? item.cantidad)
                    }));

                    if (normalizedItems.length === 0 || normalizedItems.some((item: any) =>
                        !item.id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
                    )) {
                        throw new Error('La venta contiene productos o cantidades inválidas; no se sincronizó.');
                    }

                    // Consolidar líneas repetidas del mismo producto para no calcular
                    // varias veces el stock usando la misma lectura inicial.
                    const inventoryItems = Array.from(
                        normalizedItems.reduce((totals: Map<string, number>, item: any) => {
                            totals.set(item.id, (totals.get(item.id) || 0) + item.quantity);
                            return totals;
                        }, new Map<string, number>()),
                        ([id, quantity]) => ({ id, quantity })
                    );

                    if (inventoryItems.some(item => !Number.isSafeInteger(item.quantity))) {
                        throw new Error('La cantidad acumulada de un producto excede el límite permitido.');
                    }

                    await runTransaction(db, async (transaction) => {
                        const receipt = await transaction.get(receiptRef);
                        if (receipt.exists()) return; // Venta ya aplicada: operación idempotente.

                        const productRefs = inventoryItems.map((item: any) => doc(db, 'products', item.id));
                        const productSnapshots = [];
                        for (const productRef of productRefs) {
                            productSnapshots.push(await transaction.get(productRef));
                        }

                        for (let i = 0; i < inventoryItems.length; i++) {
                            const productSnapshot: any = productSnapshots[i];
                            const item: any = inventoryItems[i];
                            if (!productSnapshot.exists()) {
                                throw new Error(`No existe el producto ${item.id}; se conserva la tarea para revisión/reintento.`);
                            }
                            const currentStock = Number(productSnapshot.data()?.stock);
                            if (!Number.isFinite(currentStock) || currentStock < item.quantity) {
                                throw new Error(`Stock insuficiente o inválido para el producto ${item.id}; venta ${docId} no aplicada.`);
                            }
                        }

                        transaction.set(orderRef, {
                            ...payload,
                            syncedAt: new Date().toISOString()
                        });

                        for (let i = 0; i < inventoryItems.length; i++) {
                            const item: any = inventoryItems[i];
                            const productSnapshot: any = productSnapshots[i];
                            transaction.update(productRefs[i], {
                                stock: Number(productSnapshot.data()?.stock) - item.quantity,
                                syncedAt: new Date().toISOString()
                            });
                        }

                        transaction.set(receiptRef, {
                            orderId: docId,
                            localOrderId: payload.localOrderId || null,
                            appliedAt: new Date().toISOString(),
                            itemCount: normalizedItems.length
                        });
                    });

                    if (payload.localOrderId) {
                        await prisma.order.update({
                            where: { id: payload.localOrderId },
                            data: { synced: true }
                        });
                    }
                } else if (task.collection === 'invoices' && task.action === 'CREATE') {
                    const Facturapi = require('facturapi').default || require('facturapi');
                    let apiKey = process.env.FACTURAPI_KEY;

                    // Evitar bucles infinitos: cancelar tarea si pasa de 5 intentos
                    const attempts = payload._attempts || 0;
                    if (attempts >= 5) {
                        await prisma.syncQueue.update({
                            where: { id: task.id },
                            data: { 
                                status: 'FAILED_PERMANENTLY',
                                errorMsg: 'Superado el límite de 5 intentos automáticos. Error de cliente permanente (RFC o datos inválidos).'
                            }
                        });
                        console.log(`[Worker] ❌ Tarea ${task.id} de facturación cancelada permanentemente (5 reintentos fallidos).`);
                        continue;
                    }

                    try {
                        const secretSnap = await getDoc(doc(db, 'tenants', payload.tenantId || 'default', 'secrets', 'keys'));
                        if (secretSnap.exists() && secretSnap.data()?.facturapi_key) {
                            apiKey = secretSnap.data().facturapi_key;
                        }
                    } catch (e) {
                        console.error("[Worker] Error leyendo keys de firestore para reintento:", e);
                    }

                    if (!apiKey) {
                        throw new Error("API Key de Facturapi no disponible en el entorno del worker.");
                    }

                    const facturapiInstance = new Facturapi(apiKey);
                    const invoice = await facturapiInstance.invoices.create({
                        customer: payload.customer,
                        items: payload.items,
                        payment_form: payload.payment_form,
                        use: payload.use,
                        type: payload.type,
                    });

                    console.log(`[Worker] ✅ Factura creada con éxito en Facturapi (Reintento) ID: ${invoice.id}`);
                } else if (task.action === 'UPDATE' || task.action === 'UPSERT') {
                    const docId = task.documentId || task.id;
                    await setDoc(doc(db, task.collection, docId), {
                        ...payload,
                        syncedAt: new Date().toISOString()
                    }, { merge: true });
                } else if (task.action === 'DELETE') {
                    // Firebase deleteDoc is imported? We need it, or we just set it as deleted.
                    const docId = task.documentId || task.id;
                    await setDoc(doc(db, task.collection, docId), {
                        deleted: true,
                        syncedAt: new Date().toISOString()
                    }, { merge: true });
                }

                // Si todo sale bien, ELIMINAMOS la tarea para ahorrar espacio local
                await prisma.syncQueue.delete({
                    where: { id: task.id }
                });

                console.log(`[Worker] ✅ Tarea ${task.id} completada y eliminada.`);
            } catch (err: any) {
                // Si Firestore falla, detener temporalmente el worker y reconectar con backoff.
                // La tarea permanece en la cola con processAfter; no se pierde la operación.
                if (isNetworkError(err)) {
                    void reconnectFirestore();
                }

                // P2025 = Record to update/delete not found (ya lo procesó otro hilo)
                if (err.code === 'P2025') {
                    console.log(`[Worker] ⚠️ Tarea ${task.id} ya no existe (procesada por otro hilo).`);
                    continue;
                }

                console.error(`[Worker] ❌ Error procesando tarea ${task.id}:`, err.message);
                // Si falla, incrementamos intentos si es factura y lo devolvemos a FAILED con el mensaje de error
                try {
                    let nextPayload = task.payload;
                    if (task.collection === 'invoices') {
                        try {
                            const parsed = JSON.parse(task.payload);
                            parsed._attempts = (parsed._attempts || 0) + 1;
                            nextPayload = JSON.stringify(parsed);
                        } catch (e) {}
                    }

                    const nextRetryCount = (task.retryCount || 0) + 1;
                    const permanentlyFailed = nextRetryCount >= MAX_TASK_RETRIES;
                    const backoffMs = Math.min(
                        BASE_TASK_RETRY_MS * (2 ** Math.max(0, nextRetryCount - 1)),
                        MAX_TASK_RETRY_MS
                    );
                    const jitterMs = Math.floor(Math.random() * Math.min(backoffMs * 0.2, 5_000));

                    await prisma.syncQueue.update({
                        where: { id: task.id },
                        data: {
                            status: permanentlyFailed ? 'FAILED_PERMANENT' : 'FAILED',
                            payload: nextPayload,
                            errorMsg: String(err?.message || err).slice(0, 2_000),
                            retryCount: nextRetryCount,
                            processAfter: permanentlyFailed ? null : new Date(Date.now() + backoffMs + jitterMs)
                        }
                    });

                    if (permanentlyFailed) {
                        console.error(`[Worker] ⛔ Tarea ${task.id} agotó ${MAX_TASK_RETRIES} intentos y requiere revisión manual.`);
                    } else {
                        console.warn(`[Worker] Reintento ${nextRetryCount}/${MAX_TASK_RETRIES} de ${task.id} programado en ${Math.ceil((backoffMs + jitterMs) / 1000)}s.`);
                    }
                } catch (updateErr: any) {
                    if (updateErr.code !== 'P2025') {
                        console.error(`[Worker] Error crítico al actualizar tarea a FAILED:`, updateErr.message);
                    }
                }
            }
        }
    } catch (e: any) {
        if (isNetworkError(e)) {
            // Error de TCP/stream — reconectar silenciosamente con backoff
            reconnectFirestore(); // No await — el siguiente ciclo verá _networkOk=false
        } else {
            console.error("[Worker] Error crítico en el ciclo de proceso:", e);
        }
    }
}

// Ejecutar cada 10 segundos
setInterval(processQueue, 10000);

// Ejecutar una vez al inicio
processQueue();
