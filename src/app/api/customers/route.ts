import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const customers = await prisma.customer.findMany({
            include: {
                orders: {
                    select: {
                        total: true,
                        status: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const enrichedCustomers = customers.map(c => {
            const paidOrders = c.orders.filter(o => o.status === 'paid' || o.status === 'delivered');
            const totalOrders = paidOrders.length;
            const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);

            // Determinar tipo
            let type = 'Nuevo';
            if (totalOrders >= 5 && totalSpent > 50000) type = 'VIP';
            else if (totalOrders >= 2) type = 'Frecuente';

            return {
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email || '',
                address: c.address || '',
                type,
                totalOrders,
                totalSpent,
                createdAt: c.createdAt.toISOString()
            };
        });

        return NextResponse.json({ success: true, data: enrichedCustomers });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { name, phone, email, address, type } = body;

        if (!name || !phone) {
            return NextResponse.json({ success: false, error: 'Name and phone are required.' }, { status: 400 });
        }

        const newCustomer = await prisma.customer.create({
            data: {
                name,
                phone,
                email: email || null,
                address: address || null,
            }
        });

        return NextResponse.json({
            success: true,
            data: newCustomer
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
