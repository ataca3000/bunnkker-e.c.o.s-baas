import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, increment } from 'firebase/firestore';

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
                    // Generar un ID para Firestore o usar uno si ya viene
                    const docId = task.documentId || task.id;

                    // A) Guardar en Firestore la orden
                    await setDoc(doc(db, 'orders', docId), {
                        ...payload,
                        syncedAt: new Date().toISOString()
                    });

                    // B) Descontar inventario en Firestore (para sincronizar con los demás clientes)
                    if (payload.items && Array.isArray(payload.items)) {
                        for (const item of payload.items) {
                            try {
                                await updateDoc(doc(db, 'products', item.id), {
                                    stock: increment(-item.quantity)
                                });
                            } catch (err) {
                                console.warn(`[Worker] No se pudo actualizar stock de ${item.id} en Firebase. Puede que no exista en la nube.`);
                            }
                        }
                    }

                    // C) Marcar la orden local como sincronizada
                    if (payload.localOrderId) {
                        await prisma.order.update({
                            where: { id: payload.localOrderId },
                            data: { synced: true }
                        });
                    }
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
