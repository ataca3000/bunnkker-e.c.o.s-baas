import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession, requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { roundMoney } from '@/lib/financial';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);

    try {
        const purchases = await prisma.purchase.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, data: purchases });
    } catch (error: any) {
        console.error('[PURCHASES GET ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al recuperar compras' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireActiveRole(request, ['superadmin', 'admin', 'billing', 'inventory']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);

    try {
        const body = await request.json();
        const { supplier, concept, amount, status } = body;

        if (!supplier || typeof supplier !== 'string' || !supplier.trim()) {
            return NextResponse.json({ success: false, error: 'El proveedor es requerido' }, { status: 400 });
        }
        if (!concept || typeof concept !== 'string' || !concept.trim()) {
            return NextResponse.json({ success: false, error: 'El concepto es requerido' }, { status: 400 });
        }
        const numericAmount = roundMoney(Number(amount));
        if (isNaN(numericAmount) || numericAmount < 0) {
            return NextResponse.json({ success: false, error: 'El monto debe ser un número válido mayor o igual a 0' }, { status: 400 });
        }

        const newPurchase = await prisma.purchase.create({
            data: {
                tenantId,
                supplier: supplier.trim(),
                concept: concept.trim(),
                amount: numericAmount,
                status: status || 'Pendiente'
            }
        });

        return NextResponse.json({ success: true, data: newPurchase });
    } catch (error: any) {
        console.error('[PURCHASES POST ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al registrar compra' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await requireActiveRole(request, ['superadmin', 'admin', 'billing']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);

    try {
        const body = await request.json();
        const { id, status } = body;

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ success: false, error: 'ID de compra requerido' }, { status: 400 });
        }
        if (!status || typeof status !== 'string') {
            return NextResponse.json({ success: false, error: 'Estado requerido' }, { status: 400 });
        }

        const existing = await prisma.purchase.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return NextResponse.json({ success: false, error: 'Compra no encontrada' }, { status: 404 });
        }

        const updated = await prisma.purchase.update({
            where: { id: existing.id },
            data: { status: status.trim() }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('[PURCHASES PATCH ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al actualizar compra' }, { status: 500 });
    }
}
