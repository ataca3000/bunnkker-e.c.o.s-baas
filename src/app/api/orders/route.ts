import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db as firestore } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { validateApiSession } from '@/lib/apiAuth';


export async function GET() {
    try {
        const orders = await prisma.order.findMany({
            include: { items: true },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json({ success: true, data: orders });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const body = await request.json();
        const { orderId, total, deliveryType, paymentMethod, clientData, items } = body;

        // Garantía de Transacción ACID local
        const orderResult = await prisma.$transaction(async (tx) => {
            
            // 1. Resolver o Crear Cliente por Teléfono (si existe clientData y tiene teléfono)
            let customerId: string | null = null;
            if (clientData && clientData.phone) {
                let customer = await tx.customer.findUnique({
                    where: { phone: clientData.phone }
                });

                if (!customer) {
                    customer = await tx.customer.create({
                        data: {
                            tenantId,
                            name: clientData.name || 'Cliente Genérico',
                            phone: clientData.phone,
                            address: clientData.address || null,
                            references: clientData.references || null
                        }
                    });
                } else if (deliveryType === 'DELIVERY' && clientData.address) {
                    // Actualizar datos de entrega si regresó con nueva dirección
                    customer = await tx.customer.update({
                        where: { id: customer.id },
                        data: {
                            address: clientData.address,
                            references: clientData.references
                        }
                    });
                }
                customerId = customer.id;
            }

            // 2. Descuento en Caliente de Inventario Local con Validación Atómica (Evita Race Conditions)
            for (const item of items) {
                // Modificación atómica del stock usando decremento a nivel de base de datos
                const product = await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });

                if (product.stock < 0) {
                    // Si el stock cae por debajo de 0, forzamos Rollback
                    throw new Error(`Inventario insuficiente para el producto: (ID: ${item.productId}). (Intentando sobre-vender)`);
                }
            }

            // 3. Creación de la Orden en el Pipeline Logístico
            return await tx.order.create({
                data: {
                    id: orderId,
                    tenantId,
                    total,
                    deliveryType: deliveryType || 'LOCAL', // LOCAL, PICKUP, PATIO, DELIVERY
                    paymentMethod: paymentMethod || 'CASH', // Aseguramos el método de pago obligatorio
                    status: 'PENDING_PAYMENT', // Estado inicial en la fila de espera
                    customerId: customerId
                },
                include: { customer: true }
            });
        });

        // NOTA: El frontend receptor de la PWA se encarga de inyectar este payload 
        // en el SDK de Firebase, aprovechando la persistencia de IndexedDB de forma transparente.
        return NextResponse.json({ success: true, data: orderResult });

    } catch (error: any) {
        console.error(`[ACID Transaction Error]: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


export async function PATCH(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, ...updates } = body;
        
        if (!id) throw new Error('Order ID is required');

        let order;

        if (updates.status === 'cancelled') {
            // Fetch items to restore stock
            const existingOrder = await prisma.order.findUnique({
                where: { id },
                include: { items: true }
            });

            if (existingOrder && existingOrder.status !== 'cancelled') {
                order = await prisma.$transaction([
                    prisma.order.update({ where: { id }, data: updates }),
                    ...existingOrder.items.map((item: any) =>
                        prisma.product.updateMany({
                            where: { id: item.productId },
                            data: { stock: { increment: item.cantidad } }
                        })
                    )
                ]);
                order = order[0]; // Get the updated order from transaction
            } else {
                order = await prisma.order.update({ where: { id }, data: updates });
            }
        } else {
            order = await prisma.order.update({
                where: { id },
                data: updates
            });
        }

        // 2. Notificar a Firebase para que gestione su cola de persistencia nativa
        const cloudPayload = { ...updates, _syncedAt: Date.now() };
        
        // El SDK de Firebase encola esto localmente si no hay red
        setDoc(doc(firestore, `orders`, id), cloudPayload, { merge: true })
            .then(() => console.log(`[Firebase Sync] Actualización encolada/subida: ${id}`))
            .catch((err: any) => console.error(`[Firebase Sync] Error en persistencia:`, err.message));

        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
