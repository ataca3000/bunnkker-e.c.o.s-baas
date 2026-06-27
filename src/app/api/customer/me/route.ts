import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_local_key');

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('admincom_session')?.value;
        if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { payload } = await jwtVerify(token, JWT_SECRET);
        
        if (payload.role !== 'customer') {
            return NextResponse.json({ error: 'Rol incorrecto' }, { status: 403 });
        }

        const customerId = payload.uid as string;

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                orders: {
                    orderBy: { date: 'desc' },
                    include: { items: { include: { product: true } } }
                }
            }
        });

        if (!customer) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, customer });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const token = req.cookies.get('admincom_session')?.value;
        if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { payload } = await jwtVerify(token, JWT_SECRET);
        const customerId = payload.uid as string;

        const data = await req.json();

        // Valid fields to update
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

        return NextResponse.json({ success: true, customer: updated });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
