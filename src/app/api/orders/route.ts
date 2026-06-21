import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const [order] = await prisma.$transaction([
            prisma.order.create({
                data: {
                    id: body.id,
                    total: body.total,
                    paymentMethod: body.paymentMethod || 'cash',
                    status: body.status || 'paid',
                    date: new Date(),
                    offline: true,
                    synced: false,
                    items: {
                        create: body.items.map((item: any) => ({
                            productId: item.id,
                            cantidad: item.quantity,
                            precio: item.price
                        }))
                    }
                },
                include: { items: true }
            }),
            ...body.items.map((item: any) => 
                prisma.product.update({
                    where: { id: item.id },
                    data: { stock: { decrement: item.quantity } }
                })
            ),
            prisma.syncQueue.create({
                data: {
                    collection: 'orders',
                    documentId: body.id,
                    action: 'CREATE',
                    payload: JSON.stringify(body)
                }
            })
        ]);

        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
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
                        prisma.product.update({
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

        // Queue sync to Firebase
        await prisma.syncQueue.create({
            data: {
                collection: 'orders',
                documentId: id,
                action: 'UPDATE',
                payload: JSON.stringify(updates)
            }
        });

        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
