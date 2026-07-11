import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPinSha256 } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function POST(req: NextRequest) {
    try {
        const { pin, name, email } = await req.json();

        // 1. Validar que no existan usuarios en la base de datos (seguridad)
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            return NextResponse.json(
                { error: 'El sistema ya tiene usuarios registrados. Use el login estándar.' },
                { status: 400 }
            );
        }

        // 2. Validar formato de PIN
        if (!/^\d{4,6}$/.test(pin)) {
            return NextResponse.json(
                { error: 'El PIN debe ser estrictamente de 4 a 6 dígitos numéricos.' },
                { status: 400 }
            );
        }

        // 3. Hashear el PIN con SHA-256 (legacy fallback) y Bcrypt (VIP seguridad)
        const pinSha = hashPinSha256(pin);
        const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

        // 4. Crear el Super Administrador Inicial
        const user = await prisma.user.create({
            data: {
                name: name || 'Administrador Principal',
                email: email || 'admin@bunkker.com',
                pin: pinSha,
                pinHash: pinHash,
                role: 'superadmin',
                active: true
            }
        });

        return NextResponse.json({ success: true, message: 'SuperAdmin creado con éxito.' });
    } catch (error: any) {
        console.error("Error en auth setup:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
