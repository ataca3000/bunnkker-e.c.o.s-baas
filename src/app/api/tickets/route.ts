import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    // Para endpoints públicos (clientes no autenticados) no podemos forzar validateApiSession 
    // a menos que sea opcional. El AI chat ya valida el frontend, así que aquí permitiremos crear
    // tickets sin estar estrictamente bloqueados, ya que los clientes pueden mandar quejas sin login.
    try {
        const body = await req.json();
        const { folio, customerEmail, customerName, message } = body;

        if (!message) {
            return NextResponse.json({ error: 'Falta el mensaje de la queja' }, { status: 400 });
        }

        const newTicket = await prisma.supportTicket.create({
            data: {
                folio: folio || `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
                customerEmail: customerEmail || 'anonimo@tienda.com',
                customerName: customerName || 'Anónimo',
                message,
                status: 'Pendiente (IA)'
            }
        });

        return NextResponse.json({ success: true, ticket: newTicket });
    } catch (error: any) {
        console.error('Error creando ticket local:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;

    try {
        const tickets = await prisma.supportTicket.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(tickets);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;

    try {
        const body = await req.json();
        const { id, status } = body;
        
        if (!id || !status) {
            return NextResponse.json({ error: 'Faltan datos requeridos (id, status)' }, { status: 400 });
        }

        const updated = await prisma.supportTicket.update({
            where: { id },
            data: { status }
        });

        return NextResponse.json({ success: true, ticket: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
