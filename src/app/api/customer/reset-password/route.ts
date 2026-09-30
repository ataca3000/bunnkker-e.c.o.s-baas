import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const { phone, email } = await req.json();
        const searchPhone = phone ? String(phone).trim() : '';
        const searchEmail = email ? String(email).trim() : '';

        if (!searchPhone && !searchEmail) {
            return NextResponse.json(
                { success: false, error: 'Proporciona tu número de teléfono o correo registrado.' },
                { status: 400 }
            );
        }

        let customer = null;

        if (searchPhone) {
            customer = await prisma.customer.findUnique({
                where: { phone: searchPhone }
            });
        }

        if (!customer && searchPhone.length >= 10) {
            const rawPhone = searchPhone.replace(/\D/g, '').slice(-10);
            customer = await prisma.customer.findFirst({
                where: { phone: { contains: rawPhone } }
            });
        }

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'No encontramos ninguna cuenta registrada con esa información.' },
                { status: 404 }
            );
        }

        // Generar PIN de recuperación seguro (4 dígitos)
        const pinArray = new Uint16Array(1);
        crypto.getRandomValues(pinArray);
        const newPin = String(1000 + (pinArray[0] % 9000));

        await prisma.customer.update({
            where: { id: customer.id },
            data: { pin: newPin }
        });

        return NextResponse.json({
            success: true,
            message: `¡Contraseña/PIN restablecido con éxito! Tu nuevo PIN temporal es: ${newPin}. Inicia sesión y modifícalo en tu perfil.`,
            newPin
        });

    } catch (error: any) {
        console.error('[RESET PASSWORD ERROR]', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error al procesar la recuperación de contraseña.' },
            { status: 500 }
        );
    }
}
