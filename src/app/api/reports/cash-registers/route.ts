import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'billing']);
    if (!auth.ok) return auth.response;
    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        
        // Obtenemos los cortes ordenados del más reciente al más antiguo
        const logs = await prisma.cashRegisterLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, data: logs });
    } catch (error: any) {
        console.error(`[CashRegisterLogs Error]: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
