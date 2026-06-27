import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function POST(
    request: NextRequest,
    context: any
) {
    const { id } = context.params;
    
    const auth = validateApiSession(request);
    if (!auth.ok || auth.role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }

    try {
        await prisma.user.update({
            where: { id },
            data: { deviceId: null }
        });

        return NextResponse.json({ success: true, message: 'Dispositivo desvinculado con éxito.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
