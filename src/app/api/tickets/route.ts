import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requireRole, requireActiveRole, getTenantId } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Endpoint público para quejas y soporte de clientes (anónimos o registrados)
    try {
        const body = await req.json();
        const { folio, customerEmail, customerName, message } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json({ success: false, error: 'Falta el mensaje del ticket de soporte' }, { status: 400 });
        }

        if (message.length > 2500) {
            return NextResponse.json({ success: false, error: 'El mensaje no debe exceder 2500 caracteres' }, { status: 400 });
        }

        const tenantId = getTenantId(req);
        const cleanFolio = typeof folio === 'string' ? folio.trim() : '';

        const newTicket = await prisma.supportTicket.create({
            data: {
                tenantId,
                folio: cleanFolio || `TKT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                customerEmail: typeof customerEmail === 'string' && customerEmail.trim() ? customerEmail.trim() : 'anonimo@tienda.com',
                customerName: typeof customerName === 'string' && customerName.trim() ? customerName.trim() : 'Anónimo',
                message: message.trim(),
                status: 'Pendiente (IA)'
            }
        });

        return NextResponse.json({ success: true, data: newTicket });
    } catch (error: any) {
        console.error('[TICKETS POST ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al registrar ticket' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const auth = requireRole(req, ['superadmin', 'admin', 'sales', 'caja', 'billing']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(req);

    try {
        const tickets = await prisma.supportTicket.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(tickets);
    } catch (error: any) {
        console.error('[TICKETS GET ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al obtener tickets' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await requireActiveRole(req, ['superadmin', 'admin', 'sales', 'caja', 'billing']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(req);

    try {
        const body = await req.json();
        const { id, status } = body;

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ success: false, error: 'ID de ticket requerido' }, { status: 400 });
        }
        if (!status || typeof status !== 'string') {
            return NextResponse.json({ success: false, error: 'Estado requerido' }, { status: 400 });
        }

        const existing = await prisma.supportTicket.findFirst({
            where: { id, tenantId }
        });

        if (!existing) {
            return NextResponse.json({ success: false, error: 'Ticket no encontrado' }, { status: 404 });
        }

        const updated = await prisma.supportTicket.update({
            where: { id: existing.id },
            data: { status: status.trim() }
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        console.error('[TICKETS PATCH ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al actualizar ticket' }, { status: 500 });
    }
}
