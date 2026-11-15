import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, getTenantId, WRITE_ROLES } from '@/lib/apiAuth';
import { parseRestockAuditRow } from '@/lib/restockConfirmation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    let auth = requireRole(request, [...WRITE_ROLES, 'admin', 'superadmin', 'inventory', 'almacen']);
    if (!auth.ok) {
        if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV === 'local') {
            auth = { ok: true, uid: 'local_owner', role: 'superadmin' };
        } else {
            return auth.response;
        }
    }

    try {
        const tenantId = getTenantId(request);
        const url = new URL(request.url);
        const productId = url.searchParams.get('productId')?.trim() || '';
        const limitRaw = Number(url.searchParams.get('limit') || '100');
        const take = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 100;

        const logs = await prisma.auditLog.findMany({
            where: {
                tenantId,
                action: { in: ['STOCK_UPDATE', 'STOCK_IN', 'INVENTORY_ENTRY'] },
            },
            orderBy: { timestamp: 'desc' },
            take,
        });

        let entries = logs.map((row: any) => parseRestockAuditRow(row));
        if (productId) {
            entries = entries.filter((entry) => entry.productId === productId);
        }

        return NextResponse.json({ success: true, data: entries });
    } catch (error: any) {
        console.error('[RESTOCK HISTORY GET ERROR]:', error?.message);
        return NextResponse.json(
            { success: false, error: 'Error al consultar historial de auditoría de recargas.' },
            { status: 500 }
        );
    }
}
