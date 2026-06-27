import { NextResponse } from 'next/server';
import { prisma } from '@bunkker/core';

export async function GET(request: Request) {
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
