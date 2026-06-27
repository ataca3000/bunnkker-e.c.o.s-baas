import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        // Solo el superadmin puede pedir la llave mágica
        const auth = validateApiSession(request);
        if (!auth.ok || (auth.role !== 'admin' && auth.role !== 'superadmin')) {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: params.id }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
        }

        // Generar el payload con el UID y el PIN real de la base de datos
        const payload = Buffer.from(JSON.stringify({ uid: user.id, pin: user.pin })).toString('base64');

        return NextResponse.json({ success: true, payload });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
