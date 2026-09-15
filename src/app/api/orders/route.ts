import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { requireRole, validateApiSession, WRITE_ROLES } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const orders = await prisma.order.findMany({
            where: { tenantId },
            include: { items: true, customer: true },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json({ success: true, data: orders });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const body = await request.json();
        const { orderId, total, deliveryType, paymentMethod, clientData, customer, items, deliveryMethod } = body;
        const normalizedItems = Array.isArray(items) ? items.map((item: any) => ({
            productId: item.productId || item.id,
            quantity: Number(item.quantity),
            price: Number(item.price),
        })) : [];

        if (!orderId || normalizedItems.length === 0 || normalizedItems.some((item: any) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
            return NextResponse.json({ success: false, error: 'La venta requiere un folio y productos válidos.' }, { status: 400 });
        }

        // Garantía de Transacción ACID local
        const orderResult = await prisma.$transaction(async (tx) => {
            
            // 1. Resolver o Crear Cliente por Teléfono (si existe clientData y tiene teléfono)
            let customerId: string | null = null;
            const customerInput = clientData || customer;
            if (customerInput && customerInput.phone) {
                let customer = await tx.customer.findUnique({
                    where: { phone: customerInput.phone }
                });

                if (!customer) {
                    customer = await tx.customer.create({
                        data: {
                            tenantId,
                            name: customerInput.name || 'Cliente Genérico',
                            phone: customerInput.phone,
                            address: customerInput.address || null,
                            references: customerInput.references || customerInput.reference || null
                        }
                    });
                } else if (deliveryType === 'DELIVERY' && customerInput.address) {
                    // Actualizar datos de entrega si regresó con nueva dirección
                    customer = await tx.customer.update({
                        where: { id: customer.id },
                        data: {
                            address: customerInput.address,
                            references: customerInput.references || customerInput.reference
                        }
                    });
                }
                customerId = customer.id;
            }

            // 2. Descuento en Caliente de Inventario Local con Validación Atómica (Evita Race Conditions)
            // FIX BUG-1: Leer stock ANTES de decrementar para evitar stock negativo.
            // Prisma ejecuta cada update de forma secuencial dentro de la transacción,
            // pero no bloquea el registro entre la lectura y la escritura a nivel SQL.
            // La solución correcta es: leer → validar → decrementar condicionalmente.
            for (const item of normalizedItems) {
                // Paso A: Verificar stock actual antes de modificar
                const current = await tx.product.findUnique({
                    where: { id: item.productId },
                    select: { stock: true, id: true }
                });

                if (!current) {
                    throw new Error(`Producto no encontrado: (ID: ${item.productId}).`);
                }

                if (current.stock < item.quantity) {
                    throw new Error(`Inventario insuficiente para el producto (ID: ${item.productId}). Disponible: ${current.stock}, solicitado: ${item.quantity}.`);
                }

                // Paso B: Decrementar solo si la validación fue exitosa
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                });
            }

            // 3. Creación de la Orden en el Pipeline Logístico
            return await tx.order.create({
                data: {
                    id: orderId,
                    tenantId,
                    total,
                    deliveryType: deliveryType || (deliveryMethod === 'repartidor' ? 'DELIVERY' : (deliveryMethod === 'pickup' ? 'PICKUP' : 'LOCAL')),
                    paymentMethod: paymentMethod || 'CASH', // Aseguramos el método de pago obligatorio
                    status: 'PENDING_PAYMENT', // Estado inicial en la fila de espera
                    customerId: customerId,
                    items: {
                        create: normalizedItems.map((item: any) => ({
                            productId: item.productId,
                            cantidad: item.quantity,
                            precio: item.price
                        }))
                    }
                },
                include: { customer: true, items: true }
            });
        });

        return NextResponse.json({ success: true, data: orderResult });

    } catch (error: any) {
        console.error(`[ACID Transaction Error]: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


export async function PATCH(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, claim, ...updates } = body;

        if (!id) throw new Error('Order ID is required');

        if (claim && updates.driverId) {
            const claimed = await prisma.order.updateMany({
                where: {
                    id,
                    vendedorId: null,
                    status: { in: ['PAID', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'] },
                },
                data: { vendedorId: updates.driverId, vendedorName: updates.vendedorName ?? null },
            });
            if (claimed.count !== 1) {
                return NextResponse.json({ success: false, error: 'El pedido ya fue tomado por otro repartidor.' }, { status: 409 });
            }
            const claimedOrder = await prisma.order.findUnique({ where: { id }, include: { items: true, customer: true } });
            return NextResponse.json({ success: true, data: claimedOrder });
        }

        if (updates.driverId !== undefined) {
            updates.vendedorId = updates.driverId;
        }
        const current = await prisma.order.findUnique({ where: { id } });
        if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });
        const currentStatus = String(current.status).toUpperCase();
        const transitions: Record<string, string[]> = {
            PENDING_PAYMENT: ['PREPARING', 'CANCELLED'],
            PREPARING: ['READY_FOR_DELIVERY', 'READY_FOR_PICKUP', 'CANCELLED'],
            READY_FOR_DELIVERY: ['PAID', 'CANCELLED'],
            READY_FOR_PICKUP: ['PAID', 'CANCELLED'],
            PAID: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
            OUT_FOR_DELIVERY: ['DELIVERED'],
            DELIVERED: ['RECEIVED']
        };
        if (updates.status) updates.status = String(updates.status).toUpperCase();
        if (updates.status && updates.status !== currentStatus && !transitions[currentStatus]?.includes(updates.status)) {
            return NextResponse.json({ success: false, error: `Transición no permitida: ${current.status} → ${updates.status}` }, { status: 409 });
        }

        if (updates.status === 'PREPARING') updates.preparedAt = new Date();
        if (updates.status === 'PAID') updates.paidAt = new Date();
        if (updates.status === 'OUT_FOR_DELIVERY') updates.dispatchedAt = new Date();
        if (updates.status === 'DELIVERED') updates.deliveredAt = new Date();
        if (updates.status === 'RECEIVED') { updates.receivedAt = new Date(); updates.customerReceived = true; }

        if (updates.driverId !== undefined) {
            updates.vendedorId = updates.driverId;
        }

        const allowedFields = [
            'tenantId', 'total', 'paymentMethod', 'status', 'deliveryType', 
            'date', 'offline', 'synced', 'ventanilla', 'cajon', 
            'vendedorId', 'vendedorName', 'confirmedAt', 'customerId', 'preparedAt', 'paidAt', 'dispatchedAt', 'deliveredAt', 'receivedAt', 'deliveryPhoto', 'customerReceived'
        ];
        const prismaUpdates: any = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                prismaUpdates[key] = updates[key];
            }
        }
        
        let order;

        if (updates.status === 'CANCELLED') {
            // Fetch items to restore stock
            const existingOrder = await prisma.order.findUnique({
                where: { id },
                include: { items: true }
            });

            if (existingOrder && existingOrder.status !== 'cancelled') {
                order = await prisma.$transaction([
                    prisma.order.update({ where: { id }, data: prismaUpdates }),
                    ...existingOrder.items.map((item: any) =>
                        prisma.product.updateMany({
                            where: { id: item.productId },
                            data: { stock: { increment: item.cantidad } }
                        })
                    )
                ]);
                order = order[0]; // Get the updated order from transaction
            } else {
                order = await prisma.order.update({ where: { id }, data: prismaUpdates });
            }
        } else {
            order = await prisma.order.update({
                where: { id },
                data: prismaUpdates
            });
        }


        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
