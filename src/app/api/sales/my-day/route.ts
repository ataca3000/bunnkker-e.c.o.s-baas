import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;
    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const { searchParams } = new URL(request.url);
        const cashierId = searchParams.get('cashierId');

        if (!cashierId) {
            return NextResponse.json({ error: 'cashierId is required' }, { status: 400 });
        }

        // Obtener el último cierre
        const lastLog = await prisma.cashRegisterLog.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        const whereClause: any = {
            tenantId,
            paymentMethod: 'cash',
            status: { in: ['READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'] }
        };

        if (lastLog) {
            whereClause.date = { gt: lastLog.createdAt };
        } else {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            whereClause.date = { gte: startOfDay };
        }

        const myOrders = await prisma.order.findMany({
            where: whereClause,
            include: { customer: true, items: true },
            orderBy: { date: 'desc' }
        });

        const totalExpected = myOrders.reduce((sum, o) => sum + o.total, 0);

        return NextResponse.json({ 
            success: true, 
            data: myOrders,
            totalExpected,
            lastCloseAt: lastLog ? lastLog.createdAt : null
        });

    } catch (error: any) {
        console.error(`[My Day API Error]: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
