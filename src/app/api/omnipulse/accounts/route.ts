/**
 * OMNIPULSE — API Routes de Accounts (Persistencia Cifrada en Base de Datos)
 * GET    /api/omnipulse/accounts → Lista cuentas conectadas del tenant (sin exponer tokens)
 * POST   /api/omnipulse/accounts → Conecta y cifra una nueva cuenta en Prisma
 * DELETE /api/omnipulse/accounts → Desconecta una cuenta de Prisma
 */
import { NextRequest, NextResponse } from 'next/server';
import { getTenantId, requireRole } from '@/lib/apiAuth';
import type { NetworkId } from '@/lib/omnipulse/types';
import { accountStore } from '@/lib/omnipulse/store';
import {
    listPublicOmniAccounts,
    removeOmniAccount,
    upsertOmniAccount,
} from '@/lib/omnipulse/persistence';

export async function GET(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'marketing']);
    if (!auth.ok) return auth.response;

    const tenantId = auth.tenantId || getTenantId(request);
    const accounts = await listPublicOmniAccounts(tenantId);
    return NextResponse.json({ accounts, count: accounts.length });
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'marketing']);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = auth.tenantId || getTenantId(request);
        const body = (await request.json()) as {
            network: NetworkId;
            accountName: string;
            accountId?: string;
            accessToken: string;
            channelId?: string;
        };

        if (!body.network || !body.accountName || !body.accessToken) {
            return NextResponse.json(
                { error: 'Campos requeridos: network, accountName, accessToken' },
                { status: 400 }
            );
        }

        const newAccount = await upsertOmniAccount({
            tenantId,
            network: body.network,
            accountName: body.accountName.trim(),
            accountId: (body.accountId || body.channelId || body.accountName).trim(),
            accessToken: body.accessToken.trim(),
            channelId: body.channelId?.trim() || undefined,
            updatedBy: auth.uid,
        });

        return NextResponse.json({
            account: newAccount,
            message: 'Cuenta conectada y cifrada en base de datos exitosamente',
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'marketing']);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = auth.tenantId || getTenantId(request);
        const { id } = await request.json();
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'ID de cuenta requerido' }, { status: 400 });
        }
        await removeOmniAccount(tenantId, id, auth.uid);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export { accountStore };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
