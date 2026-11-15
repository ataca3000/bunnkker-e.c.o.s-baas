import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession, requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const auth = await requireActiveRole(request, ['superadmin', 'admin', 'billing']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);
    const url = new URL(request.url);
    const actionFilter = url.searchParams.get('action');

    try {
        const whereClause: any = { tenantId };
        if (actionFilter) {
            whereClause.action = actionFilter;
        }

        const logs = await prisma.auditLog.findMany({
            where: whereClause,
            orderBy: { timestamp: 'desc' },
            take: 100 // limit to last 100 logs to prevent massive payloads
        });
        
        return NextResponse.json({ success: true, data: logs });
    } catch (error: any) {
        console.error('[AUDIT GET ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al recuperar registros de auditoría' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);

    try {
        const body = await request.json();
        const { action, details } = body;

        if (!action || typeof action !== 'string' || !action.trim()) {
            return NextResponse.json({ success: false, error: 'El campo action es requerido' }, { status: 400 });
        }

        const serializedDetails = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : '';
        const newLog = await prisma.auditLog.create({
            data: {
                tenantId,
                action: action.trim(),
                details: serializedDetails,
                userId: auth.uid,
            }
        });

        publishRealtimeEvent({
            tenantId,
            scope: 'audit',
            action: action.trim(),
            entityId: newLog.id,
            payload: {
                details: serializedDetails,
                actorUid: auth.uid,
            },
        });

        return NextResponse.json({ success: true, data: newLog });
    } catch (error: any) {
        console.error('[AUDIT POST ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al registrar auditoría' }, { status: 500 });
    }
}
