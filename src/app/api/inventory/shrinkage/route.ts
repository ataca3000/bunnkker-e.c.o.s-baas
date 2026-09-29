import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, WRITE_ROLES } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    try {
        const logs = await prisma.shrinkageLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return NextResponse.json({ success: true, data: logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { productId, productName, productCategory, discrepancyType, qty, estimatedLoss, notes, reportedBy } = body;

        const log = await prisma.shrinkageLog.create({
            data: {
                productId,
                productName,
                productCategory: productCategory || 'General',
                discrepancyType,
                qty: Number(qty),
                estimatedLoss: Number(estimatedLoss),
                notes,
                reportedBy
            }
        });

        // Update product stock accordingly
        if (discrepancyType === 'missing') {
            await prisma.product.update({
                where: { id: productId },
                data: { stock: { decrement: Number(qty) } }
            });
        } else {
            await prisma.product.update({
                where: { id: productId },
                data: { stock: { increment: Number(qty) } }
            });
        }

        return NextResponse.json({ success: true, data: log });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
