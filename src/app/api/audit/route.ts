import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession, requireActiveRole, getTenantId } from '@/lib/apiAuth';
import { publishRealtimeEvent } from '@/lib/realtimeBus';
import { dispatchCriticalAdminPush, type EarlyWarningCategory } from '@/lib/fcmPush';

export const dynamic = 'force-dynamic';

const CRITICAL_AUDIT_PUSH_MAP: Record<string, { category: EarlyWarningCategory; title: string; url: string }> = {
    SECURITY_ALERT: { category: 'SECURITY_ALERT', title: '🛡️ Alerta Crítica de Seguridad', url: '/dashboard/audit' },
    SHRINKAGE: { category: 'SECURITY_ALERT', title: '📉 Merma Crítica Registrada', url: '/dashboard/audit' },
    ORDER_ABANDONED: { category: 'ORDER_ABANDONED', title: '⚠️ Orden Abandonada / Cancelada', url: '/dashboard/audit' },
    ORDER_CANCELLED: { category: 'ORDER_ABANDONED', title: '⚠️ Cancelación Crítica de Pedido', url: '/dashboard/audit' },
    PRICE_CHANGE: { category: 'PRICE_CHANGE', title: '💲 Cambio de Precio en Catálogo', url: '/dashboard/inventory' },
    PRINT_FAILED: { category: 'SYSTEM_ERROR', title: '🖨️ Error de Impresión / Hardware', url: '/dashboard/setup?step=7' },
};

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

        const normalizedAction = action.trim().toUpperCase();
        const criticalMatch = CRITICAL_AUDIT_PUSH_MAP[normalizedAction];
        if (criticalMatch) {
            void dispatchCriticalAdminPush({
                tenantId,
                category: criticalMatch.category,
                severity: criticalMatch.category === 'SECURITY_ALERT' || criticalMatch.category === 'SYSTEM_ERROR' ? 'critical' : 'warning',
                title: criticalMatch.title,
                body: serializedDetails || `Evento crítico registrado: ${normalizedAction}`,
                url: criticalMatch.url,
                actorUid: auth.uid,
                actorName: auth.role,
                dedupKey: `audit:${normalizedAction}:${newLog.id}`,
                cooldownMs: 3000,
                metadata: {
                    auditId: newLog.id,
                    auditAction: normalizedAction,
                },
            }).catch((err) => console.warn('[AUDIT FCM PUSH WARN]:', err));
        }

        return NextResponse.json({ success: true, data: newLog });
    } catch (error: any) {
        console.error('[AUDIT POST ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al registrar auditoría' }, { status: 500 });
    }
}
