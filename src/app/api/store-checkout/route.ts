import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth as firebaseAdminAuth } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        // 1. Extraer Payload del carrito
        const body = await req.json().catch(() => ({}));
        const { tenantId = 'default', items, customerData, requiresInvoice = false, isOnline = true } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios o el carrito está vacío' }, { status: 400 });
        }

        // 2. Extraer o verificar identidad si viene cabecera Authorization
        let userId = 'client_guest';
        let userEmail = 'cliente@online.com';
        const authHeader = req.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
                userId = decoded.uid;
                userEmail = (decoded as any).email || userEmail;
            } catch {
                // Modo resiliente: continuar con datos de cliente si token expiró
            }
        }

        // 3. Validar productos y stock en la base de datos única (Prisma)
        let orderTotal = 0;
        const verifiedItems: Array<{ id: string; name: string; quantity: number; price: number; initialReservedStock?: number }> = [];

        for (const item of items) {
            if (!item.id || !item.quantity || item.quantity <= 0) {
                return NextResponse.json({ error: 'Item inválido en el carrito' }, { status: 400 });
            }

            const product = await prisma.product.findUnique({
                where: { id: item.id }
            });

            if (!product) {
                return NextResponse.json({ error: `El producto ${item.id} no existe en catálogo` }, { status: 404 });
            }

            if (product.tenantId && tenantId && product.tenantId !== tenantId) {
                return NextResponse.json({ error: `El producto ${item.id} no pertenece a esta sucursal` }, { status: 403 });
            }

            const available = product.stock - (product.reservedStock || 0);
            if (available < item.quantity) {
                return NextResponse.json({ error: `Stock insuficiente para ${product.name}. Disponibles: ${available}, solicitados: ${item.quantity}` }, { status: 400 });
            }

            const realPrice = product.price || 0;
            orderTotal += (realPrice * item.quantity);

            verifiedItems.push({
                id: product.id,
                name: product.name,
                quantity: item.quantity,
                price: realPrice,
                initialReservedStock: product.reservedStock || 0
            });
        }

        // 4. Calcular importes operativos
        const developerFee = isOnline ? (requiresInvoice ? 6 : 1) : 0;
        const ownerAutomationFee = isOnline ? (requiresInvoice ? 5 : 0) : 0;
        orderTotal += (developerFee + ownerAutomationFee);

        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        const isDelivery = customerData?.deliveryMethod === 'repartidor';

        // 5. Transacción atómica en Prisma: apartar reserva de stock con OCC y crear la orden
        const createdOrder = await prisma.$transaction(async (tx) => {
            // Apartar el inventario de cada producto en reservedStock con Control de Concurrencia Optimista
            for (const item of verifiedItems) {
                const occ = await tx.product.updateMany({
                    where: { 
                        id: item.id,
                        reservedStock: item.initialReservedStock
                    },
                    data: {
                        reservedStock: { increment: item.quantity }
                    }
                });
                if (occ.count !== 1) {
                    throw new Error(`INSUFFICIENT_STOCK: El producto "${item.name}" fue apartado concurrentemente por otro cliente o caja.`);
                }
            }

            // Crear la orden en Prisma
            const order = await tx.order.create({
                data: {
                    id: orderId,
                    tenantId,
                    total: orderTotal,
                    paymentMethod: 'Online',
                    status: isDelivery ? 'READY_TO_SHIP' : 'paid',
                    deliveryType: isDelivery ? 'DELIVERY' : 'PICKUP',
                    offline: false,
                    synced: true,
                    confirmedAt: new Date(),
                    rejectionReason: null,
                    items: {
                        create: verifiedItems.map(it => ({
                            tenantId,
                            productId: it.id,
                            cantidad: it.quantity,
                            precio: it.price
                        }))
                    }
                }
            });

            // Registrar evento inmutable de auditoría
            await tx.orderEvent.create({
                data: {
                    tenantId,
                    orderId,
                    eventType: 'ORDER_CREATE_ONLINE',
                    fromStatus: 'pending',
                    toStatus: order.status,
                    actorId: userId,
                    actorName: customerData?.name || userEmail,
                    actorRole: 'client',
                    details: JSON.stringify({
                        orderTotal,
                        itemsCount: verifiedItems.length,
                        deliveryMethod: customerData?.deliveryMethod || 'tienda'
                    })
                }
            });

            return order;
        });

        return NextResponse.json({ success: true, orderId: createdOrder.id, total: orderTotal });

    } catch (error: any) {
        console.error("[Store Checkout API Error]:", error);
        return NextResponse.json(
            { error: error.message || 'Error interno procesando el pedido online' },
            { status: 500 }
        );
    }
}
