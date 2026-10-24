import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { verifyRoleSignature, getTenantId } from '@/lib/apiAuth';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || process.env.INTERNAL_API_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026'
);

function sanitizeCustomer(customer: any) {
    if (!customer) return null;
    const { pin: _pin, ...safe } = customer;
    return safe;
}

async function resolveCustomerId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const headerSession = req.headers.get('x-msj-session');
    const headerRole = req.headers.get('x-msj-role');
    const headerSig = req.headers.get('x-msj-role-sig');
    const tenantId = getTenantId(req);

    const jwtCookie = req.cookies.get('admincom_session')?.value;
    const msjSession = req.cookies.get('msj-session')?.value || headerSession;
    const msjRole = req.cookies.get('msj-role')?.value || headerRole;
    const msjSig = req.cookies.get('msj-role-sig')?.value || headerSig;

    for (const candidate of [jwtCookie, bearerToken, msjSession]) {
        if (!candidate) continue;
        try {
            const { payload } = await jwtVerify(candidate, JWT_SECRET);
            if ((payload.role === 'customer' || payload.role === 'client') && payload.uid) {
                return payload.uid as string;
            }
        } catch {
            // Not a JWT token
        }
    }

    if (msjSession && (msjRole === 'client' || msjRole === 'customer') && msjSig) {
        if (verifyRoleSignature(msjRole, msjSession, msjSig, tenantId)) {
            return msjSession;
        }
    }

    return null;
}

export async function GET(req: NextRequest) {
    try {
        const customerId = await resolveCustomerId(req);
        if (!customerId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                orders: {
                    orderBy: { date: 'desc' },
                    include: {
                        items: { include: { product: true } },
                        events: { orderBy: { createdAt: 'asc' } }
                    }
                }
            }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, customer: sanitizeCustomer(customer) });
    } catch {
        return NextResponse.json({ error: 'Error obteniendo perfil de cliente' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const customerId = await resolveCustomerId(req);
        if (!customerId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const data = await req.json();

        const validFields = ['name', 'address', 'references', 'rfc', 'razonSocial', 'regimenFiscal', 'usoCFDI', 'codigoPostal'];
        const updateData: any = {};
        
        for (const field of validFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }

        const updated = await prisma.customer.update({
            where: { id: customerId },
            data: updateData
        });

        return NextResponse.json({ success: true, customer: sanitizeCustomer(updated) });
    } catch {
        return NextResponse.json({ error: 'Error actualizando perfil de cliente' }, { status: 500 });
    }
}
