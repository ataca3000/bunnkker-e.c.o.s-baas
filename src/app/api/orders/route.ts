import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const body = await request.json();
        const { orderId, total, deliveryType, paymentMethod, clientData, items, deliveryMethod } = body;

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
            // FIX BUG-1: Leer stock ANTES de decrementar para evitar stock negativo.
            // Prisma ejecuta cada update de forma secuencial dentro de la transacción,
            // pero no bloquea el registro entre la lectura y la escritura a nivel SQL.
            // La solución correcta es: leer → validar → decrementar condicionalmente.
            for (const item of items) {
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
                        create: items.map((item: any) => ({
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
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (updates.driverId !== undefined) {
            updates.vendedorId = updates.driverId;
        }

        const allowedFields = [
            'tenantId', 'total', 'paymentMethod', 'status', 'deliveryType', 
            'date', 'offline', 'synced', 'ventanilla', 'cajon', 
            'vendedorId', 'vendedorName', 'confirmedAt', 'customerId'
        ];
        const prismaUpdates: any = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                prismaUpdates[key] = updates[key];
            }
        }
        
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
