import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const purchases = await prisma.purchase.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, data: purchases });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { supplier, concept, amount, status } = body;

        const newPurchase = await prisma.purchase.create({
            data: {
                supplier,
                concept,
                amount: Number(amount),
                status: status || 'Pendiente'
            }
        });

        return NextResponse.json({ success: true, data: newPurchase });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, status } = body;

        const updated = await prisma.purchase.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
