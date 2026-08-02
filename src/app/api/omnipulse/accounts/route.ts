/**
 * OMNIPULSE — API Routes de Accounts (Simulación Local)
 * GET  /api/omnipulse/accounts/list    → Lista cuentas conectadas del tenant
 * POST /api/omnipulse/accounts/connect → Conecta una nueva cuenta (token directo)
 * DELETE /api/omnipulse/accounts/[id] → Desconecta una cuenta
 *
 * En producción los tokens se guardan en SQLite con AES-256.
 * En esta versión operamos con almacenamiento en memoria + localStorage en frontend.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { NetworkId, OmniAccountSummary } from '@/lib/omnipulse/types';

// --- ALMACÉN EN MEMORIA (reemplazar por Prisma en producción) ---
// Simula la base de datos de cuentas por tenant
const accountStore: Map<string, OmniAccountSummary[]> = new Map();

export async function GET(request: NextRequest) {
    const tenantId = request.headers.get('x-tenant-id') ?? 'default';
    const accounts = accountStore.get(tenantId) ?? [];
    return NextResponse.json({ accounts, count: accounts.length });
}

export async function POST(request: NextRequest) {
    try {
        const tenantId = request.headers.get('x-tenant-id') ?? 'default';
        const body = await request.json() as {
            network: NetworkId;
            accountName: string;
            accountId: string;
            accessToken: string;
            channelId?: string; // Para Telegram: ID del canal/chat
        };

        if (!body.network || !body.accountName || !body.accessToken) {
            return NextResponse.json({ error: 'Campos requeridos: network, accountName, accessToken' }, { status: 400 });
        }

        const newAccount: OmniAccountSummary = {
            id: `${body.network}_${Date.now()}`,
            network: body.network,
            accountName: body.accountName,
            accountId: body.accountId || body.channelId || body.accountName,
            isActive: true,
            isTokenValid: true,
            expiresAt: null,
            createdAt: new Date().toISOString(),
        };

        // Guardar token en contexto seguro (en prod → Prisma + AES-256)
        // Por ahora almacén en memoria con referencia al token
        (newAccount as any)._token = body.accessToken;
        (newAccount as any)._channelId = body.channelId;

        const existing = accountStore.get(tenantId) ?? [];
        // Evitar duplicados por red+accountId
        const filtered = existing.filter(a => !(a.network === body.network && a.accountId === newAccount.accountId));
        accountStore.set(tenantId, [...filtered, newAccount]);

        return NextResponse.json({ account: newAccount, message: 'Cuenta conectada exitosamente' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tenantId = request.headers.get('x-tenant-id') ?? 'default';
        const { id } = await request.json();
        const existing = accountStore.get(tenantId) ?? [];
        accountStore.set(tenantId, existing.filter(a => a.id !== id));
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Exportar el store para que el dispatcher pueda acceder a los tokens
export { accountStore };
