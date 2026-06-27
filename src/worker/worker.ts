import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';

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

console.log("🚀 [Worker] Iniciando Background Sync Worker...");

async function processQueue() {
    try {
        // 1. Buscar registros pendientes o que fallaron anteriormente
        const pendingTasks = await prisma.syncQueue.findMany({
            where: {
                status: { in: ['PENDING', 'FAILED'] }
            },
            orderBy: {
                createdAt: 'asc'
            },
            take: 10 // Procesar en lotes de 10
        });

        if (pendingTasks.length === 0) {
            return; // Nada que hacer
        }

        console.log(`[Worker] Encontradas ${pendingTasks.length} tareas pendientes.`);

        // 2. Procesar cada tarea
        for (const task of pendingTasks) {
            console.log(`[Worker] Procesando tarea ${task.id} - ${task.action} en ${task.collection}`);
            
            // Cambiar a PROCESSING para evitar colisiones
            await prisma.syncQueue.update({
                where: { id: task.id },
                data: { status: 'PROCESSING' }
            });

            try {
                const payload = JSON.parse(task.payload);

                if (task.collection === 'orders' && task.action === 'CREATE') {
                    const docId = task.documentId || task.id;
                    await setDoc(doc(db, 'orders', docId), {
                        ...payload,
                        syncedAt: new Date().toISOString()
                    });

                    if (payload.items && Array.isArray(payload.items)) {
                        for (const item of payload.items) {
                            try {
                                await updateDoc(doc(db, 'products', item.id), {
                                    stock: increment(-item.quantity),
                                    syncedAt: new Date().toISOString()
                                });
                            } catch (err) {}
                        }
                    }

                    if (payload.localOrderId) {
                        await prisma.order.update({
                            where: { id: payload.localOrderId },
                            data: { synced: true }
                        });
                    }
                } else if (task.collection === 'invoices' && task.action === 'CREATE') {
                    const Facturapi = require('facturapi').default || require('facturapi');
                    let apiKey = process.env.FACTURAPI_KEY;

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
                // P2025 = Record to update/delete not found (ya lo procesó otro hilo)
                if (err.code === 'P2025') {
                    console.log(`[Worker] ⚠️ Tarea ${task.id} ya no existe (procesada por otro hilo).`);
                    continue;
                }

                console.error(`[Worker] ❌ Error procesando tarea ${task.id}:`, err.message);
                // Si falla, lo devolvemos a FAILED con el mensaje de error
                try {
                    await prisma.syncQueue.update({
                        where: { id: task.id },
                        data: { 
                            status: 'FAILED',
                            errorMsg: err.message
                        }
                    });
                } catch (updateErr: any) {
                    if (updateErr.code !== 'P2025') {
                        console.error(`[Worker] Error crítico al actualizar tarea a FAILED:`, updateErr.message);
                    }
                }
            }
        }
    } catch (e) {
        console.error("[Worker] Error crítico en el ciclo de proceso:", e);
    }
}

// Ejecutar cada 10 segundos
setInterval(processQueue, 10000);

// Ejecutar una vez al inicio
processQueue();
