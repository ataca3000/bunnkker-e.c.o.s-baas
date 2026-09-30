import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession, encryptToken } from '@/lib/apiAuth';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        // Solo el superadmin puede pedir la llave mágica
        const auth = validateApiSession(request);
        if (!auth.ok || auth.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: params.id }
        });

        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
        }

        // Generar payload criptográfico robusto con nodeId, role, nonce anti-replay y expiración (15 minutos)
        const crypto = require('crypto');
        const nonce = crypto.randomBytes(16).toString('hex');
        const nodeId = process.env.INSTALLATION_ID || 'bunkker-local-node';
        const payload = encryptToken({ 
            nodeId,
            uid: user.id, 
            role: user.role,
            pin: user.pin,
            nonce,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 15 * 60 * 1000 
        });

        return NextResponse.json({ success: true, payload, nodeId, expiresAt: Date.now() + 15 * 60 * 1000 });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
