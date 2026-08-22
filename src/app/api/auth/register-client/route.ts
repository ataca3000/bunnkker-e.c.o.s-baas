import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, phone, address, rfc } = body;

        if (!name || !email) {
            return NextResponse.json({ success: false, error: 'Nombre y Correo Electrónico obligatorios' }, { status: 400 });
        }

        const cleanEmail = email.toLowerCase().trim();
        const cleanPhone = (phone || `55${Date.now().toString().slice(-8)}`).trim();

        const existing = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { email: cleanEmail }
                ]
            }
        });

        if (existing) {
            return NextResponse.json({ success: true, message: 'Cliente registrado previamente', customer: existing });
        }

        const customer = await prisma.customer.create({
            data: {
                name: name.trim(),
                email: cleanEmail,
                phone: cleanPhone,
                address: address?.trim() || null,
                rfc: rfc?.trim().toUpperCase() || null
            }
        });

        return NextResponse.json({ success: true, customer });
    } catch (error: any) {
        console.error('[Register Client API] Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando datos de cliente' }, { status: 500 });
    }
}
